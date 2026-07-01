import type { Handler } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import net from "net"

// Netlify background function (note the "-background" suffix in the filename).
// Triggered right after a pool registers (or edits its host/port). Runs async,
// outside the request/response cycle, for up to 15 minutes without blocking a caller.
//
// For about 30 seconds, OmegaCases's own server repeatedly opens a raw TCP
// connection to the pool's host:port, sends "PING\n", and expects "PONG" back.
// This is the whole liveness contract a pool operator needs to implement:
// answer PING with PONG on the port they registered.

const TEST_DURATION_MS = 30_000
const ATTEMPT_INTERVAL_MS = 2_500
const CONNECT_TIMEOUT_MS = 4_000
const REQUIRED_SUCCESS_RATIO = 10 / 12

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

    socket.connect(port, host, () => {
      socket.write("PING\n")
    })

    socket.on("data", (data) => {
      finish(data.toString().trim().toUpperCase().includes("PONG"))
    })
  })
}

export const handler: Handler = async (event) => {
  let poolId: string | undefined
  try {
    poolId = JSON.parse(event.body ?? "{}").pool_id
  } catch {
    return { statusCode: 400, body: "Invalid JSON" }
  }
  if (!poolId) return { statusCode: 400, body: "pool_id required" }

  const supabase = db()
  const { data: pool } = await supabase.from("mining_pools").select("*").eq("id", poolId).single()
  if (!pool) return { statusCode: 404, body: "Pool not found" }

  const attempts: { ok: boolean; latency_ms: number | null }[] = []
  const deadline = Date.now() + TEST_DURATION_MS

  while (Date.now() < deadline) {
    const result = await pingPong(pool.host, pool.port)
    attempts.push(result)
    await supabase.from("mining_pool_heartbeats").insert({ pool_id: poolId, ok: result.ok, latency_ms: result.latency_ms })
    await new Promise((r) => setTimeout(r, ATTEMPT_INTERVAL_MS))
  }

  const successes = attempts.filter((a) => a.ok).length
  const passed = attempts.length > 0 && successes / attempts.length >= REQUIRED_SUCCESS_RATIO

  if (passed) {
    await supabase
      .from("mining_pools")
      .update({ status: "active", last_heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", poolId)
    await supabase.from("notifications").insert({
      user_id: pool.owner_id,
      type: "pool_activated",
      title: "Pool is live",
      body: `${pool.name} passed the liveness check and is now listed on the public pool list.`,
      link: `/mining/pools/${poolId}`,
    })
  } else {
    await supabase.from("mining_pools").update({ status: "pending", updated_at: new Date().toISOString() }).eq("id", poolId)
    await supabase.from("notifications").insert({
      user_id: pool.owner_id,
      type: "pool_liveness_failed",
      title: "Pool liveness check failed",
      body: `${pool.name} did not respond reliably to the PING/PONG check. Make sure it is reachable on ${pool.host}:${pool.port} and try again.`,
      link: `/mining/pools/${poolId}`,
    })
  }

  return { statusCode: 200, body: JSON.stringify({ passed, successes, attempts: attempts.length }) }
}
