import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { VoiceConversation } from "@/components/voice-conversation";
import { requireApprovedUser } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PublicBriefing } from "@/lib/tse/session-case";
import { sendTrainingTurn } from "../../actions";

type SessionRow = { id: string; difficulty: string; status: string; image_path: string | null; public_briefing: PublicBriefing; started_at: string | null };
type Turn = { id: string; speaker: "ALUNO" | "PERSONAGEM" | "NARRADOR" | "SISTEMA"; content: string; delivery_status: "PENDENTE" | "OUVIDO" | "INTERROMPIDO" };
type Evaluation = { result: string; final_score: number; partial: boolean; calculation: { cobertura?: { avaliados: number; total: number; percentual: number }; rotulo?: string } };
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
    const { data: transcriptData } = await supabase.from("training_transcripts").select("id, speaker, content, delivery_status").eq("session_id", sessionId).order("sequence_number", { ascending: true });
    const turns = ((transcriptData ?? []) as Turn[]).filter((turn) => turn.delivery_status === "OUVIDO" || turn.speaker === "SISTEMA");
    const { data: evaluationData } = await supabase.from("evaluations").select("result, final_score, partial, calculation").eq("session_id", sessionId).maybeSingle();
    const evaluation = evaluationData as Evaluation | null;
    const signed = session.image_path ? await createSupabaseAdminClient().storage.from("tse-session-images").createSignedUrl(session.image_path, 3600) : null;
    const briefing = session.public_briefing;
    const terminal = terminalStatuses.has(session.status);
    return <AppShell backHref="/app" backLabel="Minhas sessões" tone="immersive">
      <div className="dashboard">
        <section className="dashboard-hero"><div className="eyebrow">Ocorrência simulada · {difficultyLabel[session.difficulty] ?? session.difficulty}</div><h1>{briefing.titulo}</h1><p>Estado: {session.status.replaceAll("_", " ")}. Leia apenas as informações observáveis; a ficha pedagógica não é mostrada durante a conversa.</p></section>
        <section className="panel">{signed?.data?.signedUrl ? <img className="pov-image" src={signed.data.signedUrl} alt="Vista observável inicial da ocorrência simulada" /> : <div className="pov-image" role="img" aria-label="Cena de ocorrência simulada indisponível" style={{ background: "linear-gradient(145deg, #7b816f, #303a31)" }} />}
          <details><summary><strong>Contexto observável</strong></summary><p className="panel-subtitle">{briefing.contexto_observavel}</p><ul>{briefing.observaveis_iniciais.map((item) => <li key={item}>{item}</li>)}</ul><p className="notice">{briefing.orientacao}</p></details>
        </section>
        {!terminal && <VoiceConversation sessionId={session.id} />}
        <section className="panel"><h2>Conversa</h2><p className="panel-subtitle">A transcrição fica salva para retomar a sessão. Respostas de voz só entram no histórico depois que terminam de tocar.</p><div className="transcript">{turns.length === 0 ? <p className="panel-subtitle">Aguardando o primeiro turno. Você pode falar ou escrever abaixo.</p> : turns.map((turn) => <article className={`turn turn-${turn.speaker.toLowerCase()}`} key={turn.id}><strong>{turn.speaker === "ALUNO" ? "Você" : turn.speaker === "SISTEMA" ? "Sistema" : "Tentante"}</strong><p>{turn.content}</p></article>)}</div></section>
        {evaluation ? <section className="panel result-panel"><div className="eyebrow">Avaliação automática</div><h2>Simulação concluída</h2><p className="result-score">{evaluation.final_score.toFixed(1)} <small>/ 10</small></p><p>Desfecho: <strong>{evaluation.result === "EXITO" ? "saída digna aceita" : "simulação encerrada"}</strong>. Cobertura observável: {evaluation.calculation?.cobertura?.avaliados ?? 0}/{evaluation.calculation?.cobertura?.total ?? 17} itens.</p><p className="notice">{evaluation.calculation?.rotulo ?? "Estimativa didática; não é nota oficial do curso."}</p><Link className="button-link" href="/app">Voltar às sessões</Link></section> : terminal ? <section className="panel"><h2>Simulação encerrada</h2><p className="panel-subtitle">O relatório não está disponível. Atualize a página ou avise o administrador.</p></section> : <section className="panel"><h2>Enviar por texto</h2><p className="panel-subtitle">Use este campo se preferir escrever ou se o microfone não estiver disponível.</p><form action={sendTrainingTurn}><input type="hidden" name="sessionId" value={session.id} /><label>Sua fala<textarea name="content" rows={4} required maxLength={1500} placeholder="Escreva como você conduziria a conversa." /></label><button type="submit">Enviar fala</button></form></section>}
        <p className="notice">A simulação é fictícia. Se este conteúdo refletir situação real e atual, interrompa o exercício e procure apoio imediato.</p>
      </div>
    </AppShell>;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    redirect(message === "Acesso ainda não aprovado." ? "/pending" : "/login");
  }
}
