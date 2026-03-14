import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const NOWPAYMENTS_API = "https://api.nowpayments.io/v1"

// POST: Create payment for deposit
export async function POST(request: Request) {
  const { user_id, amount, currency } = await request.json()

  const res = await fetch(`${NOWPAYMENTS_API}/payment`, {
    method: "POST",
    headers: {
      "x-api-key": process.env.NOWPAYMENTS_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_amount: amount,
      price_currency: "usd",
      pay_currency: currency.toLowerCase(),
      order_description: `OmegaCases deposit for user ${user_id}`,
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    return NextResponse.json({ error: data.message || "Payment creation failed" }, { status: 500 })
  }

  // Record pending deposit
  const supabase = await createClient()
  await supabase.from("deposits").insert({
    user_id,
    payment_id: data.payment_id,
    amount_usd: amount,
    crypto: currency,
    status: "pending",
  })

  return NextResponse.json({
    payment_id: data.payment_id,
    pay_address: data.pay_address,
    pay_amount: data.pay_amount,
    pay_currency: data.pay_currency,
  })
}
