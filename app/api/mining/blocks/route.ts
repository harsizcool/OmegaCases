import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const PAGE_SIZE = 20

// GET /api/mining/blocks?page=0&height=<specific>
// Returns paginated blocks with miner username joined
export async function GET(req: Request) {
  const db = await createClient()
  const { searchParams } = new URL(req.url)
  const heightParam = searchParams.get("height")
  const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10))

  // Single block lookup
  if (heightParam !== null) {
    const { data, error } = await db
      .from("mining_blocks")
      .select("*, users(id, username, profile_picture, plus), mining_pools(id, name)")
      .eq("height", parseInt(heightParam, 10))
      .single()
    if (error || !data) return NextResponse.json({ error: "Block not found" }, { status: 404 })

    // Pool blocks: attach the per-user share split so the UI can show who
    // contributed without exposing the underlying miner_id (the pool owner).
    if (data.pool_id) {
      const { data: shares } = await db
        .from("mining_pool_shares")
        .select("user_id, shares, zites_credited, users(id, username, profile_picture, plus)")
        .eq("block_id", data.id)
        .order("zites_credited", { ascending: false })
      data.shares = shares ?? []
    }

    return NextResponse.json({ block: data })
  }

  // Paginated list (most recent first)
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data, error, count } = await db
    .from("mining_blocks")
    .select("*, users(id, username, profile_picture, plus), mining_pools(id, name)", { count: "exact" })
    .order("height", { ascending: false })
    .range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    blocks: data ?? [],
    total: count ?? 0,
    page,
    has_more: (count ?? 0) > to + 1,
  })
}
