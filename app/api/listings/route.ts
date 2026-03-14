import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const MAX_LISTING_PRICE = 800

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

  const supabase = await createClient()

  // Single listing fetch for /listing/[id] page
  if (id) {
    const { data, error } = await supabase
      .from("listings")
      .select("*, items(*), users(id, username, profile_picture)")
      .eq("id", id)
      .single()
    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(data)
  }

  let query = supabase
    .from("listings")
    .select("*, items(*), users(id, username, profile_picture)")
    .eq("status", "active")
    .order(sortBy === "price" ? "price" : "created_at", { ascending: sortDir })

  if (minPrice) query = query.gte("price", parseFloat(minPrice))
  if (maxPrice) query = query.lte("price", parseFloat(maxPrice))

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

  const sb = await createClient()

  // Verify inventory ownership
  const { data: inv } = await sb
    .from("inventory")
    .select("*")
    .eq("id", inventory_id)
    .eq("user_id", seller_id)
    .single()

  if (!inv) return NextResponse.json({ error: "Item not in your inventory" }, { status: 403 })

  if (price > MAX_LISTING_PRICE) {
    return NextResponse.json({ error: `Max listing price is $${MAX_LISTING_PRICE}` }, { status: 400 })
  }
  if (price <= 0) {
    return NextResponse.json({ error: "Price must be greater than 0" }, { status: 400 })
  }

  // Check not already listed
  const { data: existing } = await sb
    .from("listings")
    .select("id")
    .eq("inventory_id", inventory_id)
    .eq("status", "active")
    .single()

  if (existing) return NextResponse.json({ error: "Item already listed" }, { status: 400 })

  const { data, error } = await sb
    .from("listings")
    .insert({ seller_id, item_id, inventory_id, price })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
