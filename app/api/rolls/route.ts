import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const limitParam = req.nextUrl.searchParams.get("limit")
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 200) : 30

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
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rolls = (data ?? []).map((r: any) => ({
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
