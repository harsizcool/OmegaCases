import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/notifications?user_id=xxx
export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get("user_id")
  if (!user_id) return NextResponse.json({ error: "Missing user_id" }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notifications: data ?? [] })
}

// POST /api/notifications  body: { user_id, ids, action: "read" | "read_all" }
export async function POST(req: NextRequest) {
  const { user_id, ids, action } = await req.json()
  if (!user_id) return NextResponse.json({ error: "Missing user_id" }, { status: 400 })

  const supabase = await createClient()

  if (action === "read_all") {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (action === "read" && Array.isArray(ids) && ids.length > 0) {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user_id)
      .in("id", ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
