/** Formats a Zites amount, abbreviating past 1000 (e.g. 19500 -> "19.5K+", 2_400_000 -> "2.4M+"). */
export function formatZites(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M+`
  if (abs >= 1_000) return `${(amount / 1_000).toFixed(1)}K+`
  return amount.toFixed(4)
}

/** Formats a Zites amount in full, comma-separated, with no abbreviation (e.g. 2_400_000 -> "2,400,000.0000"). */
export function formatZitesFull(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
}
