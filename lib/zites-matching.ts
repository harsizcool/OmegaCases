// Zites order book matching engine.
// Called synchronously from POST /api/zites/orders right after a new order is inserted.
// Matches are executed one fill at a time via the execute_zites_trade Postgres function
// (scripts/002_zites_and_pools.sql), which wraps the order updates, both balance updates,
// and the trade insert in a single transaction so concurrent fills cannot race each other.

export interface NewZitesOrder {
  id: string
  user_id: string
  side: "buy" | "sell"
  order_type: "market" | "limit"
  price: number | null
  quantity: number
  remaining_quantity: number
}

export interface MatchResult {
  filledQuantity: number
  trades: { price: number; quantity: number }[]
  finalStatus: "open" | "partial" | "filled" | "cancelled"
}

/** Walks the opposite book in price-time priority and executes fills against `order`. */
export async function matchOrder(db: any, order: NewZitesOrder): Promise<MatchResult> {
  const oppositeSide = order.side === "buy" ? "sell" : "buy"

  let query = db
    .from("zites_orders")
    .select("id, user_id, price, remaining_quantity, created_at")
    .eq("side", oppositeSide)
    .in("status", ["open", "partial"])
    .neq("user_id", order.user_id)

  query = oppositeSide === "sell"
    ? query.order("price", { ascending: true }).order("created_at", { ascending: true })
    : query.order("price", { ascending: false }).order("created_at", { ascending: true })

  const { data: candidates } = await query
  const book: any[] = candidates ?? []

  let remaining = order.remaining_quantity
  const trades: { price: number; quantity: number }[] = []

  for (const resting of book) {
    if (remaining <= 0) break
    const restingPrice = Number(resting.price)

    // Limit orders only cross the book up to their own price.
    if (order.order_type === "limit" && order.price !== null) {
      if (order.side === "buy" && restingPrice > order.price) continue
      if (order.side === "sell" && restingPrice < order.price) continue
    }

    const fillQty = Math.min(remaining, Number(resting.remaining_quantity))
    if (fillQty <= 0) continue

    const buyOrderId = order.side === "buy" ? order.id : resting.id
    const sellOrderId = order.side === "buy" ? resting.id : order.id
    const buyerId = order.side === "buy" ? order.user_id : resting.user_id
    const sellerId = order.side === "buy" ? resting.user_id : order.user_id

    const { error } = await db.rpc("execute_zites_trade", {
      p_buy_order_id: buyOrderId,
      p_sell_order_id: sellOrderId,
      p_buyer_id: buyerId,
      p_seller_id: sellerId,
      p_price: restingPrice,
      p_quantity: fillQty,
    })

    if (error) {
      // Insufficient balance or a concurrent fill already consumed this resting order — skip it.
      continue
    }

    trades.push({ price: restingPrice, quantity: fillQty })
    remaining = Number((remaining - fillQty).toFixed(4))
  }

  const filledQuantity = Number((order.remaining_quantity - remaining).toFixed(4))

  let finalStatus: MatchResult["finalStatus"]
  if (remaining <= 0) {
    finalStatus = "filled"
  } else if (order.order_type === "market") {
    // Market orders never rest on the book — cancel whatever couldn't fill immediately.
    finalStatus = filledQuantity > 0 ? "filled" : "cancelled"
    await db
      .from("zites_orders")
      .update({ remaining_quantity: 0, status: finalStatus, updated_at: new Date().toISOString() })
      .eq("id", order.id)
  } else {
    finalStatus = filledQuantity > 0 ? "partial" : "open"
  }

  return { filledQuantity, trades, finalStatus }
}
