import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/zites — average price, last price, best bid/ask, 24h volume
export async function GET() {
  const db = await createClient()

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [{ data: recentTrades }, { data: dayTrades }, { data: lastPriceSetting }, { data: bestBid }, { data: bestAsk }] =
    await Promise.all([
      db.from("zites_trades").select("price").order("executed_at", { ascending: false }).limit(50),
      db.from("zites_trades").select("price, quantity").gte("executed_at", oneDayAgo),
      db.from("game_settings").select("value").eq("key", "zites_last_price").single(),
      db.from("zites_orders").select("price").eq("side", "buy").in("status", ["open", "partial"]).order("price", { ascending: false }).limit(1).maybeSingle(),
      db.from("zites_orders").select("price").eq("side", "sell").in("status", ["open", "partial"]).order("price", { ascending: true }).limit(1).maybeSingle(),
    ])

  const averagePrice =
    recentTrades && recentTrades.length > 0
      ? recentTrades.reduce((sum: number, t: any) => sum + Number(t.price), 0) / recentTrades.length
      : Number(lastPriceSetting?.value ?? 0.05)

  const volume24h = (dayTrades ?? []).reduce((sum: number, t: any) => sum + Number(t.quantity), 0)

  return NextResponse.json({
    average_price: averagePrice,
    last_price: Number(lastPriceSetting?.value ?? averagePrice),
    best_bid: bestBid?.price ? Number(bestBid.price) : null,
    best_ask: bestAsk?.price ? Number(bestAsk.price) : null,
    volume_24h: volume24h,
  })
}
