import { describe, expect, it } from "vitest";
import { destinationsFor, splitsAddUp, withDefaults, type Destination, type Split } from "../src/lib/settings";

const split = (pct: number): Split => ({ id: String(pct), label: "", pct });

const destination = (id: string, showOn: Destination["showOn"]): Destination => ({
  id,
  label: id,
  address: id,
  lat: 59.9,
  lon: 10.7,
  modes: ["transit"],
  showOn,
});

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

  it("shows old destinations on real estate only", () => {
    const { showOn, ...old } = destination("jobb", ["job"]);
    expect(withDefaults({ destinations: [old] }).destinations[0].showOn).toEqual(["realestate"]);
    expect(withDefaults({ destinations: [{ ...old, showOn }] }).destinations[0].showOn).toEqual(["job"]);
  });
});

describe("destinationsFor", () => {
  it("keeps routable destinations shown on the vertical", () => {
    const destinations = [
      destination("jobb", ["realestate"]),
      destination("hjem", ["job"]),
      destination("begge", ["realestate", "job"]),
      { ...destination("uten-adresse", ["job"]), lat: undefined },
    ];
    expect(destinationsFor(destinations, "job").map((d) => d.id)).toEqual(["hjem", "begge"]);
    expect(destinationsFor(destinations, "realestate").map((d) => d.id)).toEqual(["jobb", "begge"]);
  });
});
