import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("query")?.trim() ?? ""
  const db = createClient()

  const q = query.toLowerCase()

  // Items
  let itemsQuery = db.from("items").select("id, name, image_url, rarity, rap, market_price, likelihood")
  if (q) itemsQuery = itemsQuery.ilike("name", `%${q}%`)
  const { data: items } = await itemsQuery.order("rap", { ascending: false }).limit(20)

  // Users
  let usersQuery = db.from("users").select("id, username, profile_picture")
  if (q) usersQuery = usersQuery.ilike("username", `%${q}%`)
  const { data: users } = await usersQuery.limit(20)

  // Listings (active only)
  let listingsQuery = db
    .from("listings")
    .select("id, price, status, item_id, seller_id, items(id, name, image_url, rarity), users(id, username)")
    .eq("status", "active")
  if (q) {
    // filter in-memory since ilike on joined table isn't straightforward
  }
  const { data: listingsRaw } = await listingsQuery.order("created_at", { ascending: false }).limit(100)

  const listings = q
    ? (listingsRaw || []).filter((l: any) => l.items?.name?.toLowerCase().includes(q))
    : (listingsRaw || [])

  return NextResponse.json({
    items: items || [],
    users: users || [],
    listings: listings.slice(0, 20),
  })
}
