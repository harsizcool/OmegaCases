import { createClient } from "@/lib/supabase/server"
import { CASE_PRICES } from "@/lib/types"
import {
  DEFAULT_BUYER_PROTECTION_RATE,
  MAX_BUYER_PROTECTION_RATE,
} from "@/lib/game-settings-shared"

export const DEFAULT_RARITY_CAPS: Record<string, number> = {
  Common: 0.04,
  Uncommon: 0.10,
  Rare: 0.40,
  Legendary: 2.00,
  Omega: 800,
}

export async function getRarityPriceCaps(): Promise<Record<string, number>> {
  try {
    const db = await createClient()
    const { data } = await db
      .from("game_settings")
      .select("value")
      .eq("key", "rarity_price_caps")
      .single()
    if (data?.value && typeof data.value === "object") {
      return data.value as Record<string, number>
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_RARITY_CAPS
}

export type CasePrice = { qty: number; price: number }

export async function getCasePrices(): Promise<CasePrice[]> {
  try {
    const db = await createClient()
    const { data } = await db
      .from("game_settings")
      .select("value")
      .eq("key", "case_prices")
      .single()
    if (Array.isArray(data?.value) && data.value.length > 0) {
      return data.value as CasePrice[]
    }
  } catch {
    // fall through to defaults
  }
  return CASE_PRICES
}

export type BannerSettings = { text: string; color: string } | null

export async function getBannerSettings(): Promise<BannerSettings> {
  try {
    const db = await createClient()
    const { data } = await db
      .from("game_settings")
      .select("value")
      .eq("key", "banner")
      .single()
    if (data?.value && typeof data.value === "object") {
      const v = data.value as { text?: string; color?: string }
      if (!v.text) return null
      return { text: v.text, color: v.color || "#1565c0" }
    }
  } catch {}
  return null
}

export {
  DEFAULT_BUYER_PROTECTION_RATE,
  MAX_BUYER_PROTECTION_RATE,
  applyBuyerProtection,
} from "@/lib/game-settings-shared"

/**
 * Reads the buyer protection rate an admin has set, falling back to the default.
 * A missing or nonsense value must not silently become a 0% or absurd fee.
 */
export async function getBuyerProtectionRate(): Promise<number> {
  try {
    const db = await createClient()
    const { data } = await db
      .from("game_settings")
      .select("value")
      .eq("key", "buyer_protection_rate")
      .single()

    const rate = Number(data?.value)
    if (Number.isFinite(rate) && rate >= 0 && rate <= MAX_BUYER_PROTECTION_RATE) {
      return rate
    }
  } catch {
    // fall through to the default
  }
  return DEFAULT_BUYER_PROTECTION_RATE
}
