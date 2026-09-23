"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const allowed = new Set(["APROVADO", "RECUSADO", "BLOQUEADO"]);

export async function reviewAccess(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!userId || !allowed.has(decision)) throw new Error("Decisão inválida.");
  const { user } = await requireAdmin();
  const admin = createSupabaseAdminClient();
  const { error: profileError } = await admin.from("profiles").update({ access_status: decision }).eq("user_id", userId);
  if (profileError) throw new Error("Não foi possível atualizar o acesso.");
  const { error: requestError } = await admin.from("access_requests").update({ decision, reviewed_at: new Date().toISOString(), reviewed_by: user.id }).eq("user_id", userId);
  if (requestError) throw new Error("A decisão foi aplicada, mas o histórico não foi atualizado.");
  revalidatePath("/admin");
}
