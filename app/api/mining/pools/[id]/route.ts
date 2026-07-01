import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/mining/pools/[id] — pool detail: stats, recent blocks, member count
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()

  const { data: pool, error } = await db
    .from("mining_pools")
    .select("id, owner_id, name, host, port, ip_version, description, status, api_key_prefix, last_heartbeat_at, uptime_pct_24h, uptime_pct_7d, blocks_found, member_count, total_shares_reported, banned_reason, created_at, updated_at, owner:users!mining_pools_owner_id_fkey(id, username)")
    .eq("id", id)
    .single()

  if (error || !pool) return NextResponse.json({ error: "Pool not found" }, { status: 404 })

  const { data: recentBlocks } = await db
    .from("mining_blocks")
    .select("height, hash, reward_zites, found_at")
    .eq("pool_id", id)
    .order("height", { ascending: false })
    .limit(20)

  return NextResponse.json({ pool, recent_blocks: recentBlocks ?? [] })
}

// PATCH /api/mining/pools/[id] — owner edits (host/port change re-triggers liveness)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()

  let body: { user_id: string; name?: string; host?: string; port?: number; description?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { data: pool } = await db.from("mining_pools").select("owner_id, host, port").eq("id", id).single()
  if (!pool) return NextResponse.json({ error: "Pool not found" }, { status: 404 })
  if (pool.owner_id !== body.user_id) return NextResponse.json({ error: "Not your pool" }, { status: 403 })

  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (body.name) updates.name = body.name
  if (body.description !== undefined) updates.description = body.description
  const hostPortChanged =
    (body.host && body.host !== pool.host) || (body.port && body.port !== pool.port)
  if (body.host) updates.host = body.host
  if (body.port) updates.port = body.port
  if (hostPortChanged) updates.status = "testing"

  const { data: updated, error } = await db.from("mining_pools").update(updates).eq("id", id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (hostPortChanged) {
    const livenessUrl = process.env.POOL_LIVENESS_FUNCTION_URL
    if (livenessUrl) {
      fetch(livenessUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pool_id: id }),
      }).catch(() => {})
    }
  }

  return NextResponse.json({ success: true, pool: updated })
}

// DELETE /api/mining/pools/[id] — owner removes their pool
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()

  let body: { user_id: string } = { user_id: "" }
  try {
    body = await req.json()
  } catch {}
  const { searchParams } = new URL(req.url)
  const userId = body.user_id || searchParams.get("user_id")

  const { data: pool } = await db.from("mining_pools").select("owner_id").eq("id", id).single()
  if (!pool) return NextResponse.json({ error: "Pool not found" }, { status: 404 })
  if (pool.owner_id !== userId) return NextResponse.json({ error: "Not your pool" }, { status: 403 })

  const { error } = await db.from("mining_pools").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
