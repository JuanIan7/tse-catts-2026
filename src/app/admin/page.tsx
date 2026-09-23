import { requireAdmin } from "@/lib/auth/authorization";
import { inviteUser, reviewAccess } from "./actions";

type RequestRow = { user_id: string; requested_name: string; requested_at: string; decision: string };

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("access_requests").select("user_id, requested_name, requested_at, decision").order("requested_at", { ascending: false });
  if (error) throw new Error("Não foi possível consultar solicitações.");
  const requests = (data ?? []) as RequestRow[];
  return <main><h1>Painel administrativo</h1><p className="notice">Convites entram como PENDENTE. Aprove o acesso somente após confirmar o avaliador.</p><h2>Cadastrar e convidar por e-mail</h2><form action={inviteUser}><p><label>Nome <input name="displayName" required minLength={2}/></label></p><p><label>E-mail <input name="email" type="email" required/></label></p><button type="submit">Enviar convite</button></form><h2>Solicitações</h2>{requests.length === 0 ? <p>Nenhuma solicitação registrada.</p> : <table><thead><tr><th>Solicitante</th><th>Data</th><th>Situação</th><th>Decisão</th></tr></thead><tbody>{requests.map((request) => <tr key={request.user_id}><td>{request.requested_name}</td><td>{new Date(request.requested_at).toLocaleDateString("pt-BR")}</td><td>{request.decision}</td><td><form action={reviewAccess}><input type="hidden" name="userId" value={request.user_id}/><select name="decision" defaultValue={request.decision}><option value="APROVADO">Aprovar</option><option value="RECUSADO">Recusar</option><option value="BLOQUEADO">Bloquear</option></select><button type="submit">Salvar</button></form></td></tr>)}</tbody></table>}</main>;
}
