import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth/authorization";
import { registerInitialSilence } from "@/lib/tse/conversation";

export async function POST(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  try {
    const { user } = await requireApprovedUser();
    await registerInitialSilence({ userId: user.id, sessionId });
    return NextResponse.json({ recorded: true });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Não foi possível registrar o silêncio inicial." }, { status: 400 });
  }
}
