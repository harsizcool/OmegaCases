import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const db = await createClient()

  // For each user, fetch their full inventory the same way the inventory page does:
  // select all inventory rows with the joined item data, then sum rap per user
  const { data: users } = await db
    .from("users")
    .select("id, username, profile_picture")

  if (!users) return NextResponse.json([])

  // Fetch ALL inventory rows — only Legendary and Omega count toward value
  let allInventory: { user_id: string; items: { rap: number; rarity: string } | null }[] = []
  let from = 0
  const pageSize = 1000
  while (true) {
    const { data: page, error } = await db
      .from("inventory")
      .select("user_id, items(rap, rarity)")
      .range(from, from + pageSize - 1)
    if (error || !page || page.length === 0) break
    allInventory = allInventory.concat(page as any)
    if (page.length < pageSize) break
    from += pageSize
  }

  const VALUE_RARITIES = ["Legendary", "Omega"]
  const rapMap: Record<string, number> = {}
  const countMap: Record<string, number> = {}

  for (const inv of allInventory) {
    const uid = inv.user_id
    const rarity = (inv.items as any)?.rarity ?? ""
    const rap = VALUE_RARITIES.includes(rarity) ? Number((inv.items as any)?.rap ?? 0) : 0
    if (!rapMap[uid]) { rapMap[uid] = 0; countMap[uid] = 0 }
    rapMap[uid] += rap
    countMap[uid]++
  }

  const leaderboard = users
    .map((u) => ({
      id: u.id,
      username: u.username,
      profile_picture: u.profile_picture,
      rap: Math.round((rapMap[u.id] || 0) * 100) / 100,
      itemCount: countMap[u.id] || 0,
    }))
    .sort((a, b) => b.rap - a.rap)
    .slice(0, 10)

  return NextResponse.json(leaderboard)
}
