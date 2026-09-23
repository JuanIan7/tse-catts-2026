import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireApprovedUser } from "@/lib/auth/authorization";
import type { PublicBriefing } from "@/lib/tse/session-case";

type SessionRow = { id: string; difficulty: string; status: string; public_briefing: PublicBriefing };

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const { supabase } = await requireApprovedUser();
    const { data, error } = await supabase.from("training_sessions").select("id, difficulty, status, public_briefing").eq("id", sessionId).maybeSingle();
    if (error) throw new Error("Não foi possível abrir a ocorrência.");
    if (!data) notFound();
    const session = data as SessionRow;
    const briefing = session.public_briefing;
    return <main><p><Link href="/app">← Voltar ao painel</Link></p><h1>{briefing.titulo}</h1><p className="notice">Dificuldade: {session.difficulty}. Leia apenas o que é observável. A ficha interna não é exibida ao aluno.</p><section><h2>Ao chegar</h2><p>{briefing.contexto_observavel}</p><h2>Informações observáveis</h2><ul>{briefing.observaveis_iniciais.map((item) => <li key={item}>{item}</li>)}</ul><p>{briefing.orientacao}</p></section><section><h2>Próxima etapa</h2><p>A conversa, a imagem POV e a interação por voz serão habilitadas nesta ocorrência na próxima etapa da beta.</p></section></main>;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    redirect(message === "Acesso ainda não aprovado." ? "/pending" : "/login");
  }
}
