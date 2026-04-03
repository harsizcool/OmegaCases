import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createHash } from "crypto"

// Mining constants
const BLOCK_REWARD_GENESIS = 0.12          // initial reward per block
const HALVING_INTERVAL = 64                // blocks between halvings
const TARGET_BLOCK_TIME_MS = 6 * 60 * 1000 // 6 minutes in ms
const DIFFICULTY_ADJUSTMENT_INTERVAL = 32  // adjust every N blocks
const MIN_ADJUSTMENT_FACTOR = 0.5
const MAX_ADJUSTMENT_FACTOR = 3.0

// Default starting target: ~16 leading hex zeros → reasonably easy for first miners
const DEFAULT_TARGET = "00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Normalize any hex target to exactly 64 chars.
 *  Short strings are right-padded with 'f' (preserves difficulty intent).
 *  Long strings are truncated on the right. */
function normalizeTarget(hex: string): string {
  const cleaned = (hex ?? "").toLowerCase().replace(/[^0-9a-f]/g, "")
  return cleaned.padEnd(64, "f").slice(0, 64)
}

/** Parse a 64-char hex target into a BigInt */
function targetToBigInt(hex: string): bigint {
  return BigInt("0x" + normalizeTarget(hex))
}

/** Encode a BigInt back to a zero-padded 64-char hex string */
function bigIntToTarget(n: bigint): string {
  return n.toString(16).padStart(64, "0").slice(0, 64)
}

/** Clamp a value to [min, max] */
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

/** Current mining reward based on block height (halvings every HALVING_INTERVAL) */
function rewardAtHeight(height: number): number {
  const halvings = Math.floor(height / HALVING_INTERVAL)
  return BLOCK_REWARD_GENESIS / Math.pow(2, halvings)
}

/** Retrieve a game_settings value (returns null if not set) */
async function getSetting(db: any, key: string): Promise<string | null> {
  const { data } = await db.from("game_settings").select("value").eq("key", key).single()
  return data?.value ?? null
}

/** Upsert a game_settings key */
async function setSetting(db: any, key: string, value: string) {
  await db.from("game_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" })
}

// ─── GET /api/mining ──────────────────────────────────────────────────────────
// Returns current mining state: target, height, reward, previous hash, halving ETA

export async function GET() {
  const db = await createClient()

  // Load current state from game_settings
  const [targetRaw, heightRaw, lastAdjHeightRaw] = await Promise.all([
    getSetting(db, "mining_target"),
    getSetting(db, "mining_height"),
    getSetting(db, "mining_last_adj_height"),
  ])

  const currentTarget = normalizeTarget(targetRaw ?? DEFAULT_TARGET)
  const currentHeight = parseInt(heightRaw ?? "0", 10)
  const lastAdjHeight = parseInt(lastAdjHeightRaw ?? "0", 10)
  const currentReward = rewardAtHeight(currentHeight)

  // Get previous block hash (hash of the last mined block, or genesis sentinel)
  let previousHash = "0000000000000000000000000000000000000000000000000000000000000000"
  if (currentHeight > 0) {
    const { data: lastBlock } = await db
      .from("mining_blocks")
      .select("hash")
      .eq("height", currentHeight - 1)
      .single()
    if (lastBlock) previousHash = lastBlock.hash
  }

  // Halving ETA
  const nextHalvingHeight = Math.ceil((currentHeight + 1) / HALVING_INTERVAL) * HALVING_INTERVAL
  const blocksUntilHalving = nextHalvingHeight - currentHeight
  const halvingEtaMs = blocksUntilHalving * TARGET_BLOCK_TIME_MS

  // Next difficulty adjustment
  const nextAdjHeight = lastAdjHeight + DIFFICULTY_ADJUSTMENT_INTERVAL
  const blocksUntilAdj = Math.max(0, nextAdjHeight - currentHeight)

  return NextResponse.json({
    target: currentTarget,
    height: currentHeight,
    previous_hash: previousHash,
    reward: currentReward,
    halving: {
      next_height: nextHalvingHeight,
      blocks_remaining: blocksUntilHalving,
      eta_ms: halvingEtaMs,
    },
    difficulty_adjustment: {
      next_height: nextAdjHeight,
      blocks_remaining: blocksUntilAdj,
    },
  })
}

// ─── POST /api/mining ─────────────────────────────────────────────────────────
// Submit a found block: { miner_id, nonce, hash }

