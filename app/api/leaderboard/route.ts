import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()

  // Get all users
  const { data: users } = await supabase
    .from("users")
    .select("id, username, profile_picture")

  if (!users) return NextResponse.json([])

  // Get all inventory with item RAP values
  const { data: inventory } = await supabase
    .from("inventory")
    .select("user_id, items(rap)")

  const rapMap: Record<string, number> = {}
  const countMap: Record<string, number> = {}

  for (const inv of inventory || []) {
    const uid = inv.user_id
    if (!rapMap[uid]) { rapMap[uid] = 0; countMap[uid] = 0 }
    rapMap[uid] += Number((inv.items as any)?.rap || 0)
    countMap[uid]++
  }

  const leaderboard = users
    .map((u) => ({
      id: u.id,
      username: u.username,
      profile_picture: u.profile_picture,
      rap: rapMap[u.id] || 0,
      itemCount: countMap[u.id] || 0,
    }))
    .sort((a, b) => b.rap - a.rap)
    .slice(0, 10)

  return NextResponse.json(leaderboard)
}
