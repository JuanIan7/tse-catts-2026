import type { Difficulty } from "./session-case";

export const sessionDurationMs: Record<Difficulty, number> = {
  FACIL: 10 * 60 * 1000,
  MEDIA: 15 * 60 * 1000,
  DIFICIL: 25 * 60 * 1000,
};

export function deadlineForSession(difficulty: Difficulty, startedAt: string | null) {
  if (!startedAt) return null;
  return new Date(new Date(startedAt).getTime() + sessionDurationMs[difficulty]);
}

export function isSessionExpired(difficulty: Difficulty, startedAt: string | null, now = Date.now()) {
  const deadline = deadlineForSession(difficulty, startedAt);
  return deadline !== null && deadline.getTime() <= now;
}
