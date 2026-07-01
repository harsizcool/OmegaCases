/** Formats a Zites amount, abbreviating past 1000 (e.g. 19500 -> "19.5K+", 2_400_000 -> "2.4M+"). */
export function formatZites(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M+`
  if (abs >= 1_000) return `${(amount / 1_000).toFixed(1)}K+`
  return amount.toFixed(4)
}
