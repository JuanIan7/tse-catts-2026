import { describe, expect, it } from "vitest";
import { activeElapsedMs, isActiveSessionExpired, remainingSessionMs } from "./active-session-clock";

describe("active session clock", () => {
  it("counts voice activity but not a paused wait", () => {
    const base = Date.parse("2026-09-25T12:00:00.000Z");
    expect(activeElapsedMs({ active_elapsed_ms: 12_000, active_activity: "VOICE_STUDENT", active_started_at: "2026-09-25T12:00:10.000Z" }, base + 15_000)).toBe(17_000);
    expect(activeElapsedMs({ active_elapsed_ms: 17_000, active_activity: "PAUSED", active_started_at: null }, base + 900_000)).toBe(17_000);
  });

  it("keeps text mode running continuously and expires only after the approved balance", () => {
    const clock = { active_elapsed_ms: 19 * 60 * 1000, active_activity: "TEXT" as const, active_started_at: "2026-09-25T12:00:00.000Z" };
    const at = Date.parse("2026-09-25T12:01:00.000Z");
    expect(remainingSessionMs("FACIL", clock, at)).toBe(0);
    expect(isActiveSessionExpired("FACIL", clock, at)).toBe(true);
  });
});
