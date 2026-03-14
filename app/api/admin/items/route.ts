import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Admin-only: Create item
export async function POST(request: Request) {
  const body = await request.json()
  const { user_id, name, image_url, rarity, likelihood, market_price } = body

  const supabase = await createClient()

  // Verify admin
  const { data: user } = await supabase
    .from("users")
    .select("admin")
    .eq("id", user_id)
    .single()

  if (!user?.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("items")
    .insert({ name, image_url, rarity, likelihood, market_price, rap: market_price })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// GET: All items
export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase.from("items").select("*").order("rarity").order("name")
  return NextResponse.json(data || [])
}
