import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const NOWPAYMENTS_API = "https://api.nowpayments.io/v1"
const CONFIRMED_STATUSES = ["finished", "confirmed", "complete", "partially_paid"]
const TERMINAL_STATUSES = ["finished", "confirmed", "complete", "partially_paid", "failed", "refunded", "expired"]

export async function GET(
  _request: Request,
  { params }: { params: { paymentId: string } }
) {
  const { paymentId } = await params

  // Fetch live status from NOWPayments
  const res = await fetch(`${NOWPAYMENTS_API}/payment/${paymentId}`, {
    headers: { "x-api-key": process.env.NOWPAYMENTS_API_KEY! },
    cache: "no-store",
  })

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch payment status" }, { status: 502 })
  }

  const data = await res.json()
  const status: string = data.payment_status ?? "waiting"

  // If not yet confirmed, just return the status for the poller to keep waiting
  if (!CONFIRMED_STATUSES.includes(status)) {
    return NextResponse.json({ status, terminal: TERMINAL_STATUSES.includes(status) })
  }

  // Status is confirmed — look up deposit and credit user if not already done
  const supabase = await createClient()

  const { data: deposit } = await supabase
    .from("deposits")
    .select("*")
    .eq("payment_id", String(paymentId))
    .maybeSingle()

  if (!deposit) {
    return NextResponse.json({ status, terminal: true, error: "Deposit not found" })
  }

  if (deposit.status === "confirmed") {
    // Already credited (likely by webhook) — just signal done
    return NextResponse.json({ status: "confirmed", terminal: true, already_confirmed: true })
  }

  // Credit the user
  const { data: userRow } = await supabase
    .from("users")
    .select("balance")
    .eq("id", deposit.user_id)
    .single()

  if (!userRow) {
    return NextResponse.json({ status, terminal: true, error: "User not found" })
  }

  const creditAmount = Number(deposit.amount_usd)
  const newBalance = Number(userRow.balance) + creditAmount

  await Promise.all([
    supabase.from("users").update({ balance: newBalance }).eq("id", deposit.user_id),
    supabase.from("deposits").update({ status: "confirmed" }).eq("id", deposit.id),
  ])

  return NextResponse.json({ status: "confirmed", terminal: true, credited: creditAmount, new_balance: newBalance })
}
