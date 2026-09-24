import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth/authorization";
import { confirmCharacterDelivery } from "@/lib/tse/conversation";

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const body = await request.json() as { turnId?: unknown; interrupted?: unknown };
  if (typeof body.turnId !== "string" || typeof body.interrupted !== "boolean") return NextResponse.json({ error: "Evento de voz inválido." }, { status: 400 });
  const { user } = await requireApprovedUser();
  await confirmCharacterDelivery({ userId: user.id, sessionId, turnId: body.turnId, interrupted: body.interrupted });
  return NextResponse.json({ ok: true });
}
