import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// NOWPayments IPN webhook
export async function POST(request: Request) {
  const body = await request.json()
  const { payment_id, payment_status, price_amount } = body

  if (payment_status !== "finished" && payment_status !== "confirmed") {
    return NextResponse.json({ ok: true })
  }

  const supabase = await createClient()

  // Find deposit
  const { data: deposit } = await supabase
    .from("deposits")
    .select("*")
    .eq("payment_id", payment_id)
    .single()

  if (!deposit || deposit.status === "confirmed") {
    return NextResponse.json({ ok: true })
  }

  // Credit user
  const { data: user } = await supabase
    .from("users")
    .select("balance, username")
    .eq("id", deposit.user_id)
    .single()

  if (user) {
    await supabase
      .from("users")
      .update({ balance: Number(user.balance) + Number(price_amount || deposit.amount_usd) })
      .eq("id", deposit.user_id)

    await supabase
      .from("deposits")
      .update({ status: "confirmed", amount_usd: price_amount || deposit.amount_usd })
      .eq("payment_id", payment_id)
  }

  return NextResponse.json({ ok: true })
}
