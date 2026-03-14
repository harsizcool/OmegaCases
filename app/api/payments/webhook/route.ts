import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const CONFIRMED_STATUSES = ["finished", "confirmed", "complete", "partially_paid"]

// NOWPayments IPN webhook
export async function POST(request: Request) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const { payment_id, payment_status, price_amount, actually_paid, order_id } = body

  // Only credit on confirmed statuses
  if (!CONFIRMED_STATUSES.includes(payment_status)) {
    return NextResponse.json({ ok: true })
  }

  const supabase = await createClient()

  // Try finding deposit by payment_id first, fallback to order_id
  let deposit: any = null

  const { data: byPaymentId } = await supabase
    .from("deposits")
    .select("*")
    .eq("payment_id", String(payment_id))
    .maybeSingle()

  if (byPaymentId) {
    deposit = byPaymentId
  } else if (order_id) {
    // order_id format: oc_{user_id}_{timestamp}
    const { data: byOrderId } = await supabase
      .from("deposits")
      .select("*")
      .eq("payment_id", String(payment_id))
      .maybeSingle()
    deposit = byOrderId

    // Last resort: match by user_id from order_id + pending status
    if (!deposit && typeof order_id === "string" && order_id.startsWith("oc_")) {
      const parts = order_id.split("_")
      const userId = parts[1]
      const { data: byUser } = await supabase
        .from("deposits")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      deposit = byUser
    }
  }

  if (!deposit) {
    return NextResponse.json({ ok: true })
  }

  // Already confirmed — skip to avoid double credit
  if (deposit.status === "confirmed") {
    return NextResponse.json({ ok: true })
  }

  const creditAmount = Number(actually_paid || price_amount || deposit.amount_usd)

  const { data: user } = await supabase
    .from("users")
    .select("balance, username")
    .eq("id", deposit.user_id)
    .single()

  if (!user) return NextResponse.json({ ok: true })

  await Promise.all([
    supabase
      .from("users")
      .update({ balance: Number(user.balance) + creditAmount })
      .eq("id", deposit.user_id),
    supabase
      .from("deposits")
      .update({ status: "confirmed", amount_usd: creditAmount })
      .eq("id", deposit.id),
  ])

  return NextResponse.json({ ok: true })
}