export async function POST(req: Request) {
  const db = await createClient()

  let body: { miner_id: string; nonce: number | string; hash: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { miner_id, nonce, hash } = body
  if (!miner_id || nonce === undefined || !hash) {
    return NextResponse.json({ error: "miner_id, nonce, and hash are required" }, { status: 400 })
  }

  // Validate miner exists
  const { data: miner } = await db.from("users").select("id, username, balance").eq("id", miner_id).single()
  if (!miner) return NextResponse.json({ error: "Miner not found" }, { status: 404 })

  // Load current state
  const [targetRaw, heightRaw, lastAdjHeightRaw] = await Promise.all([
    getSetting(db, "mining_target"),
    getSetting(db, "mining_height"),
    getSetting(db, "mining_last_adj_height"),
  ])

  const currentTarget = normalizeTarget(targetRaw ?? DEFAULT_TARGET)
  const currentHeight = parseInt(heightRaw ?? "0", 10)
  const lastAdjHeight = parseInt(lastAdjHeightRaw ?? "0", 10)

  // Get previous block hash
  let previousHash = "0000000000000000000000000000000000000000000000000000000000000000"
  if (currentHeight > 0) {
    const { data: lastBlock } = await db
      .from("mining_blocks")
      .select("hash")
      .eq("height", currentHeight - 1)
      .single()
    if (lastBlock) previousHash = lastBlock.hash
  }

  // ── Verify the hash ──
  // Preimage: prev_hash + miner_id (no dashes) + nonce as plain integer string
  const minerIdNoDashes = miner_id.replace(/-/g, "")
  const preimage = `${previousHash}${minerIdNoDashes}${nonce}`
  const expectedHash = createHash("sha256").update(preimage).digest("hex")

  if (expectedHash !== hash.toLowerCase()) {
    return NextResponse.json({
      error: "Hash verification failed",
      debug: {
        preimage,
        server_hash: expectedHash,
        submitted_hash: hash.toLowerCase(),
        note: "preimage = prev_hash + miner_id_no_dashes + nonce (plain integer string, no separators)",
      },
    }, { status: 400 })
  }

  // Check hash < target
  const hashInt = targetToBigInt(hash)
  const targetInt = targetToBigInt(currentTarget)
  if (hashInt >= targetInt) {
    return NextResponse.json({ error: "Hash does not meet target difficulty" }, { status: 400 })
  }

  // ── Claim the block (optimistic lock: insert will fail on duplicate height) ──
  const reward = rewardAtHeight(currentHeight)
  const { error: insertError } = await db.from("mining_blocks").insert({
    height: currentHeight,
    hash: hash.toLowerCase(),
    nonce: Number(nonce),
    miner_id,
    previous_hash: previousHash,
    target: currentTarget,
    reward,
    found_at: new Date().toISOString(),
  })

  if (insertError) {
    // Another miner already claimed this block
    return NextResponse.json({ error: "Block already claimed — a faster miner beat you to it" }, { status: 409 })
  }

  // ── Credit balance ──
  await db.from("users").update({ balance: miner.balance + reward }).eq("id", miner_id)

  // ── Advance height ──
  const newHeight = currentHeight + 1
  await setSetting(db, "mining_height", String(newHeight))

  // ── Difficulty adjustment every DIFFICULTY_ADJUSTMENT_INTERVAL blocks ──
  let newTarget = currentTarget
  if (newHeight % DIFFICULTY_ADJUSTMENT_INTERVAL === 0) {
    // Fetch timestamps of the last DIFFICULTY_ADJUSTMENT_INTERVAL blocks
    const { data: recentBlocks } = await db
      .from("mining_blocks")
      .select("found_at")
      .order("height", { ascending: false })
      .limit(DIFFICULTY_ADJUSTMENT_INTERVAL)

    if (recentBlocks && recentBlocks.length >= 2) {
      const oldest = new Date(recentBlocks[recentBlocks.length - 1].found_at).getTime()
      const newest = new Date(recentBlocks[0].found_at).getTime()
      const actualMs = newest - oldest
      const expectedMs = (DIFFICULTY_ADJUSTMENT_INTERVAL - 1) * TARGET_BLOCK_TIME_MS

      // adjustment_factor = actualMs / expectedMs (same as Bitcoin's retarget)
      // blocks too fast → actualMs < expectedMs → factor < 1 → target shrinks (harder)
      // blocks too slow → actualMs > expectedMs → factor > 1 → target grows (easier)
      const rawFactor = actualMs / Math.max(expectedMs, 1)
      const factor = clamp(rawFactor, MIN_ADJUSTMENT_FACTOR, MAX_ADJUSTMENT_FACTOR)

      const currentTargetBig = targetToBigInt(currentTarget)
      // Scale the target. Use integer arithmetic (multiply by 1e6, then divide).
      const scaled = (currentTargetBig * BigInt(Math.round(factor * 1_000_000))) / BigInt(1_000_000)
      // Clamp: never exceed max possible 256-bit value
      const MAX_TARGET = BigInt("0x00ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
      const MIN_TARGET = BigInt("0x0000000000000001000000000000000000000000000000000000000000000000")
      const clamped = scaled > MAX_TARGET ? MAX_TARGET : scaled < MIN_TARGET ? MIN_TARGET : scaled
      newTarget = bigIntToTarget(clamped)

      await setSetting(db, "mining_target", newTarget)
      await setSetting(db, "mining_last_adj_height", String(newHeight))
    }
  }

  return NextResponse.json({
    success: true,
    block: {
      height: currentHeight,
      hash: hash.toLowerCase(),
      reward,
      miner: miner.username,
    },
    next: {
      height: newHeight,
      target: newTarget,
    },
  })
}
