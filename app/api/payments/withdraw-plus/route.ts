import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const { user_id, method, amount, email } = await req.json()
  if (!user_id || !method || !amount || !email) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  const supabase = createClient()

  // Verify Plus membership
  const { data: user } = await supabase.from("users").select("id, balance, plus").eq("id", user_id).single()
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if (!user.plus) return NextResponse.json({ error: "OmegaCases Plus required" }, { status: 403 })

  // Validate minimums
  if (method === "paypal" && amount < 10) return NextResponse.json({ error: "Minimum PayPal withdrawal is $10.00" }, { status: 400 })
  if ((method === "xbox" || method === "playstation") && amount < 25) return NextResponse.json({ error: "Minimum is $25.00" }, { status: 400 })
  if (Number(user.balance) < amount) return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })

  // Deduct balance and log withdrawal
  const { error: deductErr } = await supabase
    .from("users")
    .update({ balance: Number(user.balance) - amount })
    .eq("id", user_id)

  if (deductErr) return NextResponse.json({ error: deductErr.message }, { status: 500 })

  // Log to withdrawals table if it exists (best-effort)
  await supabase.from("withdrawals").insert({
    user_id,
    method,
    amount,
    email,
    status: "pending",
  }).then(() => {})

  return NextResponse.json({ ok: true })
}
