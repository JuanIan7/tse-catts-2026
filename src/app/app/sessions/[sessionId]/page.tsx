import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SessionExperience } from "@/components/session-experience";
import { TextTurnForm } from "@/components/text-turn-form";
import { requireApprovedUser } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizePublicBriefing } from "@/lib/tse/briefing";
import type { Difficulty } from "@/lib/tse/session-case";

type SessionRow = { id: string; difficulty: Difficulty; status: string; image_path: string | null; public_briefing: unknown; started_at: string | null };
type Turn = { id: string; speaker: "ALUNO" | "PERSONAGEM" | "NARRADOR" | "SISTEMA"; content: string; delivery_status: "PENDENTE" | "OUVIDO" | "INTERROMPIDO"; event_metadata: { event?: string } | null };
type EvaluationItem = { id: string; titulo: string; estado: string; ajuste: number; evidencia: string };
type Evaluation = { result: string; final_score: number; partial: boolean; calculation: { cobertura?: { avaliados: number; total: number; percentual: number }; rotulo?: string; aviso_parcial?: string | null; itens?: EvaluationItem[]; ficha_caso?: { fator_principal: string; fatores_risco: string[]; fatores_protecao: string[] }; acertos?: string[]; melhorias?: string[]; linha_evolucao?: { fala: string; observacao: string }[]; motivo_encerramento?: string } };
const difficultyLabel: Record<string, string> = { FACIL: "Médio", MEDIA: "Difícil", DIFICIL: "Muito difícil" };
const terminalStatuses = new Set(["ENCERRADA_COM_EXITO", "ENCERRADA_SEM_EXITO", "CANCELADA"]);

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const { supabase } = await requireApprovedUser();
    const { data, error } = await supabase.from("training_sessions").select("id, difficulty, status, image_path, public_briefing, started_at").eq("id", sessionId).maybeSingle();
    if (error) throw new Error("Não foi possível abrir a ocorrência.");
    if (!data) notFound();
    const session = data as SessionRow;
    const { data: transcriptData } = await supabase.from("training_transcripts").select("id, speaker, content, delivery_status, event_metadata").eq("session_id", sessionId).order("sequence_number", { ascending: true });
    const allTurns = (transcriptData ?? []) as Turn[];
    const turns = allTurns.filter((turn) => turn.delivery_status === "OUVIDO" || turn.speaker === "SISTEMA");
    const pendingCharacterTurn = [...allTurns].reverse().find((turn) => turn.speaker === "PERSONAGEM" && turn.delivery_status === "PENDENTE");
    const openingCharacterTurn = pendingCharacterTurn?.event_metadata?.event === "ABERTURA" ? pendingCharacterTurn : undefined;
    const { data: evaluationData } = await supabase.from("evaluations").select("result, final_score, partial, calculation").eq("session_id", sessionId).maybeSingle();
    const evaluation = evaluationData as Evaluation | null;
    const admin = createSupabaseAdminClient();
    const locationSigned = session.image_path ? await admin.storage.from("tse-session-images").createSignedUrl(session.image_path, 3600) : null;
    const briefing = normalizePublicBriefing(session.public_briefing, session.difficulty);
    const terminal = terminalStatuses.has(session.status);
    return <AppShell backHref="/app" backLabel="Minhas sessões" tone="immersive">
      <div className="dashboard">
        <section className="dashboard-hero"><div className="eyebrow">Ocorrência simulada · {difficultyLabel[session.difficulty] ?? session.difficulty}</div><h1>{briefing.titulo}</h1><p>Estado: {session.status.replaceAll("_", " ")}. Observe o local, ouça o acionamento e conduza a conversa com base apenas no que for apresentado.</p></section>
        {!terminal && <SessionExperience sessionId={session.id} briefing={briefing} locationUrl={locationSigned?.data?.signedUrl ?? null} lastCharacterTurn={openingCharacterTurn ? { id: openingCharacterTurn.id, pending: true, content: openingCharacterTurn.content } : null} pendingCharacterTurn={pendingCharacterTurn && !openingCharacterTurn ? { id: pendingCharacterTurn.id, pending: true, content: pendingCharacterTurn.content } : null} difficulty={session.difficulty} startedAt={session.started_at} />}
        <section className="panel"><h2>Conversa</h2><p className="panel-subtitle">A transcrição fica salva para retomar a sessão. Respostas de voz entram no histórico depois que são confirmadas.</p><div className="transcript">{turns.length === 0 ? <p className="panel-subtitle">Aguardando o início da ocorrência.</p> : turns.map((turn) => <article className={`turn turn-${turn.speaker.toLowerCase()}`} key={turn.id}><strong>{turn.speaker === "ALUNO" ? "Você" : turn.speaker === "SISTEMA" ? "Sistema" : "Tentante"}</strong><p>{turn.content}</p></article>)}</div></section>
        {evaluation ? <section className="panel result-panel"><div className="eyebrow">Avaliação automática</div><h2>Simulação concluída</h2><p className="result-score">{evaluation.final_score.toFixed(1)} <small>/ 10</small></p><p>Desfecho: <strong>{evaluation.result === "EXITO" ? "saída digna aceita" : "simulação encerrada"}</strong>. Cobertura observável: {evaluation.calculation?.cobertura?.avaliados ?? 0}/{evaluation.calculation?.cobertura?.total ?? 17} itens.</p><p className="notice">{evaluation.calculation?.rotulo ?? "Estimativa didática; não é nota oficial do curso."}</p><p><strong>{evaluation.calculation?.motivo_encerramento ?? "SIMULAÇÃO ENCERRADA"}</strong></p>{evaluation.calculation?.ficha_caso && <details open><summary>Ficha revelada do caso</summary><p><strong>Fator principal:</strong> {evaluation.calculation.ficha_caso.fator_principal}</p><p><strong>Fatores de risco:</strong> {evaluation.calculation.ficha_caso.fatores_risco.join("; ")}</p><p><strong>Fatores de proteção:</strong> {evaluation.calculation.ficha_caso.fatores_protecao.join("; ")}</p></details>}{evaluation.calculation?.aviso_parcial && <p className="notice">{evaluation.calculation.aviso_parcial}</p>}{evaluation.calculation?.itens && <details><summary>Ficha de avaliação item a item</summary><ul>{evaluation.calculation.itens.map((item) => <li key={item.id}><strong>{item.titulo}</strong>: {item.ajuste >= 0 ? "+" : ""}{item.ajuste.toFixed(1)} — {item.estado.replaceAll("_", " ")}</li>)}</ul></details>}<section><h3>Acertos mais relevantes</h3><ul>{evaluation.calculation?.acertos?.map((item) => <li key={item}>{item}</li>)}</ul><h3>Ajustes sugeridos</h3><ul>{evaluation.calculation?.melhorias?.map((item) => <li key={item}>{item}</li>)}</ul><h3>Linha de evolução</h3><ul>{evaluation.calculation?.linha_evolucao?.map((item, index) => <li key={index}><strong>Você:</strong> {item.fala} - <em>{item.observacao}</em></li>)}</ul></section><Link className="button-link" href="/app">Voltar às sessões</Link></section> : terminal ? <section className="panel"><h2>Simulação encerrada</h2><p className="panel-subtitle">O relatório não está disponível. Atualize a página ou avise o administrador.</p></section> : <section className="panel"><h2>Enviar por texto</h2><p className="panel-subtitle">Use este campo se preferir escrever ou se o microfone não estiver disponível.</p><TextTurnForm sessionId={session.id} /></section>}
        <p className="notice">A simulação é fictícia. Se este conteúdo refletir situação real e atual, interrompa o exercício e procure apoio imediato.</p>
      </div>
    </AppShell>;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    redirect(message === "Acesso ainda não aprovado." ? "/pending" : "/login");
  }
}
