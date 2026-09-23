import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireApprovedUser } from "@/lib/auth/authorization";
import type { PublicBriefing } from "@/lib/tse/session-case";
import { sendTrainingTurn } from "../../actions";

type SessionRow = { id: string; difficulty: string; status: string; public_briefing: PublicBriefing };
type Turn = { id: string; speaker: "ALUNO" | "PERSONAGEM" | "NARRADOR" | "SISTEMA"; content: string };

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const { supabase } = await requireApprovedUser();
    const { data, error } = await supabase.from("training_sessions").select("id, difficulty, status, public_briefing").eq("id", sessionId).maybeSingle();
    if (error) throw new Error("Não foi possível abrir a ocorrência.");
    if (!data) notFound();
    const { data: transcriptData } = await supabase.from("training_transcripts").select("id, speaker, content").eq("session_id", sessionId).order("sequence_number", { ascending: true });
    const session = data as SessionRow; const briefing = session.public_briefing; const turns = (transcriptData ?? []) as Turn[];
    return <main><p><Link href="/app">← Voltar ao painel</Link></p><h1>{briefing.titulo}</h1><p className="notice">Dificuldade: {session.difficulty}. Leia apenas o que é observável. A ficha interna não é exibida ao aluno.</p><section><h2>Ao chegar</h2><p>{briefing.contexto_observavel}</p><h2>Informações observáveis</h2><ul>{briefing.observaveis_iniciais.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h2>Abordagem</h2><p>{briefing.orientacao}</p><div className="transcript">{turns.length === 0 ? <p>Nenhuma fala registrada ainda.</p> : turns.map((turn) => <article className={`turn turn-${turn.speaker.toLowerCase()}`} key={turn.id}><strong>{turn.speaker === "ALUNO" ? "Você" : "Personagem"}</strong><p>{turn.content}</p></article>)}</div><form action={sendTrainingTurn}><input type="hidden" name="sessionId" value={session.id}/><label>Sua fala<textarea name="content" rows={4} required maxLength={3000} placeholder="Fale como o abordador. O diálogo é transcrito e será usado na avaliação."/></label><button type="submit">Enviar fala</button></form></section><p className="notice">A sessão é simulada. Se este conteúdo refletir uma situação real e atual, interrompa o exercício e procure apoio imediato.</p></main>;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    redirect(message === "Acesso ainda não aprovado." ? "/pending" : "/login");
  }
}
