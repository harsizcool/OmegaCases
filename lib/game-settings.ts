import { createClient } from "@/lib/supabase/server"

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
