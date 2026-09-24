import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SessionExperience } from "@/components/session-experience";
import { TextTurnForm } from "@/components/text-turn-form";
import { requireApprovedUser } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizePublicBriefing } from "@/lib/tse/briefing";
import type { Difficulty } from "@/lib/tse/session-case";

type SessionRow = { id: string; difficulty: Difficulty; status: string; image_path: string | null; character_image_path: string | null; public_briefing: unknown; started_at: string | null };
type Turn = { id: string; speaker: "ALUNO" | "PERSONAGEM" | "NARRADOR" | "SISTEMA"; content: string; delivery_status: "PENDENTE" | "OUVIDO" | "INTERROMPIDO" };
type Evaluation = { result: string; final_score: number; partial: boolean; calculation: { cobertura?: { avaliados: number; total: number; percentual: number }; rotulo?: string } };
const difficultyLabel: Record<string, string> = { FACIL: "Médio", MEDIA: "Difícil", DIFICIL: "Muito difícil" };
const terminalStatuses = new Set(["ENCERRADA_COM_EXITO", "ENCERRADA_SEM_EXITO", "CANCELADA"]);

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const { supabase } = await requireApprovedUser();
    const { data, error } = await supabase.from("training_sessions").select("id, difficulty, status, image_path, character_image_path, public_briefing, started_at").eq("id", sessionId).maybeSingle();
    if (error) throw new Error("Não foi possível abrir a ocorrência.");
    if (!data) notFound();
    const session = data as SessionRow;
    const { data: transcriptData } = await supabase.from("training_transcripts").select("id, speaker, content, delivery_status").eq("session_id", sessionId).order("sequence_number", { ascending: true });
    const allTurns = (transcriptData ?? []) as Turn[];
    const turns = allTurns.filter((turn) => turn.delivery_status === "OUVIDO" || turn.speaker === "SISTEMA");
    const lastCharacterTurn = [...allTurns].reverse().find((turn) => turn.speaker === "PERSONAGEM" && turn.delivery_status === "PENDENTE");
    const { data: evaluationData } = await supabase.from("evaluations").select("result, final_score, partial, calculation").eq("session_id", sessionId).maybeSingle();
    const evaluation = evaluationData as Evaluation | null;
    const admin = createSupabaseAdminClient();
    const [locationSigned, characterSigned] = await Promise.all([
      session.image_path ? admin.storage.from("tse-session-images").createSignedUrl(session.image_path, 3600) : null,
      session.character_image_path ? admin.storage.from("tse-session-images").createSignedUrl(session.character_image_path, 3600) : null,
    ]);
    const briefing = normalizePublicBriefing(session.public_briefing, session.difficulty);
    const terminal = terminalStatuses.has(session.status);
    return <AppShell backHref="/app" backLabel="Minhas sessões" tone="immersive">
      <div className="dashboard">
        <section className="dashboard-hero"><div className="eyebrow">Ocorrência simulada · {difficultyLabel[session.difficulty] ?? session.difficulty}</div><h1>{briefing.titulo}</h1><p>Estado: {session.status.replaceAll("_", " ")}. Observe o local, ouça o acionamento e conduza a conversa com base apenas no que for apresentado.</p></section>
        {!terminal && <SessionExperience sessionId={session.id} briefing={briefing} locationUrl={locationSigned?.data?.signedUrl ?? null} characterUrl={characterSigned?.data?.signedUrl ?? null} lastCharacterTurn={lastCharacterTurn ? { id: lastCharacterTurn.id, pending: lastCharacterTurn.delivery_status === "PENDENTE", content: lastCharacterTurn.content } : null} />}
        <section className="panel"><h2>Conversa</h2><p className="panel-subtitle">A transcrição fica salva para retomar a sessão. Respostas de voz entram no histórico depois que são confirmadas.</p><div className="transcript">{turns.length === 0 ? <p className="panel-subtitle">Aguardando o início da ocorrência.</p> : turns.map((turn) => <article className={`turn turn-${turn.speaker.toLowerCase()}`} key={turn.id}><strong>{turn.speaker === "ALUNO" ? "Você" : turn.speaker === "SISTEMA" ? "Sistema" : "Tentante"}</strong><p>{turn.content}</p></article>)}</div></section>
        {evaluation ? <section className="panel result-panel"><div className="eyebrow">Avaliação automática</div><h2>Simulação concluída</h2><p className="result-score">{evaluation.final_score.toFixed(1)} <small>/ 10</small></p><p>Desfecho: <strong>{evaluation.result === "EXITO" ? "saída digna aceita" : "simulação encerrada"}</strong>. Cobertura observável: {evaluation.calculation?.cobertura?.avaliados ?? 0}/{evaluation.calculation?.cobertura?.total ?? 17} itens.</p><p className="notice">{evaluation.calculation?.rotulo ?? "Estimativa didática; não é nota oficial do curso."}</p><Link className="button-link" href="/app">Voltar às sessões</Link></section> : terminal ? <section className="panel"><h2>Simulação encerrada</h2><p className="panel-subtitle">O relatório não está disponível. Atualize a página ou avise o administrador.</p></section> : <section className="panel"><h2>Enviar por texto</h2><p className="panel-subtitle">Use este campo se preferir escrever ou se o microfone não estiver disponível.</p><TextTurnForm sessionId={session.id} /></section>}
        <p className="notice">A simulação é fictícia. Se este conteúdo refletir situação real e atual, interrompa o exercício e procure apoio imediato.</p>
      </div>
    </AppShell>;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    redirect(message === "Acesso ainda não aprovado." ? "/pending" : "/login");
  }
}
