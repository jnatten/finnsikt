import { describe, expect, it } from "vitest";
import { nextWeekdayAt } from "../src/lib/entur";
import { formatDuration } from "../src/lib/format";

describe("nextWeekdayAt", () => {
  it("picks the next day on weekdays", () => {
    const date = nextWeekdayAt("08:30", new Date(2026, 9, 21, 12));
    expect([date.getDate(), date.getHours(), date.getMinutes()]).toEqual([22, 8, 30]);
  });

  it("skips the weekend", () => {
    expect(nextWeekdayAt("08:30", new Date(2026, 9, 23, 12)).getDate()).toBe(26);
    expect(nextWeekdayAt("08:30", new Date(2026, 9, 24, 12)).getDate()).toBe(26);
  });
});

describe("formatDuration", () => {
  it("formats minutes and hours, keeping each number with its unit", () => {
    expect(formatDuration(500)).toBe("8\u00a0min");
    expect(formatDuration(3600)).toBe("1\u00a0t");
    expect(formatDuration(4500)).toBe("1\u00a0t 15\u00a0min");
  });
});
