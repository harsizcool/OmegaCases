import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const MAX_LISTING_PRICE = 800

export const RARITY_PRICE_CAPS: Record<string, number> = {
  Common: 0.04,
  Uncommon: 0.10,
  Rare: 0.40,
  Legendary: 2.00,
  Omega: MAX_LISTING_PRICE,
}

// GET: All active listings (with optional filters), or single listing by ?id=
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const rarity = searchParams.get("rarity")
  const minPrice = searchParams.get("minPrice")
  const maxPrice = searchParams.get("maxPrice")
  const search = searchParams.get("search")
  const sortBy = searchParams.get("sortBy") || "created_at"
  const sortDir = searchParams.get("sortDir") === "asc"
  const excludeSeller = searchParams.get("excludeSeller")
  const showSold = searchParams.get("showSold") === "true"

  const db = createClient()

  // Single listing fetch for /listing/[id] page — includes supply count
  if (id) {
    const { data, error } = await db
      .from("listings")
      .select("*, items(*), users(id, username, profile_picture)")
      .eq("id", id)
      .single()
    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // Count active supply for this item
    const { count: supplyCount } = await db
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("item_id", data.item_id)
      .eq("status", "active")

    return NextResponse.json({ ...data, supply_count: supplyCount ?? 0 })
  }

  let query = db
    .from("listings")
    .select("*, items(*), users(id, username, profile_picture)")
    .order(sortBy === "price" ? "price" : "created_at", { ascending: sortDir })

  if (showSold) {
    query = query.in("status", ["active", "sold"])
  } else {
    query = query.eq("status", "active")
  }

  if (minPrice) query = query.gte("price", parseFloat(minPrice))
  if (maxPrice) query = query.lte("price", parseFloat(maxPrice))
  if (excludeSeller) query = query.neq("seller_id", excludeSeller)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let listings = data || []

  if (rarity) {
    listings = listings.filter((l: any) => l.items?.rarity === rarity)
  }
  if (search) {
    const s = search.toLowerCase()
    listings = listings.filter((l: any) => l.items?.name?.toLowerCase().includes(s))
  }

  return NextResponse.json(listings)
}

// POST: Create listing
export async function POST(request: Request) {
  const body = await request.json()
  const { seller_id, inventory_id, item_id, price } = body

  const db = createClient()

  const { data: inv } = await db
    .from("inventory")
    .select("*")
    .eq("id", inventory_id)
    .eq("user_id", seller_id)
    .single()

  if (!inv) return NextResponse.json({ error: "Item not in your inventory" }, { status: 403 })

  // Fetch item rarity to enforce per-rarity cap
  const { data: itemData } = await db.from("items").select("rarity").eq("id", item_id).single()
  const rarity = itemData?.rarity ?? "Omega"
  const cap = RARITY_PRICE_CAPS[rarity] ?? MAX_LISTING_PRICE

  if (price > cap) {
    return NextResponse.json({ error: `Max listing price for ${rarity} items is $${cap.toFixed(2)}` }, { status: 400 })
  }
  if (price <= 0) {
    return NextResponse.json({ error: "Price must be greater than 0" }, { status: 400 })
  }

  const { data: existing } = await db
    .from("listings")
    .select("id")
    .eq("inventory_id", inventory_id)
    .eq("status", "active")
    .single()

  if (existing) return NextResponse.json({ error: "Item already listed" }, { status: 400 })

  const { data, error } = await db
    .from("listings")
    .insert({ seller_id, item_id, inventory_id, price })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
