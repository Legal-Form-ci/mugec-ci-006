/** Formats a FCFA amount with full separators and a stable “F” suffix. */
export function formatCFA(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "0 F";
  return `${Math.round(v).toLocaleString("fr-FR")} F`;
}

export function formatNumber(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "0";
  return Math.round(v).toLocaleString("fr-FR");
}
