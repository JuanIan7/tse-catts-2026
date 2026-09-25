import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth/authorization";
import { finalizeTimedTrainingSession } from "@/lib/tse/conversation";

export async function POST(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const { user } = await requireApprovedUser();
    return NextResponse.json(await finalizeTimedTrainingSession({ userId: user.id, sessionId }));
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Não foi possível encerrar a ocorrência." }, { status: 409 });
  }
}
