import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createNotification } from "@/lib/notifications"

// POST /api/oauth/listings/buy
// Body: { token, listing_id }
// Buys a marketplace listing on behalf of the authorized user. Requires buy_listing scope.
export async function POST(req: Request) {
  const { token, listing_id } = await req.json()
  if (!token || !listing_id) {
    return NextResponse.json({ error: "token and listing_id required" }, { status: 400 })
  }

  const db = await createClient()

  // Resolve token
  const { data: tok } = await db
    .from("oauth_tokens")
    .select("user_id, scopes")
    .eq("token", token)
    .single()

  if (!tok) return NextResponse.json({ error: "Invalid or revoked token" }, { status: 401 })
  if (!tok.scopes.includes("buy_listing")) {
    return NextResponse.json({ error: "Token does not have buy_listing scope" }, { status: 403 })
  }

  const buyer_id = tok.user_id

  const { data: listing } = await db
    .from("listings")
    .select("*, items(name, market_price)")
    .eq("id", listing_id)
    .eq("status", "active")
    .single()

  if (!listing) return NextResponse.json({ error: "Listing not found or already sold" }, { status: 404 })
  if (listing.seller_id === buyer_id) {
    return NextResponse.json({ error: "Cannot buy your own listing" }, { status: 400 })
  }

  const { data: buyer } = await db
    .from("users")
    .select("id, balance")
    .eq("id", buyer_id)
    .single()

  if (!buyer) return NextResponse.json({ error: "Buyer not found" }, { status: 404 })
  if (Number(buyer.balance) < listing.price) {
    return NextResponse.json({ error: "Insufficient balance" }, { status: 402 })
  }

  // Deduct buyer
  await db.from("users")
    .update({ balance: Number(buyer.balance) - listing.price })
    .eq("id", buyer_id)

  // Credit seller
  const { data: seller } = await db.from("users").select("balance").eq("id", listing.seller_id).single()
  if (seller) {
    await db.from("users")
      .update({ balance: Number(seller.balance) + listing.price })
      .eq("id", listing.seller_id)
  }

  // Transfer inventory item to buyer
  await db.from("inventory").update({ user_id: buyer_id }).eq("id", listing.inventory_id)

  // Mark listing sold
  await db.from("listings").update({ status: "sold" }).eq("id", listing_id)

  // Record sale
  await db.from("sales").insert({
    item_id:   listing.item_id,
    seller_id: listing.seller_id,
    buyer_id,
    price:     listing.price,
  })

  // Update token last_used_at
  await db.from("oauth_tokens").update({ last_used_at: new Date().toISOString() }).eq("token", token)

  // Notify seller
  await createNotification({
    user_id: listing.seller_id,
    type: "item_sold",
    title: "Item Sold",
    body: `Your listing sold for $${Number(listing.price).toFixed(2)}.`,
    link: `/item/${encodeURIComponent((listing.items as any)?.name ?? listing.item_id)}`,
  })

  return NextResponse.json({
    ok: true,
    item_name: (listing.items as any)?.name ?? "Unknown",
    price:     listing.price,
    new_balance: Number(buyer.balance) - listing.price,
  })
}
