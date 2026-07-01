import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/zites/trades?limit=50 — recent executed trades feed
export async function GET(req: Request) {
  const db = await createClient()
  const { searchParams } = new URL(req.url)
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)))

  const { data, error } = await db
    .from("zites_trades")
    .select("*")
    .order("executed_at", { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ trades: data ?? [] })
}
