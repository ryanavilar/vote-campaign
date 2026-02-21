/**
 * Format a number with thousand separators (Indonesian locale).
 * Returns "0" for falsy values.
 */
export function formatNum(n: number | null | undefined): string {
  if (n == null) return "0";
  return n.toLocaleString("id-ID");
}
