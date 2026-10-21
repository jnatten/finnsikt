import { describe, expect, it } from "vitest";
import { splitsAddUp, withDefaults, type Split } from "../src/lib/settings";

const split = (pct: number): Split => ({ id: String(pct), label: "", pct });

describe("splitsAddUp", () => {
  it("requires at least one split totalling 100 %", () => {
    expect(splitsAddUp([])).toBe(false);
    expect(splitsAddUp([split(63), split(37)])).toBe(true);
    expect(splitsAddUp([split(63), split(30)])).toBe(false);
    expect(splitsAddUp([split(33.33), split(33.33), split(33.34)])).toBe(true);
  });
});

describe("withDefaults", () => {
  it("converts the old single split into two splits", () => {
    const settings = withDefaults({ splitPct: 63 });
    expect(settings.splits.map((s) => s.pct)).toEqual([63, 37]);
    expect(settings).not.toHaveProperty("splitPct");
  });

  it("ignores an old split of 100 %", () => {
    expect(withDefaults({ splitPct: 100 }).splits).toEqual([]);
  });

  it("does not share default arrays between calls", () => {
    withDefaults(undefined).splits.push(split(100));
    expect(withDefaults(undefined).splits).toEqual([]);
  });
});
