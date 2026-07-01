import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST /api/mining/pools/[id]/join — { user_id } declares the user a pool participant
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()

  let body: { user_id: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (!body.user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 })

  const { data: pool } = await db.from("mining_pools").select("id, host, port, status").eq("id", id).single()
  if (!pool) return NextResponse.json({ error: "Pool not found" }, { status: 404 })

  const { error } = await db.from("mining_pool_members").insert({ pool_id: id, user_id: body.user_id })
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Already joined" }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { count } = await db.from("mining_pool_members").select("id", { count: "exact", head: true }).eq("pool_id", id)
  await db.from("mining_pools").update({ member_count: count ?? 0 }).eq("id", id)

  return NextResponse.json({ success: true, connect: { host: pool.host, port: pool.port } })
}

// DELETE /api/mining/pools/[id]/join — { user_id } leaves the pool
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()

  let body: { user_id: string } = { user_id: "" }
  try {
    body = await req.json()
  } catch {}
  const { searchParams } = new URL(req.url)
  const userId = body.user_id || searchParams.get("user_id")
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 })

  const { error } = await db.from("mining_pool_members").delete().eq("pool_id", id).eq("user_id", userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { count } = await db.from("mining_pool_members").select("id", { count: "exact", head: true }).eq("pool_id", id)
  await db.from("mining_pools").update({ member_count: count ?? 0 }).eq("id", id)

  return NextResponse.json({ success: true })
}
