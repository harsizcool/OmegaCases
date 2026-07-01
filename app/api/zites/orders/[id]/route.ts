import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// DELETE /api/zites/orders/[id] — cancel an open/partial order owned by the caller
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()

  let body: { user_id: string } = { user_id: "" }
  try {
    body = await req.json()
  } catch {
    // allow user_id via query string too
  }
  const { searchParams } = new URL(req.url)
  const userId = body.user_id || searchParams.get("user_id")
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 })

  const { data: order } = await db.from("zites_orders").select("*").eq("id", id).single()
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
  if (order.user_id !== userId) return NextResponse.json({ error: "Not your order" }, { status: 403 })
  if (!["open", "partial"].includes(order.status)) {
    return NextResponse.json({ error: "Order is not cancellable" }, { status: 400 })
  }

  const { error } = await db
    .from("zites_orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
