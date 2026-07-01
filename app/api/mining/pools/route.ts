import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateApiKey, hashApiKey, apiKeyPrefix } from "@/lib/pool-auth"

const HOST_REGEX = /^[a-zA-Z0-9.:\-]+$/

// GET /api/mining/pools — public list of active pools, or ?owner_id=/?mine=1&user_id= filters
export async function GET(req: Request) {
  const db = await createClient()
  const { searchParams } = new URL(req.url)
  const ownerId = searchParams.get("owner_id")
  const mineUserId = searchParams.get("mine") === "1" ? searchParams.get("user_id") : null

  let query = db
    .from("mining_pools")
    .select("id, owner_id, name, host, port, ip_version, description, status, api_key_prefix, last_heartbeat_at, uptime_pct_24h, uptime_pct_7d, blocks_found, member_count, created_at, updated_at, owner:users!mining_pools_owner_id_fkey(id, username)")
    .order("created_at", { ascending: false })

  if (ownerId) {
    query = query.eq("owner_id", ownerId)
  } else if (mineUserId) {
    const { data: memberships } = await db.from("mining_pool_members").select("pool_id").eq("user_id", mineUserId)
    const poolIds = (memberships ?? []).map((m: any) => m.pool_id)
    if (poolIds.length === 0) return NextResponse.json({ pools: [] })
    query = query.in("id", poolIds)
  } else {
    query = query.eq("status", "active")
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pools: data ?? [] })
}

// POST /api/mining/pools — register a new pool
export async function POST(req: Request) {
  const db = await createClient()

  let body: { owner_id: string; name: string; host: string; port: number; ip_version?: string; description?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { owner_id, name, host, port, description } = body
  const ip_version = body.ip_version ?? "auto"

  if (!owner_id || !name || !host || !port) {
    return NextResponse.json({ error: "owner_id, name, host, and port are required" }, { status: 400 })
  }
  if (!HOST_REGEX.test(host)) return NextResponse.json({ error: "Invalid host" }, { status: 400 })
  if (port < 1 || port > 65535) return NextResponse.json({ error: "Port must be between 1 and 65535" }, { status: 400 })
  if (!["ipv4", "ipv6", "auto"].includes(ip_version)) {
    return NextResponse.json({ error: "ip_version must be ipv4, ipv6, or auto" }, { status: 400 })
  }

  const { data: owner } = await db.from("users").select("id").eq("id", owner_id).single()
  if (!owner) return NextResponse.json({ error: "Owner not found" }, { status: 404 })

  const apiKey = generateApiKey()

  const { data: pool, error } = await db
    .from("mining_pools")
    .insert({
      owner_id,
      name,
      host,
      port,
      ip_version,
      description: description ?? null,
      status: "pending",
      api_key_hash: hashApiKey(apiKey),
      api_key_prefix: apiKeyPrefix(apiKey),
    })
    .select()
    .single()

  if (error || !pool) return NextResponse.json({ error: error?.message ?? "Failed to register pool" }, { status: 500 })

  // Kick off the liveness test in the background (fire-and-forget). If the
  // liveness function's URL isn't configured (e.g. local dev without Netlify),
  // this silently no-ops and the pool just stays "pending" until re-triggered.
  const livenessUrl = process.env.POOL_LIVENESS_FUNCTION_URL
  if (livenessUrl) {
    fetch(livenessUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pool_id: pool.id }),
    }).catch(() => {})
    await db.from("mining_pools").update({ status: "testing" }).eq("id", pool.id)
  }

  return NextResponse.json({
    success: true,
    pool: { ...pool, api_key_hash: undefined },
    api_key: apiKey,
    warning: "Save this API key now, it will not be shown again.",
  })
}
