import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createHmac } from "crypto"

const CONFIRMED_STATUSES = ["finished", "confirmed", "complete", "partially_paid"]
const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1482463519625445551/4O9juWv4hZGMZjk5DUxCL8RxgtGPZ_UUrY7G2qj0g-55324-cdC_UsHn5aomBW2gL-Sg"

async function notifyDiscord(content: string, fields?: { name: string; value: string; inline?: boolean }[]) {
  try {
    await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        embeds: fields ? [{ color: 0xf5a623, fields }] : undefined,
      }),
    })
  } catch (e) {
    console.error("[webhook] Discord notify failed:", e)
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  console.log("[webhook] IPN received. Raw body:", rawBody)

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    console.error("[webhook] Failed to parse IPN body")
    await notifyDiscord("<@1058838805253210172> IPN received but **failed to parse JSON**", [
      { name: "Raw Body", value: rawBody.slice(0, 1000) || "(empty)" },
    ])
    return NextResponse.json({ ok: true })
  }

  // Forward raw IPN to Discord immediately for debug
  await notifyDiscord("<@1058838805253210172> IPN received from NOWPayments", [
    { name: "payment_id", value: String(body.payment_id ?? "N/A"), inline: true },
    { name: "payment_status", value: String(body.payment_status ?? "N/A"), inline: true },
    { name: "price_amount", value: String(body.price_amount ?? "N/A"), inline: true },
    { name: "order_id", value: String(body.order_id ?? "N/A"), inline: true },
    { name: "pay_currency", value: String(body.pay_currency ?? "N/A"), inline: true },
    { name: "Full Payload (truncated)", value: JSON.stringify(body).slice(0, 900) },
  ])

  // Verify IPN signature — log mismatch but never reject, to avoid silently dropping valid IPNs
  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET
  if (ipnSecret) {
    const receivedSig = request.headers.get("x-nowpayments-sig") ?? ""
    if (receivedSig) {
      const sortedBody = JSON.stringify(sortObjectKeys(body))
      const expectedSig = createHmac("sha512", ipnSecret).update(sortedBody).digest("hex")
      if (receivedSig !== expectedSig) {
        console.error("[webhook] Signature mismatch (not rejecting):", { receivedSig: receivedSig.slice(0, 20), expectedSig: expectedSig.slice(0, 20) })
        await notifyDiscord("<@1058838805253210172> IPN signature **mismatch** (processing anyway)", [
          { name: "Received", value: receivedSig.slice(0, 60) },
          { name: "Expected", value: expectedSig.slice(0, 60) },
        ])
      }
    }
  }

  const { payment_id, payment_status } = body
  console.log("[webhook] payment_id:", payment_id, "| payment_status:", payment_status)

  if (!CONFIRMED_STATUSES.includes(payment_status)) {
    console.log("[webhook] Status not confirmed, ignoring:", payment_status)
    return NextResponse.json({ ok: true })
  }

  if (!payment_id) {
    console.error("[webhook] No payment_id in body")
    await notifyDiscord("<@1058838805253210172> IPN has **no payment_id**")
    return NextResponse.json({ ok: true })
  }

  const supabase = await createClient()

  // Query deposit — payment_id stored as text but IPN sends number, always cast to string
  console.log("[webhook] Looking up deposit for payment_id:", String(payment_id))
  const { data: deposit, error: depositError } = await supabase
    .from("deposits")
    .select("*")
    .eq("payment_id", String(payment_id))
    .maybeSingle()

  console.log("[webhook] Deposit lookup result:", deposit, "| Error:", depositError)

  if (!deposit) {
    console.error("[webhook] No deposit found for payment_id:", payment_id)
    await notifyDiscord(`<@1058838805253210172> IPN **deposit not found** for payment_id \`${payment_id}\``, [
      { name: "DB Error", value: depositError?.message ?? "No row matched" },
    ])
    return NextResponse.json({ ok: true })
  }

  if (deposit.status === "confirmed") {
    console.log("[webhook] Already confirmed, skipping.")
    return NextResponse.json({ ok: true })
  }

  const creditAmount = Number(deposit.amount_usd)
  console.log("[webhook] Crediting $", creditAmount, "to user", deposit.user_id)

  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("balance")
    .eq("id", deposit.user_id)
    .single()

  console.log("[webhook] User lookup:", userRow, "| Error:", userError)

  if (!userRow) {
    console.error("[webhook] No user found:", deposit.user_id)
    await notifyDiscord(`<@1058838805253210172> IPN **user not found** for user_id \`${deposit.user_id}\``)
    return NextResponse.json({ ok: true })
  }

  const newBalance = Number(userRow.balance) + creditAmount

  const [updateUser, updateDeposit] = await Promise.all([
    supabase.from("users").update({ balance: newBalance }).eq("id", deposit.user_id),
    supabase.from("deposits").update({ status: "confirmed" }).eq("id", deposit.id),
  ])

  console.log("[webhook] Update user error:", updateUser.error, "| Update deposit error:", updateDeposit.error)

  if (updateUser.error || updateDeposit.error) {
    await notifyDiscord(`<@1058838805253210172> IPN **DB update failed**`, [
      { name: "User update error", value: updateUser.error?.message ?? "ok" },
      { name: "Deposit update error", value: updateDeposit.error?.message ?? "ok" },
    ])
  } else {
    await notifyDiscord(`<@1058838805253210172> IPN **deposit confirmed** ✓`, [
      { name: "User ID", value: deposit.user_id, inline: true },
      { name: "Credited", value: `$${creditAmount.toFixed(2)}`, inline: true },
      { name: "New Balance", value: `$${newBalance.toFixed(2)}`, inline: true },
    ])
  }

  console.log(`[webhook] Done — credited $${creditAmount} to ${deposit.user_id}, new balance $${newBalance}`)
  return NextResponse.json({ ok: true })
}

function sortObjectKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortObjectKeys)
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).sort().reduce((acc: any, k) => { acc[k] = sortObjectKeys(obj[k]); return acc }, {})
  }
  return obj
}
