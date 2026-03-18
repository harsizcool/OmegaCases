import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const PLUS_PRICE = 2.99
const PLUS_BONUS_CASES = 250

export async function POST(req: Request) {
  const db = await createClient()
  const { user_id } = await req.json()

  if (!user_id) return NextResponse.json({ error: "Missing user_id" }, { status: 400 })

  const { data: user, error: userError } = await db
    .from("users")
    .select("id, balance, plus, cases_remaining")
    .eq("id", user_id)
    .single()

  if (userError || !user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if (user.plus) return NextResponse.json({ error: "You already have OmegaCases Plus" }, { status: 400 })
  if (Number(user.balance) < PLUS_PRICE)
    return NextResponse.json({ error: "Insufficient balance. You need $2.99." }, { status: 400 })

  const { data: updated, error: updateError } = await db
    .from("users")
    .update({
      plus: true,
      balance: Number((Number(user.balance) - PLUS_PRICE).toFixed(2)),
      cases_remaining: Number(user.cases_remaining ?? 0) + PLUS_BONUS_CASES,
    })
    .eq("id", user_id)
    .select("*")
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ user: updated })
}
