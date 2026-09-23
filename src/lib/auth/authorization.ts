import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TSEProfile = {
  user_id: string;
  display_name: string;
  role: "ALUNO" | "ADMINISTRADOR";
  access_status: "PENDENTE" | "APROVADO" | "BLOQUEADO" | "RECUSADO";
};

export async function requireApprovedUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Não autenticado.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, display_name, role, access_status")
    .eq("user_id", user.id)
    .single<TSEProfile>();

  if (profileError || !profile) throw new Error("Perfil indisponível.");
  if (profile.access_status !== "APROVADO") throw new Error("Acesso ainda não aprovado.");
  return { user, profile, supabase };
}

export async function requireAdmin() {
  const context = await requireApprovedUser();
  if (context.profile.role !== "ADMINISTRADOR") throw new Error("Acesso administrativo necessário.");
  return context;
}
