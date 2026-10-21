const kr = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });

export function formatKr(amount: number): string {
  return `${kr.format(Math.round(amount))} kr`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} t` : `${hours} t ${rest} min`;
}
