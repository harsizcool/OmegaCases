/**
 * Settings values and arithmetic with no database access, so pages in the
 * browser can use the same numbers and the same rounding as the server.
 *
 * lib/game-settings.ts reads these from the database, but it also imports the
 * server Supabase client, which a client component cannot pull in.
 */

/**
 * The share of a marketplace sale the site keeps, charged to the buyer on top of
 * the listing price. Five percent unless an admin has changed it.
 */
export const DEFAULT_BUYER_PROTECTION_RATE = 0.05

/** How high the fee may be set: anything above this is a mistake, not a policy. */
export const MAX_BUYER_PROTECTION_RATE = 0.5

/** Splits a listing price into what the buyer pays and what the seller receives. */
export function applyBuyerProtection(price: number, rate: number) {
  const fee = Math.round(price * rate * 100) / 100
  return {
    fee,
    // Rounding the fee to whole cents first keeps the three figures consistent:
    // total is exactly price + fee, never a hundredth out.
    total: Math.round((price + fee) * 100) / 100,
    sellerReceives: Math.round(price * 100) / 100,
  }
}

/** Formats a rate as a percentage without a pointless trailing ".0". */
export function formatRate(rate: number): string {
  const pct = rate * 100
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`
}
