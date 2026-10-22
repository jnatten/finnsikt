const kr = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 });

export function formatKr(amount: number): string {
  return `${kr.format(Math.round(amount))} kr`;
}

export function formatPct(value: number): string {
  return `${pct.format(value)} %`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}\u00a0min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}\u00a0t` : `${hours}\u00a0t ${rest}\u00a0min`;
}
