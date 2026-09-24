import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth/authorization";
import { confirmDeliveredTurn } from "@/lib/tse/delivery";

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const body = await request.json() as { turnId?: unknown; interrupted?: unknown };
    if (typeof body.turnId !== "string" || typeof body.interrupted !== "boolean") return NextResponse.json({ error: "Evento de voz inválido." }, { status: 400 });
    const { user } = await requireApprovedUser();
    return NextResponse.json(await confirmDeliveredTurn({ userId: user.id, sessionId, turnId: body.turnId, interrupted: body.interrupted }));
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Não foi possível confirmar a entrega da resposta." }, { status: 409 });
  }
}
