import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireApprovedUser } from "@/lib/auth/authorization";
import { createTrainingSession } from "./actions";

type SessionRow = { id: string; difficulty: "FACIL" | "MEDIA" | "DIFICIL"; status: string; created_at: string };
const difficultyLabel = { FACIL: "Médio", MEDIA: "Difícil", DIFICIL: "Muito difícil" };

export default async function AppHome() {
  try {
    const { profile, supabase } = await requireApprovedUser();
    const { data } = await supabase.from("training_sessions").select("id, difficulty, status, created_at").order("created_at", { ascending: false }).limit(10);
    const sessions = (data ?? []) as SessionRow[];
    return <AppShell actions={profile.role === "ADMINISTRADOR" ? <Link href="/admin">Painel administrativo</Link> : null}>
      <div className="dashboard">
        <section className="dashboard-hero"><div className="eyebrow">Ambiente privado · CATTS 2026</div><h1>Olá, {profile.display_name}.</h1><p>Pratique uma conversa de cada vez. A simulação é fictícia, seu progresso fica protegido e o relatório é sempre uma estimativa didática.</p></section>
        <p className="notice">ESTIMATIVA DIDÁTICA — NÃO É NOTA OFICIAL DO CURSO. Em uma situação real, interrompa o exercício e procure apoio imediato.</p>
        <div className="dashboard-grid"><section className="panel"><h2>Nova ocorrência</h2><p className="panel-subtitle">Escolha o nível e prepare um cenário com contexto observável. A ficha pedagógica permanece protegida.</p><form action={createTrainingSession}><div className="difficulty-grid"><label>Dificuldade<select name="difficulty" defaultValue="MEDIA"><option value="FACIL">Médio · entrada</option><option value="MEDIA">Difícil · prática</option><option value="DIFICIL">Muito difícil · avançado</option></select></label></div><button type="submit">Preparar ocorrência</button></form></section>
        <section className="panel"><h2>Como funciona</h2><p className="panel-subtitle">Você pode falar pressionando o controle ou usar texto. O microfone aberto será uma opção voluntária dentro da ocorrência.</p><p className="notice notice-safe">Nenhuma informação interna é exibida antes do encerramento pedagógico da sessão.</p></section></div>
        <section className="panel"><h2>Suas sessões</h2>{sessions.length === 0 ? <p className="panel-subtitle">Nenhuma ocorrência iniciada. Quando estiver pronto, prepare a primeira simulação.</p> : <ul className="session-list">{sessions.map((session) => <li key={session.id}><Link href={`/app/sessions/${session.id}`}><span><strong>{difficultyLabel[session.difficulty]}</strong><br/><small>{session.status.replaceAll("_", " ")}</small></span><small>{new Date(session.created_at).toLocaleDateString("pt-BR")}</small></Link></li>)}</ul>}</section>
      </div>
    </AppShell>;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    redirect(message === "Acesso ainda não aprovado." ? "/pending" : "/login");
  }
}
