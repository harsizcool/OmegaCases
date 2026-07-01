import { createHash } from "crypto"

// ─── Zites reward schedule ─────────────────────────────────────────────────
export const ZITES_REWARD_GENESIS = 128     // Zites paid for the first block
export const ZITES_HALVING_INTERVAL = 200   // blocks between Zites reward halvings

export function zitesRewardAtHeight(height: number): number {
  const halvings = Math.floor(height / ZITES_HALVING_INTERVAL)
  return ZITES_REWARD_GENESIS / Math.pow(2, halvings)
}

// ─── Difficulty retarget ───────────────────────────────────────────────────
export const TARGET_BLOCK_TIME_MS = 6 * 60 * 1000 // 6 minutes
export const DIFFICULTY_ADJUSTMENT_INTERVAL = 10  // adjust every N blocks
export const MIN_ADJUSTMENT_FACTOR = 0.5
export const MAX_ADJUSTMENT_FACTOR = 3.0

// Default starting target: ~16 leading hex zeros, reasonably easy for first miners
export const DEFAULT_TARGET = "00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"

const MAX_TARGET = BigInt("0x00ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
const MIN_TARGET = BigInt("0x0000000000000001000000000000000000000000000000000000000000000000")

/** Normalize any hex target to exactly 64 chars.
 *  Short strings are right-padded with 'f' (preserves difficulty intent).
 *  Long strings are truncated on the right. */
export function normalizeTarget(hex: string): string {
  const cleaned = (hex ?? "").toLowerCase().replace(/[^0-9a-f]/g, "")
  return cleaned.padEnd(64, "f").slice(0, 64)
}

/** Parse a 64-char hex target into a BigInt */
export function targetToBigInt(hex: string): bigint {
  return BigInt("0x" + normalizeTarget(hex))
}

/** Encode a BigInt back to a zero-padded 64-char hex string */
export function bigIntToTarget(n: bigint): string {
  return n.toString(16).padStart(64, "0").slice(0, 64)
}

/** Clamp a value to [min, max] */
export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

/** Retrieve a game_settings value (returns null if not set) */
export async function getSetting(db: any, key: string): Promise<string | null> {
  const { data } = await db.from("game_settings").select("value").eq("key", key).single()
  return data?.value ?? null
}

/** Upsert a game_settings key */
export async function setSetting(db: any, key: string, value: string) {
  await db.from("game_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" })
}

/** Atomically increments a user's Zites balance via a single locked SQL UPDATE (credit_zites_balance RPC). */
export async function creditZitesBalance(db: any, userId: string, amount: number): Promise<number> {
  const { data, error } = await db.rpc("credit_zites_balance", { p_user_id: userId, p_amount: amount })
  if (error) throw error
  return Number(data)
}

/**
 * Atomically claims a block at `expectedHeight` (locks mining_height, inserts
 * the block, advances height) via the claim_mining_block RPC. Returns the new
 * height + inserted block id on success, or `{ collision: true }` if another
 * submission already claimed/advanced past this height.
 */
export async function claimMiningBlock(db: any, opts: {
  expectedHeight: number
  hash: string
  nonce: number | string
  minerId: string
  previousHash: string
  target: string
  rewardZites: number
  poolId: string | null
}): Promise<{ newHeight: number; blockId: string } | { collision: true }> {
  const { data, error } = await db.rpc("claim_mining_block", {
    p_expected_height: opts.expectedHeight,
    p_hash: opts.hash.toLowerCase(),
    p_nonce: Number(opts.nonce),
    p_miner_id: opts.minerId,
    p_previous_hash: opts.previousHash,
    p_target: opts.target,
    p_reward_zites: opts.rewardZites,
    p_pool_id: opts.poolId,
  })
  if (error) {
    if (error.message?.includes("height_mismatch")) return { collision: true }
    throw error
  }
  const row = Array.isArray(data) ? data[0] : data
  return { newHeight: Number(row.new_height), blockId: row.block_id }
}

