import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  DEFAULT_TARGET,
  DIFFICULTY_ADJUSTMENT_INTERVAL,
  TARGET_BLOCK_TIME_MS,
  ZITES_HALVING_INTERVAL,
  claimMiningBlock,
  creditZitesBalance,
  getSetting,
  maybeRetargetDifficulty,
  normalizeTarget,
  verifyProofOfWork,
  zitesRewardAtHeight,
} from "@/lib/mining"

// ─── GET /api/mining ──────────────────────────────────────────────────────────
// Returns current mining state: target, height, Zites reward, previous hash,
// and the two independent cycles (Zites halving every 200 blocks, difficulty
// adjustment every 10 blocks).

export async function GET() {
  const db = await createClient()

  const [targetRaw, heightRaw, lastAdjHeightRaw] = await Promise.all([
    getSetting(db, "mining_target"),
    getSetting(db, "mining_height"),
    getSetting(db, "mining_last_adj_height"),
  ])

  const currentTarget = normalizeTarget(targetRaw ?? DEFAULT_TARGET)
  const currentHeight = parseInt(heightRaw ?? "0", 10)
  const lastAdjHeight = parseInt(lastAdjHeightRaw ?? "0", 10)
  const currentReward = zitesRewardAtHeight(currentHeight)

  let previousHash = "0000000000000000000000000000000000000000000000000000000000000000"
  if (currentHeight > 0) {
    const { data: lastBlock } = await db
      .from("mining_blocks")
      .select("hash")
      .eq("height", currentHeight - 1)
      .single()
    if (lastBlock) previousHash = lastBlock.hash
  }

  const nextHalvingHeight = Math.ceil((currentHeight + 1) / ZITES_HALVING_INTERVAL) * ZITES_HALVING_INTERVAL
  const blocksUntilHalving = nextHalvingHeight - currentHeight
  const halvingEtaMs = blocksUntilHalving * TARGET_BLOCK_TIME_MS

  const nextAdjHeight = lastAdjHeight + DIFFICULTY_ADJUSTMENT_INTERVAL
  const blocksUntilAdj = Math.max(0, nextAdjHeight - currentHeight)

  return NextResponse.json({
    target: currentTarget,
    height: currentHeight,
    previous_hash: previousHash,
    reward_zites: currentReward,
    zites_halving: {
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
// Submit a solo-mined block: { miner_id, nonce, hash }

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

  const { data: miner } = await db.from("users").select("id, username, zites_balance").eq("id", miner_id).single()
  if (!miner) return NextResponse.json({ error: "Miner not found" }, { status: 404 })

  const [targetRaw, heightRaw] = await Promise.all([
    getSetting(db, "mining_target"),
    getSetting(db, "mining_height"),
  ])

  const currentTarget = normalizeTarget(targetRaw ?? DEFAULT_TARGET)
  const currentHeight = parseInt(heightRaw ?? "0", 10)

  let previousHash = "0000000000000000000000000000000000000000000000000000000000000000"
  if (currentHeight > 0) {
    const { data: lastBlock } = await db
      .from("mining_blocks")
      .select("hash")
      .eq("height", currentHeight - 1)
      .single()
    if (lastBlock) previousHash = lastBlock.hash
  }

  const verification = verifyProofOfWork({
    previousHash,
    minerOrPoolId: miner_id,
    nonce,
    hash,
    target: currentTarget,
  })
  if (!verification.ok) {
    return NextResponse.json({ error: verification.error, debug: (verification as any).debug }, { status: 400 })
  }

  // ── Claim the block atomically (locks mining_height, inserts, advances height) ──
  const reward = zitesRewardAtHeight(currentHeight)
  const claim = await claimMiningBlock(db, {
    expectedHeight: currentHeight,
    hash,
    nonce,
    minerId: miner_id,
    previousHash,
    target: currentTarget,
    rewardZites: reward,
    poolId: null,
  })

  if ("collision" in claim) {
    return NextResponse.json({ error: "Block already claimed — a faster miner beat you to it" }, { status: 409 })
  }
  const newHeight = claim.newHeight

  // ── Credit Zites balance atomically ──
  await creditZitesBalance(db, miner_id, reward)

  // ── Difficulty adjustment every DIFFICULTY_ADJUSTMENT_INTERVAL blocks ──
  const newTarget = await maybeRetargetDifficulty(db, currentTarget, newHeight)

  return NextResponse.json({
    success: true,
    block: {
      height: currentHeight,
      hash: hash.toLowerCase(),
      reward_zites: reward,
      miner: miner.username,
    },
    next: {
      height: newHeight,
      target: newTarget,
    },
  })
}
