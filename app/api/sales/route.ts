import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const itemId = searchParams.get("item_id")
  const supabase = await createClient()

  if (itemId) {
    const { data } = await supabase
      .from("sales")
      .select("price, sold_at, items(name, rarity, image_url)")
      .eq("item_id", itemId)
      .order("sold_at", { ascending: false })
      .limit(50)
    return NextResponse.json(data || [])
  }

  const { data } = await supabase
    .from("sales")
    .select("price, sold_at, items(name, rarity, image_url, id)")
    .order("sold_at", { ascending: false })
    .limit(100)
  return NextResponse.json(data || [])
}
