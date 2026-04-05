import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/battles — list waiting battles
export async function GET() {
  const db = await createClient()

  const { data: battles } = await db
    .from("battles")
    .select("id, creator_id, case_count, created_at, status, exclusive")
    .eq("status", "waiting")
    .order("created_at", { ascending: false })
    .limit(50)

  if (!battles || battles.length === 0) {
    return NextResponse.json({ battles: [] })
  }

  const creatorIds = [...new Set(battles.map((b) => b.creator_id))]
  const { data: users } = await db
    .from("users")
    .select("id, username, profile_picture, plus")
    .in("id", creatorIds)

  const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]))

  return NextResponse.json({
    battles: battles.map((b) => ({ ...b, creator: userMap[b.creator_id] ?? null })),
  })
}

// POST /api/battles — create a battle and deduct cases from creator
export async function POST(req: Request) {
  const db = await createClient()

  let body: { user_id: string; case_count: number; exclusive?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { user_id, case_count, exclusive = false } = body
  if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 })
  if (!Number.isInteger(case_count) || case_count < 1 || case_count > 50) {
    return NextResponse.json({ error: "case_count must be between 1 and 50" }, { status: 400 })
  }

  const caseCost = case_count * (exclusive ? 100 : 1)

  const { data: user } = await db
    .from("users")
    .select("id, cases_remaining")
    .eq("id", user_id)
    .single()

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if ((user.cases_remaining ?? 0) < caseCost) {
    return NextResponse.json({ error: "Not enough cases" }, { status: 402 })
  }

  const { error: deductErr } = await db
    .from("users")
    .update({ cases_remaining: user.cases_remaining - caseCost })
    .eq("id", user_id)

  if (deductErr) return NextResponse.json({ error: deductErr.message }, { status: 500 })

  const { data: battle, error: battleErr } = await db
    .from("battles")
    .insert({ creator_id: user_id, case_count, exclusive, status: "waiting" })
    .select()
    .single()

  if (battleErr || !battle) {
    // Refund on failure
    await db.from("users").update({ cases_remaining: user.cases_remaining }).eq("id", user_id)
    return NextResponse.json({ error: "Failed to create battle" }, { status: 500 })
  }

  return NextResponse.json({ battle })
}
