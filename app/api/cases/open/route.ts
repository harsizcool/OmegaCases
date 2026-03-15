import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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
  const { user_id } = await request.json()

  if (!user_id) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: user } = await supabase
    .from("users")
    .select("id, cases, cases_remaining")
    .eq("id", user_id)
    .single()

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if ((user.cases_remaining || 0) < 1) {
    return NextResponse.json({ error: "No cases remaining" }, { status: 402 })
  }

  const { data: items } = await supabase.from("items").select("id, likelihood")
  if (!items || items.length === 0) {
    return NextResponse.json({ error: "No items available" }, { status: 500 })
  }

  const wonItemId = rollItem(items)

  // Decrement cases_remaining, increment total cases opened
  const { error: updateError } = await supabase
    .from("users")
    .update({
      cases_remaining: user.cases_remaining - 1,
      cases: (user.cases || 0) + 1,
    })
    .eq("id", user_id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Add to inventory
  const { error: invError } = await supabase
    .from("inventory")
    .insert({ user_id, item_id: wonItemId })

  if (invError) return NextResponse.json({ error: invError.message }, { status: 500 })

  // Set first_unboxed_by if this item has never been unboxed before
  await supabase
    .from("items")
    .update({ first_unboxed_by: user_id })
    .eq("id", wonItemId)
    .is("first_unboxed_by", null)

  // Return won item details
  const { data: wonItem } = await supabase
    .from("items")
    .select("*")
    .eq("id", wonItemId)
    .single()

  return NextResponse.json({
    wonItem,
    cases_remaining: user.cases_remaining - 1,
  })
}
