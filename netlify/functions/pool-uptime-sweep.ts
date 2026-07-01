import { schedule } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import net from "net"

// Netlify scheduled function, runs every 5 minutes. Re-checks every currently
// "active" pool the same way the initial liveness test does (a raw TCP PING,
// expecting PONG back), logs the result, recomputes uptime %, and flips a pool
// to "offline" if it's stopped responding.

const CONNECT_TIMEOUT_MS = 4_000
const OFFLINE_AFTER_CONSECUTIVE_FAILURES = 3

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function pingPong(host: string, port: number): Promise<{ ok: boolean; latency_ms: number | null }> {
  return new Promise((resolve) => {
    const start = Date.now()
    const socket = new net.Socket()
    let settled = false

    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve({ ok, latency_ms: ok ? Date.now() - start : null })
    }

    socket.setTimeout(CONNECT_TIMEOUT_MS)
    socket.on("timeout", () => finish(false))
    socket.on("error", () => finish(false))
    socket.connect(port, host, () => socket.write("PING\n"))
    socket.on("data", (data) => finish(data.toString().trim().toUpperCase().includes("PONG")))
  })
}

async function uptimePct(supabase: ReturnType<typeof db>, poolId: string, sinceMs: number): Promise<number> {
  const since = new Date(Date.now() - sinceMs).toISOString()
  const { data } = await supabase.from("mining_pool_heartbeats").select("ok").eq("pool_id", poolId).gte("created_at", since)
  if (!data || data.length === 0) return 0
  const ok = data.filter((h: any) => h.ok).length
  return Math.round((ok / data.length) * 10000) / 100
}

const sweep = async () => {
  const supabase = db()
  const { data: activePools } = await supabase.from("mining_pools").select("*").eq("status", "active")

  for (const pool of activePools ?? []) {
    const result = await pingPong(pool.host, pool.port)
    await supabase.from("mining_pool_heartbeats").insert({ pool_id: pool.id, ok: result.ok, latency_ms: result.latency_ms })

    const uptime24h = await uptimePct(supabase, pool.id, 24 * 60 * 60 * 1000)
    const uptime7d = await uptimePct(supabase, pool.id, 7 * 24 * 60 * 60 * 1000)

    const updates: Record<string, any> = {
      uptime_pct_24h: uptime24h,
      uptime_pct_7d: uptime7d,
      updated_at: new Date().toISOString(),
    }
    if (result.ok) updates.last_heartbeat_at = new Date().toISOString()

    if (result.ok) {
      await supabase.from("mining_pools").update(updates).eq("id", pool.id)
      continue
    }

    const { data: recentChecks } = await supabase
      .from("mining_pool_heartbeats")
      .select("ok")
      .eq("pool_id", pool.id)
      .order("created_at", { ascending: false })
      .limit(OFFLINE_AFTER_CONSECUTIVE_FAILURES)

    const allRecentFailed = (recentChecks ?? []).length >= OFFLINE_AFTER_CONSECUTIVE_FAILURES &&
      (recentChecks ?? []).every((h: any) => !h.ok)

    if (allRecentFailed) {
      updates.status = "offline"
      await supabase.from("notifications").insert({
        user_id: pool.owner_id,
        type: "pool_offline",
        title: "Pool marked offline",
        body: `${pool.name} stopped responding to uptime checks and has been marked offline until it is reachable again.`,
        link: `/mining/pools/${pool.id}`,
      })
    }

    await supabase.from("mining_pools").update(updates).eq("id", pool.id)
  }

  return { statusCode: 200, body: JSON.stringify({ checked: (activePools ?? []).length }) }
}

export const handler = schedule("*/5 * * * *", sweep)
