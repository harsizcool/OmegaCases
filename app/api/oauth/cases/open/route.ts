import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createHmac, randomBytes, createHash } from "crypto"

function newServerSeed() { return randomBytes(32).toString("hex") }
function commitHash(s: string) { return createHash("sha256").update(s).digest("hex") }
function fairFloat(serverSeed: string, clientSeed: string, nonce: number) {
  const hmac = createHmac("sha256", serverSeed)
  hmac.update(`${clientSeed}:${nonce}:0`)
  return parseInt(hmac.digest("hex").slice(0, 8), 16) / 0x100000000
}
function rollItemFair(items: { id: string; likelihood: number }[], float: number) {
  const total = items.reduce((s, i) => s + Number(i.likelihood), 0)
  let t = float * total
  for (const item of items) { t -= Number(item.likelihood); if (t <= 0) return item.id }
  return items[items.length - 1].id
}

// POST /api/oauth/cases/open
// Body: { token, client_seed? }
// Opens a case on behalf of the authorized user. Requires write_cases scope.
export async function POST(req: Request) {
  const { token, client_seed } = await req.json()
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 })

  const clientSeed: string = (client_seed as string)?.trim() || "omegacases"
  const db = await createClient()

  // Resolve token
  const { data: tok } = await db
    .from("oauth_tokens")
    .select("user_id, scopes")
    .eq("token", token)
    .single()

  if (!tok) return NextResponse.json({ error: "Invalid or revoked token" }, { status: 401 })
  if (!tok.scopes.includes("write_cases")) {
    return NextResponse.json({ error: "Token does not have write_cases scope" }, { status: 403 })
  }

  const { user_id } = tok

  const { data: user } = await db
    .from("users")
    .select("id, cases, cases_remaining")
    .eq("id", user_id)
    .single()

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if ((user.cases_remaining || 0) < 1) {
    return NextResponse.json({ error: "No cases remaining" }, { status: 402 })
  }

  const { data: items } = await db
    .from("items")
    .select("id, likelihood")
    .eq("limited_time", false)

  if (!items?.length) return NextResponse.json({ error: "No items available" }, { status: 500 })

  // Provably fair roll
  const serverSeed     = newServerSeed()
  const serverSeedHash = commitHash(serverSeed)
  const nonce          = 0
  const float          = fairFloat(serverSeed, clientSeed, nonce)
  const wonItemId      = rollItemFair(items, float)

  await db.from("users").update({
    cases_remaining: user.cases_remaining - 1,
    cases: (user.cases || 0) + 1,
  }).eq("id", user_id)

  await db.from("inventory").insert({ user_id, item_id: wonItemId })

  await db.from("rolls").insert({
    user_id,
    item_id: wonItemId,
    server_seed: serverSeed,
    server_seed_hash: serverSeedHash,
    client_seed: clientSeed,
    nonce,
    float,
  })

  await db.from("items")
    .update({ first_unboxed_by: user_id })
    .eq("id", wonItemId)
    .is("first_unboxed_by", null)

  await db.from("oauth_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token", token)

  const { data: wonItem } = await db.from("items").select("*").eq("id", wonItemId).single()

  return NextResponse.json({
    wonItem,
    cases_remaining: user.cases_remaining - 1,
    server_seed_hash: serverSeedHash,
    server_seed: serverSeed,
    client_seed: clientSeed,
    nonce,
    float,
  })
}
