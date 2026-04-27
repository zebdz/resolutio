export function formatWeightAndPercent(weight: number, total: number): string {
  const raw = weight.toFixed(2);

  if (total <= 0) {
    return `${raw} (0.00%)`;
  }

  const pct = ((weight / total) * 100).toFixed(2);

  return `${raw} (${pct}%)`;
}
