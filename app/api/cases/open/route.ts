import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Roll weighted random item server-side
function rollItem(items: { id: string; likelihood: number }[]) {
  const total = items.reduce((sum, i) => sum + Number(i.likelihood), 0)
  let rand = Math.random() * total
  for (const item of items) {
    rand -= Number(item.likelihood)
    if (rand <= 0) return item.id
  }
  return items[items.length - 1].id
}

export async function POST(request: Request) {
  const { user_id, qty } = await request.json()

  if (!user_id || !qty) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  const validQtys: Record<number, number> = { 10: 0.19, 100: 0.79, 1000: 7.99 }
  if (!validQtys[qty]) {
    return NextResponse.json({ error: "Invalid quantity" }, { status: 400 })
  }

  const cost = validQtys[qty]
  const supabase = await createClient()

  // Get user
  const { data: user } = await supabase
    .from("users")
    .select("id, balance, cases")
    .eq("id", user_id)
    .single()

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if (Number(user.balance) < cost) {
    return NextResponse.json({ error: "Insufficient balance" }, { status: 402 })
  }

  // Get all items
  const { data: items } = await supabase
    .from("items")
    .select("id, likelihood")

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "No items available" }, { status: 500 })
  }

  // Roll qty items
  const wonItemIds: string[] = []
  for (let i = 0; i < qty; i++) {
    wonItemIds.push(rollItem(items))
  }

  // Deduct balance, add cases
  const newBalance = Number(user.balance) - cost
  await supabase
    .from("users")
    .update({ balance: newBalance, cases: (user.cases || 0) + qty })
    .eq("id", user_id)

  // Insert inventory
  const inventoryRows = wonItemIds.map((item_id) => ({ user_id, item_id }))
  await supabase.from("inventory").insert(inventoryRows)

  // Return all won items with details (for spinner)
  const uniqueIds = [...new Set(wonItemIds)]
  const { data: itemDetails } = await supabase
    .from("items")
    .select("*")
    .in("id", uniqueIds)

  const itemMap = Object.fromEntries((itemDetails || []).map((i) => [i.id, i]))
  const wonItems = wonItemIds.map((id) => itemMap[id])

  return NextResponse.json({ wonItems, newBalance })
}
