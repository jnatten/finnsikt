import type { LoanSettings, Split } from "./settings";

export interface MonthlyCost {
  principal: number;
  loanMonthly: number;
  sharedCost: number;
  total: number;
}

export type SplitStatus = "ok" | "near" | "over";

export interface SplitCost {
  split: Split;
  amount: number;
  status: SplitStatus;
}

const DOCUMENT_FEE_RATE = 0.025;
const TAX_DEDUCTION_RATE = 0.22;

export function monthlyCost(
  price: number,
  sharedCost: number,
  ownerType: string | undefined,
  loan: LoanSettings,
): MonthlyCost {
  const isSelveier = ownerType?.trim().toLowerCase().startsWith("selveier") ?? false;
  const documentFee = loan.includeDocumentFee && isSelveier ? DOCUMENT_FEE_RATE * price : 0;
  const principal = Math.max(0, price + documentFee - loan.equity);
  const r = loan.interestPct / 100 / 12;
  const n = Math.max(1, Math.round(loan.years * 12));
  const interest = principal * r;

  const payment =
    loan.type === "serial"
      ? principal / n + interest
      : r === 0
        ? principal / n
        : (principal * r) / (1 - (1 + r) ** -n);

  const loanMonthly =
    payment + (principal > 0 ? loan.monthlyFee : 0) - (loan.taxDeduction ? TAX_DEDUCTION_RATE * interest : 0);
  const total = loanMonthly + sharedCost;

  return { principal, loanMonthly, sharedCost, total };
}

export function splitCosts(total: number, splits: Split[], nearMaxPct: number): SplitCost[] {
  return splits.map((split) => {
    const amount = (total * split.pct) / 100;
    const max = split.maxMonthly;
    const status: SplitStatus = !max ? "ok" : amount > max ? "over" : amount >= (max * nearMaxPct) / 100 ? "near" : "ok";
    return { split, amount, status };
  });
}
