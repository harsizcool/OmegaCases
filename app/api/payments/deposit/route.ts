import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const NOWPAYMENTS_API = "https://api.nowpayments.io/v1"
const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1482463519625445551/4O9juWv4hZGMZjk5DUxCL8RxgtGPZ_UUrY7G2qj0g-55324-cdC_UsHn5aomBW2gL-Sg"

async function notifyDiscord(content: string, fields?: { name: string; value: string; inline?: boolean }[]) {
  try {
    await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, embeds: fields ? [{ color: 0x43a047, fields }] : undefined }),
    })
  } catch {}
}

// POST: Create payment for deposit
export async function POST(request: Request) {
  const supabase = await createClient()

  // Check if deposits are paused
  const { data: pauseSetting } = await supabase
    .from("game_settings")
    .select("value")
    .eq("key", "payments_paused")
    .single()

  const paused = pauseSetting?.value === true || pauseSetting?.value?.deposits === true
  if (paused) {
    return NextResponse.json(
      { error: "Deposits are temporarily paused. Please check back soon." },
      { status: 503 }
    )
  }

  const { user_id, amount, currency } = await request.json()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://omegacases.com"
  const orderId = `oc_${user_id}_${Date.now()}`

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
      ipn_callback_url: `${appUrl}/api/payments/webhook`,
      order_id: orderId,
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    await notifyDiscord("<@1058838805253210172> Deposit creation **failed**", [
      { name: "Error", value: data.message || "Unknown error" },
      { name: "User ID", value: user_id },
      { name: "Amount", value: `$${amount}` },
    ])
    return NextResponse.json({ error: data.message || "Payment creation failed" }, { status: 500 })
  }

  const paymentIdStr = String(data.payment_id)

  const { error: insertError } = await supabase.from("deposits").insert({
    user_id,
    payment_id: paymentIdStr,
    order_id: orderId,
    amount_usd: amount,
    crypto: currency,
    status: "pending",
  })

  await notifyDiscord("<@1058838805253210172> New deposit created", [
    { name: "User ID", value: user_id, inline: true },
    { name: "Amount", value: `$${amount}`, inline: true },
    { name: "Currency", value: currency, inline: true },
    { name: "payment_id stored", value: paymentIdStr, inline: true },
    { name: "order_id stored", value: orderId, inline: true },
    { name: "DB insert error", value: insertError?.message ?? "none", inline: false },
    { name: "pay_address", value: data.pay_address ?? "N/A" },
  ])

  return NextResponse.json({
    payment_id: data.payment_id,
    pay_address: data.pay_address,
    pay_amount: data.pay_amount,
    pay_currency: data.pay_currency,
  })
}
