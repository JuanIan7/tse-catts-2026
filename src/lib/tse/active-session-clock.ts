import { sessionDurationMs } from "./session-timer";
import type { Difficulty } from "./session-case";

export type ClockActivity = "PAUSED" | "VOICE_STUDENT" | "VOICE_CHARACTER" | "TEXT";

export type ActiveClock = {
  active_elapsed_ms: number;
  active_activity: ClockActivity;
  active_started_at: string | null;
};

export function countsTowardSession(activity: ClockActivity) {
  return activity !== "PAUSED";
}

export function activeElapsedMs(clock: ActiveClock, now = Date.now()) {
  const elapsed = Math.max(0, clock.active_elapsed_ms || 0);
  if (!countsTowardSession(clock.active_activity) || !clock.active_started_at) return elapsed;
  return elapsed + Math.max(0, now - new Date(clock.active_started_at).getTime());
}

export function remainingSessionMs(difficulty: Difficulty, clock: ActiveClock, now = Date.now()) {
  return Math.max(0, sessionDurationMs[difficulty] - activeElapsedMs(clock, now));
}

export function isActiveSessionExpired(difficulty: Difficulty, clock: ActiveClock, now = Date.now()) {
  return remainingSessionMs(difficulty, clock, now) === 0;
}
