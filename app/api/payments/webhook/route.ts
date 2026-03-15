import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createHmac } from "crypto"

const CONFIRMED_STATUSES = ["finished", "confirmed", "complete", "partially_paid"]

export async function POST(request: Request) {
  const rawBody = await request.text()
  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: true })
  }

  // Verify IPN signature from NOWPayments
  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET
  if (ipnSecret) {
    const receivedSig = request.headers.get("x-nowpayments-sig") ?? ""
    // NOWPayments signs the JSON body sorted by key with HMAC-SHA512
    const sortedBody = JSON.stringify(sortObjectKeys(body))
    const expectedSig = createHmac("sha512", ipnSecret)
      .update(sortedBody)
      .digest("hex")
    if (receivedSig && receivedSig !== expectedSig) {
      console.error("[webhook] Invalid IPN signature — rejecting")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
  }

  const { payment_id, payment_status } = body

  if (!CONFIRMED_STATUSES.includes(payment_status)) {
    return NextResponse.json({ ok: true })
  }

  if (!payment_id) {
    console.error("[webhook] No payment_id in IPN body")
    return NextResponse.json({ ok: true })
  }

  const supabase = await createClient()

  // Look up deposit by payment_id — always cast to string since DB column is text
  // but NOWPayments sends payment_id as a number in the IPN payload
  const { data: deposit } = await supabase
    .from("deposits")
    .select("*")
    .eq("payment_id", String(payment_id))
    .maybeSingle()

  if (!deposit) {
    console.error("[webhook] No deposit found for payment_id:", payment_id)
    return NextResponse.json({ ok: true })
  }
  if (deposit.status === "confirmed") {
    return NextResponse.json({ ok: true })
  }

  // Use the amount stored at deposit creation — never trust IPN for credit amount
  const creditAmount = Number(deposit.amount_usd)

  const { data: userRow } = await supabase
    .from("users")
    .select("balance")
    .eq("id", deposit.user_id)
    .single()

  if (!userRow) {
    console.error("[webhook] No user found for user_id:", deposit.user_id)
    return NextResponse.json({ ok: true })
  }

  const newBalance = Number(userRow.balance) + creditAmount

  await Promise.all([
    supabase
      .from("users")
      .update({ balance: newBalance })
      .eq("id", deposit.user_id),
    supabase
      .from("deposits")
      .update({ status: "confirmed" })
      .eq("id", deposit.id),
  ])

  console.log(`[webhook] Credited $${creditAmount} to user ${deposit.user_id}, new balance: $${newBalance}`)

  return NextResponse.json({ ok: true })
}

// Recursively sort object keys for consistent HMAC signing
function sortObjectKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortObjectKeys)
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj)
      .sort()
      .reduce((acc: any, k) => { acc[k] = sortObjectKeys(obj[k]); return acc }, {})
  }
  return obj
}
