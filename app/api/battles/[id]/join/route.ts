import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createHmac, randomBytes } from "crypto"

function fairFloat(serverSeed: string, clientSeed: string, nonce: number): number {
  const hmac = createHmac("sha256", serverSeed)
  hmac.update(`${clientSeed}:${nonce}:0`)
  return parseInt(hmac.digest("hex").slice(0, 8), 16) / 0x100000000
}

function rollItem(items: { id: string; likelihood: number }[], float: number): string {
  const total = items.reduce((sum, i) => sum + Number(i.likelihood), 0)
  let threshold = float * total
  for (const item of items) {
    threshold -= Number(item.likelihood)
    if (threshold <= 0) return item.id
  }
  return items[items.length - 1].id
}

type RollInsert = {
  battle_id: string
  user_id: string
  item_id: string
  round: number
  roll_index: number
  rap: number
  float: number
  server_seed: string
  client_seed: string
  nonce: number
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()

  let body: { user_id: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { user_id: joiner_id } = body
  if (!joiner_id) return NextResponse.json({ error: "user_id required" }, { status: 400 })

  // Atomically claim the battle (only succeeds if status is 'waiting')
  const { data: battle, error: claimErr } = await db
    .from("battles")
    .update({ joiner_id, status: "in_progress" })
    .eq("id", id)
    .eq("status", "waiting")
    .select()
    .single()

  if (!battle || claimErr) {
    return NextResponse.json({ error: "Battle is no longer available" }, { status: 409 })
  }

  if (battle.creator_id === joiner_id) {
    await db.from("battles").update({ joiner_id: null, status: "waiting" }).eq("id", id)
    return NextResponse.json({ error: "Cannot join your own battle" }, { status: 400 })
  }

  const { data: joiner } = await db
    .from("users")
    .select("id, cases_remaining")
    .eq("id", joiner_id)
    .single()

  if (!joiner) {
    await db.from("battles").update({ joiner_id: null, status: "waiting" }).eq("id", id)
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const caseCost = battle.case_count * (battle.exclusive ? 50 : 1)

  if ((joiner.cases_remaining ?? 0) < caseCost) {
    await db.from("battles").update({ joiner_id: null, status: "waiting" }).eq("id", id)
    return NextResponse.json({ error: "Not enough cases" }, { status: 402 })
  }

  // Deduct cases from joiner
  await db
    .from("users")
    .update({ cases_remaining: joiner.cases_remaining - caseCost })
    .eq("id", joiner_id)

  // Fetch items for rolling — Exclusives mode restricts to Legendary & Omega only
  const itemsQuery = db.from("items").select("id, likelihood, market_price").eq("limited_time", false)
  const { data: items } = battle.exclusive
    ? await itemsQuery.in("rarity", ["Legendary", "Omega"])
    : await itemsQuery

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "No items available" }, { status: 500 })
  }

  const itemsMap = Object.fromEntries(items.map((i) => [i.id, i]))

  const allRolls: RollInsert[] = []
  let creatorRap = 0
  let joinerRap = 0

  // Main rounds
  for (let r = 0; r < battle.case_count; r++) {
    const cSeed = randomBytes(32).toString("hex")
    const jSeed = randomBytes(32).toString("hex")
    const cFloat = fairFloat(cSeed, "battle", 0)
    const jFloat = fairFloat(jSeed, "battle", 0)
    const cItemId = rollItem(items, cFloat)
    const jItemId = rollItem(items, jFloat)
    const cRap = Number(itemsMap[cItemId].market_price)
    const jRap = Number(itemsMap[jItemId].market_price)

    allRolls.push({ battle_id: id, user_id: battle.creator_id, item_id: cItemId, round: r, roll_index: allRolls.length, rap: cRap, float: cFloat, server_seed: cSeed, client_seed: "battle", nonce: 0 })
    allRolls.push({ battle_id: id, user_id: joiner_id, item_id: jItemId, round: r, roll_index: allRolls.length, rap: jRap, float: jFloat, server_seed: jSeed, client_seed: "battle", nonce: 0 })

    creatorRap += cRap
    joinerRap += jRap
  }

  // Tiebreakers — keep rolling until RAPs differ (max 10 extra rounds)
  let tieRound = battle.case_count
  while (Math.abs(creatorRap - joinerRap) < 1e-9 && tieRound - battle.case_count < 10) {
    const cSeed = randomBytes(32).toString("hex")
    const jSeed = randomBytes(32).toString("hex")
    const cFloat = fairFloat(cSeed, "battle", 0)
    const jFloat = fairFloat(jSeed, "battle", 0)
    const cItemId = rollItem(items, cFloat)
    const jItemId = rollItem(items, jFloat)
    const cRap = Number(itemsMap[cItemId].market_price)
    const jRap = Number(itemsMap[jItemId].market_price)

    allRolls.push({ battle_id: id, user_id: battle.creator_id, item_id: cItemId, round: tieRound, roll_index: allRolls.length, rap: cRap, float: cFloat, server_seed: cSeed, client_seed: "battle", nonce: 0 })
    allRolls.push({ battle_id: id, user_id: joiner_id, item_id: jItemId, round: tieRound, roll_index: allRolls.length, rap: jRap, float: jFloat, server_seed: jSeed, client_seed: "battle", nonce: 0 })

    creatorRap += cRap
    joinerRap += jRap
    tieRound++
  }

  // Creator wins all ties
  const winnerId = creatorRap >= joinerRap ? battle.creator_id : joiner_id

  // Insert rolls
  await db.from("battle_rolls").insert(allRolls)

  // Award ALL items to winner
  await db
    .from("inventory")
    .insert(allRolls.map((r) => ({ user_id: winnerId, item_id: r.item_id })))

  // Mark battle complete
  await db
    .from("battles")
    .update({ winner_id: winnerId, status: "completed", completed_at: new Date().toISOString() })
    .eq("id", id)

  return NextResponse.json({ success: true, winner_id: winnerId })
}
