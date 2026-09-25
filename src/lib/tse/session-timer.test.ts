import { describe, expect, it } from "vitest";
import { deadlineForSession, isSessionExpired, sessionDurationMs } from "./session-timer";

describe("session timer", () => {
  it("maps each training level to its approved duration", () => {
    expect(sessionDurationMs.FACIL).toBe(10 * 60 * 1000);
    expect(sessionDurationMs.MEDIA).toBe(15 * 60 * 1000);
    expect(sessionDurationMs.DIFICIL).toBe(25 * 60 * 1000);
  });

  it("expires only at the configured deadline", () => {
    const startedAt = "2026-09-25T12:00:00.000Z";
    expect(deadlineForSession("MEDIA", startedAt)?.toISOString()).toBe("2026-09-25T12:15:00.000Z");
    expect(isSessionExpired("MEDIA", startedAt, Date.parse("2026-09-25T12:14:59.999Z"))).toBe(false);
    expect(isSessionExpired("MEDIA", startedAt, Date.parse("2026-09-25T12:15:00.000Z"))).toBe(true);
  });
});
