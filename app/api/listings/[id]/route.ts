import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createNotification } from "@/lib/notifications"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listing_id } = await params
  const { buyer_id } = await request.json()
  const supabase = await createClient()

  const { data: listing } = await supabase
    .from("listings")
    .select("*, items(name, market_price)")
    .eq("id", listing_id)
    .eq("status", "active")
    .single()

  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 })
  if (listing.seller_id === buyer_id) {
    return NextResponse.json({ error: "Cannot buy your own listing" }, { status: 400 })
  }

  const { data: buyer } = await supabase
    .from("users")
    .select("id, balance")
    .eq("id", buyer_id)
    .single()

  if (!buyer) return NextResponse.json({ error: "Buyer not found" }, { status: 404 })
  if (Number(buyer.balance) < listing.price) {
    return NextResponse.json({ error: "Insufficient balance" }, { status: 402 })
  }

  // Transfer balance (no fee on P2P trades)
  await supabase
    .from("users")
    .update({ balance: Number(buyer.balance) - listing.price })
    .eq("id", buyer_id)

  const { data: seller } = await supabase
    .from("users")
    .select("balance")
    .eq("id", listing.seller_id)
    .single()

  await supabase
    .from("users")
    .update({ balance: Number(seller!.balance) + listing.price })
    .eq("id", listing.seller_id)

  // Transfer inventory
  await supabase
    .from("inventory")
    .update({ user_id: buyer_id })
    .eq("id", listing.inventory_id)

  // Mark listing sold
  await supabase
    .from("listings")
    .update({ status: "sold" })
    .eq("id", listing_id)

  // Record sale
  await supabase
    .from("sales")
    .insert({
      item_id: listing.item_id,
      seller_id: listing.seller_id,
      buyer_id,
      price: listing.price,
    })

  // Notify seller their item sold — link to the item page, not user profile
  await createNotification({
    user_id: listing.seller_id,
    type: "item_sold",
    title: "Item Sold",
    body: `Your listing sold for $${Number(listing.price).toFixed(2)}.`,
    link: `/item/${encodeURIComponent((listing.items as any)?.name ?? listing.item_id)}`,
  })

  // Update item RAP and market_price to AVERAGE of ALL sales (paginated past 1000)
  // Fetch all sales in pages of 1000
  let allSales: { price: number }[] = []
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data: page } = await supabase
      .from("sales")
      .select("price")
      .eq("item_id", listing.item_id)
      .range(from, from + PAGE - 1)
    if (!page || page.length === 0) break
    allSales = allSales.concat(page)
    if (page.length < PAGE) break
    from += PAGE
  }

  if (allSales.length > 0) {
    const avgPrice = Math.round(
      (allSales.reduce((sum, s) => sum + Number(s.price), 0) / allSales.length) * 100
    ) / 100
    await supabase
      .from("items")
      .update({ market_price: avgPrice, rap: avgPrice })
      .eq("id", listing.item_id)
  }

  return NextResponse.json({ success: true })
}

// DELETE: Cancel listing
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listing_id } = await params
  const { user_id } = await request.json()
  const supabase = await createClient()

  const { error } = await supabase
    .from("listings")
    .update({ status: "cancelled" })
    .eq("id", listing_id)
    .eq("seller_id", user_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
