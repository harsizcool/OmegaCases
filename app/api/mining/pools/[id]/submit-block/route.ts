import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { authenticatePool } from "@/lib/pool-auth"
import {
  DEFAULT_TARGET,
  claimMiningBlock,
  creditZitesBalance,
  getSetting,
  maybeRetargetDifficulty,
  normalizeTarget,
  verifyProofOfWork,
  zitesRewardAtHeight,
} from "@/lib/mining"
import { createNotification } from "@/lib/notifications"

// POST /api/mining/pools/[id]/submit-block
// Auth: Authorization: Bearer <pool api key>
// Body: { nonce, hash, shares: [{ user_id, shares }, ...] }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: poolId } = await params
  const db = await createClient()

  const pool = await authenticatePool(db, req, poolId)
  if (!pool) return NextResponse.json({ error: "Invalid or missing pool API key" }, { status: 401 })
  if (pool.status !== "active") {
    return NextResponse.json({ error: "Pool is not active" }, { status: 403 })
  }

  let body: { nonce: number | string; hash: string; shares: { user_id: string; shares: number }[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { nonce, hash, shares } = body
  if (nonce === undefined || !hash || !Array.isArray(shares) || shares.length === 0) {
    return NextResponse.json({ error: "nonce, hash, and a non-empty shares array are required" }, { status: 400 })
  }
  if (shares.some((s) => !s.user_id || typeof s.shares !== "number" || s.shares < 0)) {
    return NextResponse.json({ error: "Every share entry needs a user_id and a non-negative shares number" }, { status: 400 })
  }

  const [targetRaw, heightRaw] = await Promise.all([
    getSetting(db, "mining_target"),
    getSetting(db, "mining_height"),
  ])
  const currentTarget = normalizeTarget(targetRaw ?? DEFAULT_TARGET)
  const currentHeight = parseInt(heightRaw ?? "0", 10)

  let previousHash = "0000000000000000000000000000000000000000000000000000000000000000"
  if (currentHeight > 0) {
    const { data: lastBlock } = await db.from("mining_blocks").select("hash").eq("height", currentHeight - 1).single()
    if (lastBlock) previousHash = lastBlock.hash
  }

  // Pool blocks hash with the pool's own id in place of an individual miner id,
  // since many participants contribute to a single pool-found block.
  const verification = verifyProofOfWork({
    previousHash,
    minerOrPoolId: poolId,
    nonce,
    hash,
    target: currentTarget,
  })
  if (!verification.ok) {
    return NextResponse.json({ error: verification.error, debug: (verification as any).debug }, { status: 400 })
  }

  // Only credit shares for users who have actually joined this pool through the site.
  const { data: members } = await db.from("mining_pool_members").select("user_id").eq("pool_id", poolId)
  const memberIds = new Set((members ?? []).map((m: any) => m.user_id))
  const validShares = shares.filter((s) => memberIds.has(s.user_id))
  if (validShares.length === 0) {
    return NextResponse.json({ error: "None of the reported user_ids have joined this pool" }, { status: 400 })
  }

  const reward = zitesRewardAtHeight(currentHeight)

  const claim = await claimMiningBlock(db, {
    expectedHeight: currentHeight,
    hash,
    nonce,
    minerId: pool.owner_id,
    previousHash,
    target: currentTarget,
    rewardZites: reward,
    poolId,
  })

  if ("collision" in claim) {
    return NextResponse.json({ error: "Block already claimed — a faster miner beat you to it" }, { status: 409 })
  }
  const { newHeight, blockId } = claim

  // Split the reward proportionally to reported shares among valid participants.
  // Track cumulative credited amount so the last participant absorbs any rounding
  // remainder instead of every share independently rounding and over/under-paying
  // the total block reward.
  const totalShares = validShares.reduce((sum, s) => sum + s.shares, 0)
  const payouts: { user_id: string; shares: number; zites_credited: number }[] = []
  let creditedSoFar = 0

  for (let i = 0; i < validShares.length; i++) {
    const s = validShares[i]
    const isLast = i === validShares.length - 1
    const zitesCredited = totalShares > 0
      ? (isLast ? Number((reward - creditedSoFar).toFixed(4)) : Number((reward * (s.shares / totalShares)).toFixed(4)))
      : 0
    creditedSoFar += zitesCredited

    await creditZitesBalance(db, s.user_id, zitesCredited)
    await db.from("mining_pool_shares").insert({
      block_id: blockId,
      pool_id: poolId,
      user_id: s.user_id,
      shares: s.shares,
      zites_credited: zitesCredited,
    })
    payouts.push({ user_id: s.user_id, shares: s.shares, zites_credited: zitesCredited })
  }

  await db
    .from("mining_pools")
    .update({
      blocks_found: (pool.blocks_found ?? 0) + 1,
      total_shares_reported: (pool.total_shares_reported ?? 0) + totalShares,
    })
    .eq("id", poolId)

  await createNotification({
    user_id: pool.owner_id,
    type: "pool_block_found",
    title: "Pool found a block",
    body: `${pool.name} found block #${currentHeight} and split ${reward.toFixed(4)} Zites across ${payouts.length} miners.`,
    link: `/mining/pools/${poolId}`,
  })

  // Height was already advanced atomically inside claimMiningBlock; run the
  // shared difficulty retarget, same as solo blocks.
  const newTarget = await maybeRetargetDifficulty(db, currentTarget, newHeight)

  return NextResponse.json({
    success: true,
    block: { height: currentHeight, reward_zites: reward },
    payouts,
    next: { height: newHeight, target: newTarget },
  })
}