/**
 * Build the proof-of-work preimage. Solo miners use their own user id;
 * pool-submitted blocks use the pool's id in its place (many people contribute
 * to a pool block, so there is no single miner id to hash).
 */
export function buildPreimage(previousHash: string, minerOrPoolId: string, nonce: number | string): string {
  const idNoDashes = minerOrPoolId.replace(/-/g, "")
  return `${previousHash}${idNoDashes}${nonce}`
}

export function sha256Hex(preimage: string): string {
  return createHash("sha256").update(preimage).digest("hex")
}

/** Verify a submitted hash against the expected preimage and current target. */
export function verifyProofOfWork(opts: {
  previousHash: string
  minerOrPoolId: string
  nonce: number | string
  hash: string
  target: string
}): { ok: true } | { ok: false; error: string; debug?: any } {
  const preimage = buildPreimage(opts.previousHash, opts.minerOrPoolId, opts.nonce)
  const expectedHash = sha256Hex(preimage)

  if (expectedHash !== opts.hash.toLowerCase()) {
    return {
      ok: false,
      error: "Hash verification failed",
      debug: {
        preimage,
        server_hash: expectedHash,
        submitted_hash: opts.hash.toLowerCase(),
        note: "preimage = previous_hash + id_no_dashes + nonce (plain integer string, no separators)",
      },
    }
  }

  const hashInt = targetToBigInt(opts.hash)
  const targetInt = targetToBigInt(opts.target)
  if (hashInt >= targetInt) {
    return { ok: false, error: "Hash does not meet target difficulty" }
  }

  return { ok: true }
}

/**
 * Runs the difficulty retarget if `newHeight` lands on a retarget boundary.
 * Returns the (possibly unchanged) current target. Mutates game_settings as a side effect.
 */
export async function maybeRetargetDifficulty(db: any, currentTarget: string, newHeight: number): Promise<string> {
  if (newHeight % DIFFICULTY_ADJUSTMENT_INTERVAL !== 0) return currentTarget

  const { data: recentBlocks } = await db
    .from("mining_blocks")
    .select("found_at")
    .order("height", { ascending: false })
    .limit(DIFFICULTY_ADJUSTMENT_INTERVAL)

  if (!recentBlocks || recentBlocks.length < 2) return currentTarget

  const oldest = new Date(recentBlocks[recentBlocks.length - 1].found_at).getTime()
  const newest = new Date(recentBlocks[0].found_at).getTime()
  const actualMs = newest - oldest
  const expectedMs = (DIFFICULTY_ADJUSTMENT_INTERVAL - 1) * TARGET_BLOCK_TIME_MS

  // adjustment_factor = actualMs / expectedMs (same as Bitcoin's retarget)
  // blocks too fast -> actualMs < expectedMs -> factor < 1 -> target shrinks (harder)
  // blocks too slow -> actualMs > expectedMs -> factor > 1 -> target grows (easier)
  const rawFactor = actualMs / Math.max(expectedMs, 1)
  const factor = clamp(rawFactor, MIN_ADJUSTMENT_FACTOR, MAX_ADJUSTMENT_FACTOR)

  const currentTargetBig = targetToBigInt(currentTarget)
  const scaled = (currentTargetBig * BigInt(Math.round(factor * 1_000_000))) / BigInt(1_000_000)
  const clamped = scaled > MAX_TARGET ? MAX_TARGET : scaled < MIN_TARGET ? MIN_TARGET : scaled
  const newTarget = bigIntToTarget(clamped)

  // apply_difficulty_retarget locks mining_last_adj_height and no-ops if this
  // boundary height was already processed by a concurrent submission, so two
  // blocks landing on the same retarget boundary can't double-apply the factor.
  const { data: applied, error } = await db.rpc("apply_difficulty_retarget", {
    p_new_adj_height: newHeight,
    p_new_target: newTarget,
  })
  if (error) throw error
  if (!applied) {
    // Someone else already retargeted for this height — return the authoritative stored target.
    const stored = await getSetting(db, "mining_target")
    return normalizeTarget(stored ?? newTarget)
  }

  return newTarget
}
