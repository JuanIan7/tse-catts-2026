import Link from "next/link";
import { redirect } from "next/navigation";
import { requireApprovedUser } from "@/lib/auth/authorization";
import { createTrainingSession } from "./actions";

type SessionRow = { id: string; difficulty: "FACIL" | "MEDIA" | "DIFICIL"; status: string; created_at: string };
const difficultyLabel = { FACIL: "Fácil", MEDIA: "Média", DIFICIL: "Difícil" };

export default async function AppHome() {
  try {
    const { profile, supabase } = await requireApprovedUser();
    const { data } = await supabase.from("training_sessions").select("id, difficulty, status, created_at").order("created_at", { ascending: false }).limit(10);
    const sessions = (data ?? []) as SessionRow[];
    return <main>
      <h1>Olá, {profile.display_name}</h1>
      <p className="notice">Treinamento simulado. A avaliação exibirá sempre: ESTIMATIVA DIDÁTICA — NÃO É NOTA OFICIAL DO CURSO.</p>
      <section><h2>Nova ocorrência</h2><form action={createTrainingSession}><label>Dificuldade <select name="difficulty" defaultValue="MEDIA"><option value="FACIL">Fácil</option><option value="MEDIA">Média</option><option value="DIFICIL">Difícil</option></select></label><button type="submit">Preparar ocorrência</button></form></section>
      <section><h2>Seu histórico</h2>{sessions.length === 0 ? <p>Nenhuma ocorrência iniciada.</p> : <ul className="history">{sessions.map((session) => <li key={session.id}><Link href={`/app/sessions/${session.id}`}>{difficultyLabel[session.difficulty]} · {session.status.replaceAll("_", " ")} · {new Date(session.created_at).toLocaleDateString("pt-BR")}</Link></li>)}</ul>}</section>
      {profile.role === "ADMINISTRADOR" && <p><Link href="/admin">Abrir painel administrativo</Link></p>}
    </main>;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    redirect(message === "Acesso ainda não aprovado." ? "/pending" : "/login");
  }
}
