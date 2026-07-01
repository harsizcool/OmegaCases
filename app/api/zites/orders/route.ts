import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { matchOrder } from "@/lib/zites-matching"

const MIN_QUANTITY = 0.0001

// GET /api/zites/orders?user_id=... — the calling user's orders (open + recent)
export async function GET(req: Request) {
  const db = await createClient()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("user_id")
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 })

  const { data, error } = await db
    .from("zites_orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orders: data ?? [] })
}

// POST /api/zites/orders — place a market or limit buy/sell order
export async function POST(req: Request) {
  const db = await createClient()

  let body: { user_id: string; side: "buy" | "sell"; order_type: "market" | "limit"; price?: number; quantity: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { user_id, side, order_type, quantity } = body
  const price = body.price !== undefined ? Number(body.price) : null

  if (!user_id || !side || !order_type || !quantity) {
    return NextResponse.json({ error: "user_id, side, order_type, and quantity are required" }, { status: 400 })
  }
  if (!["buy", "sell"].includes(side)) return NextResponse.json({ error: "side must be buy or sell" }, { status: 400 })
  if (!["market", "limit"].includes(order_type)) return NextResponse.json({ error: "order_type must be market or limit" }, { status: 400 })
  if (Number(quantity) < MIN_QUANTITY) return NextResponse.json({ error: `Quantity must be at least ${MIN_QUANTITY}` }, { status: 400 })
  if (order_type === "limit" && (!price || price <= 0)) {
    return NextResponse.json({ error: "Limit orders require a price greater than 0" }, { status: 400 })
  }

  const { data: user } = await db.from("users").select("id, balance, zites_balance").eq("id", user_id).single()
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  if (side === "sell" && Number(user.zites_balance) < Number(quantity)) {
    return NextResponse.json({ error: "Insufficient Zites balance" }, { status: 400 })
  }

  if (side === "buy") {
    // For a market buy we can't know the exact fill price up front, so just require
    // the user to have at least enough balance for the requested quantity at the
    // best available ask (or the limit price for limit orders).
    let estimatePrice = price
    if (estimatePrice === null) {
      const { data: bestAsk } = await db
        .from("zites_orders")
        .select("price")
        .eq("side", "sell")
        .in("status", ["open", "partial"])
        .order("price", { ascending: true })
        .limit(1)
        .maybeSingle()
      estimatePrice = bestAsk?.price ? Number(bestAsk.price) : 0
    }
    if (estimatePrice && Number(user.balance) < estimatePrice * Number(quantity)) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })
    }
  }

  const { data: inserted, error: insertError } = await db
    .from("zites_orders")
    .insert({
      user_id,
      side,
      order_type,
      price: order_type === "limit" ? price : null,
      quantity: Number(quantity),
      remaining_quantity: Number(quantity),
      status: "open",
    })
    .select()
    .single()

  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message ?? "Failed to place order" }, { status: 500 })
  }

  const result = await matchOrder(db, {
    id: inserted.id,
    user_id: inserted.user_id,
    side: inserted.side,
    order_type: inserted.order_type,
    price: inserted.price !== null ? Number(inserted.price) : null,
    quantity: Number(inserted.quantity),
    remaining_quantity: Number(inserted.remaining_quantity),
  })

  const { data: finalOrder } = await db.from("zites_orders").select("*").eq("id", inserted.id).single()

  return NextResponse.json({ success: true, order: finalOrder ?? inserted, filled: result.filledQuantity, trades: result.trades })
}
