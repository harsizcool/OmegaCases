import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requirePlusUser } from "@/lib/require-plus"

export async function GET(req: NextRequest) {
  // Require Plus auth for external/API-doc access when user_id param is provided.
  // If called without user_id it's an internal live-feed call — allow it (used server-side for the rolls feed).
  const userId = req.nextUrl.searchParams.get("user_id")
  if (userId !== null) {
    const auth = await requirePlusUser(userId)
    if (auth.error) return auth.error
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("rolls")
    .select(`
      id,
      created_at,
      user_id,
      item_id,
      users ( username ),
      items ( name, image_url, rarity, rap )
    `)
    .order("created_at", { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rolls = (data ?? []).reverse().map((r: any) => ({
    id: r.id,
    created_at: r.created_at,
    user_id: r.user_id,
    item_id: r.item_id,
    username: r.users?.username ?? "anon",
    item_name: r.items?.name ?? "Unknown",
    image_url: r.items?.image_url ?? null,
    rarity: r.items?.rarity ?? "Common",
    rap: r.items?.rap ?? 0,
  }))

  return NextResponse.json(rolls)
}
