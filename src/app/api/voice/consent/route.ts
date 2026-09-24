import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const { user } = await requireApprovedUser();
  const { error } = await createSupabaseAdminClient().from("profiles").update({ voice_consent_at: new Date().toISOString(), voice_consent_version: "tse-voice-2026-09-24" }).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Não foi possível registrar seu consentimento." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
