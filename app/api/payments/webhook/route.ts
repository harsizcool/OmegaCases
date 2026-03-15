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

  const { payment_id, payment_status, price_amount, actually_paid, order_id } = body

  if (!CONFIRMED_STATUSES.includes(payment_status)) {
    return NextResponse.json({ ok: true })
  }

  const supabase = createClient()

  let deposit: any = null

  // 1. Try by payment_id (most reliable)
  if (payment_id) {
    const { data } = await supabase
      .from("deposits")
      .select("*")
      .eq("payment_id", String(payment_id))
      .maybeSingle()
    deposit = data
  }

  // 2. Fallback: extract user_id from order_id (format: oc_{user_id}_{timestamp})
  if (!deposit && typeof order_id === "string" && order_id.startsWith("oc_")) {
    const parts = order_id.split("_")
    // uuid contains hyphens so rejoin middle parts: parts[0]="oc", last=timestamp
    const userId = parts.slice(1, -1).join("_")
    const { data } = await supabase
      .from("deposits")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    deposit = data
  }

  if (!deposit) return NextResponse.json({ ok: true })
  if (deposit.status === "confirmed") return NextResponse.json({ ok: true })

  // Credit the USD value that was actually paid
  const creditAmount = Number(price_amount || deposit.amount_usd)

  const { data: userRow } = await supabase
    .from("users")
    .select("balance")
    .eq("id", deposit.user_id)
    .single()

  if (!userRow) return NextResponse.json({ ok: true })

  const newBalance = Number(userRow.balance) + creditAmount

  await Promise.all([
    supabase
      .from("users")
      .update({ balance: newBalance })
      .eq("id", deposit.user_id),
    supabase
      .from("deposits")
      .update({ status: "confirmed", amount_usd: creditAmount })
      .eq("id", deposit.id),
  ])

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
