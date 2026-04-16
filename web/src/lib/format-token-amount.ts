/** Trim trailing zeros for display (does not round). */
export function formatTokenAmountDisplay(
  value: string,
  maxFractionDigits = 8,
): string {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) {
    return value;
  }
  return n.toLocaleString(undefined, {
    maximumFractionDigits: maxFractionDigits,
    useGrouping: false,
  });
}
