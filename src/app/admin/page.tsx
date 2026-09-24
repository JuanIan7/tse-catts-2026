import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth/authorization";
import { inviteUser, reviewAccess, sendPasswordReset } from "./actions";

type RequestRow = { user_id: string; requested_name: string; requested_email: string; requested_at: string; decision: string };

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("access_requests").select("user_id, requested_name, requested_email, requested_at, decision").order("requested_at", { ascending: false });
  if (error) throw new Error("Não foi possível consultar solicitações.");
  const requests = (data ?? []) as RequestRow[];
  return <AppShell backHref="/app" backLabel="Painel do aluno">
    <div className="admin-panel"><section className="admin-heading"><div><div className="eyebrow">Acesso e acompanhamento</div><h1>Painel administrativo</h1><p className="panel-subtitle">Senhas nunca são exibidas. Convites e redefinições são enviados pelo provedor de autenticação.</p></div><Link href="/app">Abrir simulador</Link></section>
    <p className="notice">Confirme sempre nome e e-mail antes de aprovar. A decisão passa a valer na próxima requisição autenticada.</p>
    <section className="panel"><h2>Cadastrar e convidar</h2><form action={inviteUser}><label>Nome<input name="displayName" required minLength={2}/></label><label>E-mail<input name="email" type="email" required/></label><button type="submit">Enviar convite</button></form></section>
    <section className="panel"><h2>Solicitações de acesso</h2>{requests.length === 0 ? <p className="panel-subtitle">Nenhuma solicitação registrada.</p> : <div className="table-wrap"><table><thead><tr><th>Solicitante</th><th>E-mail</th><th>Data</th><th>Situação</th><th>Acesso</th><th>Senha</th></tr></thead><tbody>{requests.map((request) => <tr key={request.user_id}><td>{request.requested_name}</td><td>{request.requested_email}</td><td>{new Date(request.requested_at).toLocaleDateString("pt-BR")}</td><td><span className="status-badge">{request.decision}</span></td><td><form action={reviewAccess}><input type="hidden" name="userId" value={request.user_id}/><select name="decision" defaultValue={request.decision}><option value="APROVADO">Aprovar</option><option value="RECUSADO">Recusar</option><option value="BLOQUEADO">Bloquear</option></select><button type="submit">Salvar</button></form></td><td><form action={sendPasswordReset}><input type="hidden" name="userId" value={request.user_id}/><button type="submit">Redefinir</button></form></td></tr>)}</tbody></table></div>}</section></div>
  </AppShell>;
}
