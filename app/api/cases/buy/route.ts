import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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

  const { data: user } = await supabase
    .from("users")
    .select("id, balance, cases_remaining")
    .eq("id", user_id)
    .single()

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if (Number(user.balance) < cost) {
    return NextResponse.json({ error: "Insufficient balance" }, { status: 402 })
  }

  const newBalance = Number(user.balance) - cost
  const newRemaining = (user.cases_remaining || 0) + qty

  const { error } = await supabase
    .from("users")
    .update({ balance: newBalance, cases_remaining: newRemaining })
    .eq("id", user_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ newBalance, cases_remaining: newRemaining })
}
