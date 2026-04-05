import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createNotification } from "@/lib/notifications"

// POST /api/oauth/spend
// Body: { token, amount }
// Deducts amount from authorized user, sends to app owner. Amount must be > 0.
export async function POST(req: Request) {
  const { token, amount } = await req.json()

  if (!token || amount === undefined) {
    return NextResponse.json({ error: "token and amount required" }, { status: 400 })
  }

  const spend = Number(amount)
  if (!isFinite(spend) || spend <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 })
  }

  const db = await createClient()

  // Resolve token → app + user
  const { data: tok } = await db
    .from("oauth_tokens")
    .select("user_id, scopes, app_id, oauth_apps(name, user_id)")
    .eq("token", token)
    .single()

  if (!tok) return NextResponse.json({ error: "Invalid or revoked token" }, { status: 401 })
  if (!tok.scopes.includes("spend_balance")) {
    return NextResponse.json({ error: "Token does not have spend_balance scope" }, { status: 403 })
  }

  const app      = tok.oauth_apps as any
  const ownerId  = app.user_id as string
  const appName  = app.name as string

  // Fetch spender balance
  const { data: spender } = await db
    .from("users")
    .select("balance")
    .eq("id", tok.user_id)
    .single()

  if (!spender) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const currentBal = Number(spender.balance)
  if (currentBal < spend) {
    return NextResponse.json({ error: "Insufficient balance" }, { status: 402 })
  }

  const spenderNewBal = parseFloat((currentBal - spend).toFixed(2))

  // Deduct from spender
  await db.from("users").update({ balance: spenderNewBal }).eq("id", tok.user_id)

  // Credit app owner (only if owner !== spender)
  if (ownerId !== tok.user_id) {
    const { data: owner } = await db.from("users").select("balance").eq("id", ownerId).single()
    if (owner) {
      const ownerNewBal = parseFloat((Number(owner.balance) + spend).toFixed(2))
      await db.from("users").update({ balance: ownerNewBal }).eq("id", ownerId)
    }
  }

  // Update token last_used_at
  await db.from("oauth_tokens").update({ last_used_at: new Date().toISOString() }).eq("token", token)

  // Notify spender
  await createNotification({
    user_id: tok.user_id,
    type: "oauth_spend",
    title: `${appName} spent $${spend.toFixed(2)}`,
    body: `${appName} has spent $${spend.toFixed(2)} from your balance.`,
  })

  // Notify owner they received the funds (only if different user)
  if (ownerId !== tok.user_id) {
    await createNotification({
      user_id: ownerId,
      type: "oauth_spend",
      title: `Received $${spend.toFixed(2)} via ${appName}`,
      body: `A user redeemed $${spend.toFixed(2)} through ${appName} and it was sent to your account.`,
    })
  }

  return NextResponse.json({ ok: true, spent: spend, new_balance: spenderNewBal })
}
