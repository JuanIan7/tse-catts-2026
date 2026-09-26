import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth/authorization";
import { updateTrainingClock } from "@/lib/tse/conversation";

const activities = new Set(["PAUSED", "VOICE_STUDENT", "VOICE_CHARACTER", "TEXT"]);

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const body = await request.json() as { activity?: unknown };
    if (typeof body.activity !== "string" || !activities.has(body.activity)) throw new Error("Atividade de cronômetro inválida.");
    const { user } = await requireApprovedUser();
    return NextResponse.json(await updateTrainingClock({ userId: user.id, sessionId, activity: body.activity as "PAUSED" | "VOICE_STUDENT" | "VOICE_CHARACTER" | "TEXT" }));
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Não foi possível sincronizar o cronômetro." }, { status: 409 });
  }
}
