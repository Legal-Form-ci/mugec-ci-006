/** Formats a FCFA amount with smart units. */
export function formatCFA(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v) || v === 0) return "0 F";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)} M F`;
  if (Math.abs(v) >= 10_000) return `${Math.round(v / 1000)} k F`;
  return `${v.toLocaleString("fr-FR")} F`;
}
