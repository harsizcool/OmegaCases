import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/zites/book — aggregated order book depth
export async function GET() {
  const db = await createClient()

  const [{ data: buys }, { data: sells }] = await Promise.all([
    db.from("zites_orders").select("price, remaining_quantity").eq("side", "buy").in("status", ["open", "partial"]).order("price", { ascending: false }),
    db.from("zites_orders").select("price, remaining_quantity").eq("side", "sell").in("status", ["open", "partial"]).order("price", { ascending: true }),
  ])

  const aggregate = (rows: any[] | null) => {
    const map = new Map<number, number>()
    for (const r of rows ?? []) {
      if (r.price === null) continue
      const price = Number(r.price)
      map.set(price, (map.get(price) ?? 0) + Number(r.remaining_quantity))
    }
    return Array.from(map.entries()).map(([price, quantity]) => ({ price, quantity }))
  }

  return NextResponse.json({
    bids: aggregate(buys),
    asks: aggregate(sells),
  })
}
