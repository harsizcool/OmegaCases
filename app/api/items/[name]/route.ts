import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const itemName = decodeURIComponent(name)
  const db = createClient()

  // Fetch the item by name
  const { data: item, error } = await db
    .from("items")
    .select("*, first_unboxer:users!items_first_unboxed_by_fkey(id, username)")
    .ilike("name", itemName)
    .single()

  if (error || !item) return NextResponse.json({ error: "Item not found" }, { status: 404 })

  // Total in circulation (all inventory rows for this item)
  const { count: circulation } = await db
    .from("inventory")
    .select("id", { count: "exact", head: true })
    .eq("item_id", item.id)

  // Who owns it and how many
  const { data: owners } = await db
    .from("inventory")
    .select("user_id, users(id, username, profile_picture)")
    .eq("item_id", item.id)

  const ownerMap: Record<string, { user: any; count: number }> = {}
  for (const row of owners ?? []) {
    const uid = row.user_id
    if (!ownerMap[uid]) ownerMap[uid] = { user: row.users, count: 0 }
    ownerMap[uid].count++
  }
  const ownerList = Object.values(ownerMap).sort((a, b) => b.count - a.count)

  // Active listings for this item
  const { data: listings } = await db
    .from("listings")
    .select("*, users(id, username)")
    .eq("item_id", item.id)
    .eq("status", "active")
    .order("price", { ascending: true })

  // Last 30 sales
  const { data: sales } = await db
    .from("sales")
    .select("price, sold_at")
    .eq("item_id", item.id)
    .order("sold_at", { ascending: false })
    .limit(30)

  return NextResponse.json({
    item,
    circulation: circulation ?? 0,
    owners: ownerList,
    listings: listings ?? [],
    sales: (sales ?? []).reverse(),
  })
}
