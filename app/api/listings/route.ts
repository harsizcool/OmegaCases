import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getRarityPriceCaps } from "@/lib/game-settings"

const MAX_LISTING_PRICE = 800

const PAGE_SIZE = 24

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const rarity = searchParams.get("rarity")  // comma-separated or single
  const minPrice = searchParams.get("minPrice")
  const maxPrice = searchParams.get("maxPrice")
  const search = searchParams.get("search")
  const sellerSearch = searchParams.get("sellerSearch")
  const sortBy = searchParams.get("sortBy") || "created_at"
  const sortDir = searchParams.get("sortDir") === "asc"
  const excludeSeller = searchParams.get("excludeSeller")
  const showSold = searchParams.get("showSold") === "true"
  const page = Math.max(0, parseInt(searchParams.get("page") || "0", 10))
  // limit=10000 used by sell dialog to get all active listings for exclusion check
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : PAGE_SIZE

  const db = await createClient()

  if (id) {
    const { data, error } = await db
      .from("listings")
      .select("*, items(*), users(id, username, profile_picture)")
      .eq("id", id)
      .single()
    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { count: supplyCount } = await db
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("item_id", data.item_id)
      .eq("status", "active")

    return NextResponse.json({ ...data, supply_count: supplyCount ?? 0 })
  }

  let query = db
    .from("listings")
    .select("*, items(*), users(id, username, profile_picture)", { count: "exact" })
    .order(sortBy === "price" ? "price" : "created_at", { ascending: sortDir })

  if (showSold) {
    query = query.in("status", ["active", "sold"])
  } else {
    query = query.eq("status", "active")
  }

  if (minPrice) query = query.gte("price", parseFloat(minPrice))
  if (maxPrice) query = query.lte("price", parseFloat(maxPrice))
  if (excludeSeller) query = query.neq("seller_id", excludeSeller)

  // Rarity filter: push to DB so it reduces row count before pagination
  if (rarity) {
    const rarityList = rarity.split(",").map((r) => r.trim()).filter(Boolean)
    if (rarityList.length > 0) {
      // Filter via joined items table
      query = query.in("items.rarity", rarityList)
    }
  }

  // Apply pagination
  if (limit <= 1000) {
    // Normal paginated response
    const from = page * limit
    query = query.range(from, from + limit - 1)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let listings = data || []
    if (search) {
      const s = search.toLowerCase()
      listings = listings.filter((l: any) => l.items?.name?.toLowerCase().includes(s))
    }
    if (sellerSearch) {
      const ss = sellerSearch.toLowerCase()
      listings = listings.filter((l: any) => l.users?.username?.toLowerCase().includes(ss))
    }
    if (rarity) {
      const rarityList = rarity.split(",").map((r) => r.trim()).filter(Boolean)
      listings = listings.filter((l: any) => rarityList.includes(l.items?.rarity))
    }

    return NextResponse.json({ listings, total: count ?? 0, page, pageSize: limit })
  }

  // limit > 1000: internal bulk fetch — loop through all pages to bypass Supabase 1000-row cap
  // Used by sell dialog to get all active listings for exclusion checking
  let allListings: any[] = []
  let offset = 0
  const BATCH = 1000
  // Remove count: exact for bulk fetch to avoid overhead — use plain select
  const bulkQuery = db
    .from("listings")
    .select("*, items(*), users(id, username, profile_picture)")
    .eq("status", "active")
    .order("created_at", { ascending: false })

  while (true) {
    const { data: batch, error } = await bulkQuery.range(offset, offset + BATCH - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!batch || batch.length === 0) break
    allListings = allListings.concat(batch)
    if (batch.length < BATCH) break
    offset += BATCH
  }

  return NextResponse.json(allListings)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { seller_id, inventory_id, item_id, price } = body

  const db = await createClient()

  const { data: inv } = await db
    .from("inventory")
    .select("*")
    .eq("id", inventory_id)
    .eq("user_id", seller_id)
    .single()

  if (!inv) return NextResponse.json({ error: "Item not in your inventory" }, { status: 403 })

  const { data: itemData } = await db.from("items").select("rarity").eq("id", item_id).single()
  const rarity = itemData?.rarity ?? "Omega"

  // Read caps from DB (falls back to defaults if DB unavailable)
  const caps = await getRarityPriceCaps()
  const cap = caps[rarity] ?? MAX_LISTING_PRICE

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
