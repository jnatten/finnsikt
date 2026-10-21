import { describe, expect, it } from "vitest";
import { monthlyCost, splitCosts } from "../src/lib/loan";
import { DEFAULT_SETTINGS, type LoanSettings, type Split } from "../src/lib/settings";

const loan = (overrides: Partial<LoanSettings> = {}): LoanSettings => ({
  ...DEFAULT_SETTINGS.loan,
  equity: 0,
  monthlyFee: 0,
  includeDocumentFee: false,
  ...overrides,
});

describe("monthlyCost", () => {
  it("calculates an annuity payment", () => {
    const result = monthlyCost(4_000_000, 0, "Andel", loan({ interestPct: 5, years: 30 }));
    expect(result.loanMonthly).toBeCloseTo(21_472.86, 1);
  });

  it("calculates the first month of a serial loan", () => {
    const result = monthlyCost(3_600_000, 0, "Andel", loan({ type: "serial", interestPct: 6, years: 30 }));
    expect(result.loanMonthly).toBeCloseTo(10_000 + 18_000, 6);
  });

  it("handles zero interest", () => {
    const result = monthlyCost(3_600_000, 0, "Andel", loan({ interestPct: 0, years: 30 }));
    expect(result.loanMonthly).toBeCloseTo(10_000, 6);
  });

  it("subtracts equity and adds fees and shared costs", () => {
    const result = monthlyCost(7_350_000, 5_557, "Andel", loan({ equity: 500_000, monthlyFee: 50 }));
    expect(result.principal).toBe(6_850_000);
    expect(result.loanMonthly).toBeCloseTo(36_772.28 + 50, 1);
    expect(result.total).toBeCloseTo(result.loanMonthly + 5_557, 6);
  });

  it("adds document fee for selveier only", () => {
    const settings = loan({ includeDocumentFee: true });
    expect(monthlyCost(4_000_000, 0, "Selveier", settings).principal).toBe(4_100_000);
    expect(monthlyCost(4_000_000, 0, "Andel", settings).principal).toBe(4_000_000);
  });

  it("subtracts the interest tax deduction", () => {
    const without = monthlyCost(4_000_000, 0, "Andel", loan({ interestPct: 6 }));
    const withDeduction = monthlyCost(4_000_000, 0, "Andel", loan({ interestPct: 6, taxDeduction: true }));
    expect(without.loanMonthly - withDeduction.loanMonthly).toBeCloseTo(0.22 * 20_000, 6);
  });

  it("never borrows a negative amount", () => {
    const result = monthlyCost(1_000_000, 3_000, "Andel", loan({ equity: 2_000_000, monthlyFee: 50 }));
    expect(result.principal).toBe(0);
    expect(result.total).toBe(3_000);
  });
});

describe("splitCosts", () => {
  const split = (pct: number, maxMonthly?: number): Split => ({ id: String(pct), label: "", pct, maxMonthly });

  it("divides the total by percentage", () => {
    const costs = splitCosts(40_000, [split(63), split(37)], 90);
    expect(costs.map((cost) => cost.amount)).toEqual([25_200, 14_800]);
  });

  it("flags splits over or close to their max", () => {
    const [over, near, ok, unlimited] = splitCosts(10_000, [split(50, 4_000), split(30, 3_200), split(10, 2_000), split(10)], 90);
    expect(over.status).toBe("over");
    expect(near.status).toBe("near");
    expect(ok.status).toBe("ok");
    expect(unlimited.status).toBe("ok");
  });

  it("treats exactly the max as near, not over", () => {
    expect(splitCosts(10_000, [split(100, 10_000)], 90)[0].status).toBe("near");
  });
});
