import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const type = searchParams.get("type") || "dm"
  const user_id = searchParams.get("user_id")
  const with_user = searchParams.get("with")
  const limit = Math.min(parseInt(searchParams.get("limit") || "60"), 100)
  const before = searchParams.get("before")

  const db = createClient()

  // Unread count shortcut for navbar badge
  if (searchParams.get("unread_count") && user_id) {
    const { count } = await db
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("type", "dm")
      .eq("receiver_id", user_id)
      .eq("read", false)
    return NextResponse.json({ unread: count ?? 0 })
  }

  if (type === "public") {
    let q = db
      .from("messages")
      .select("*, sender:sender_id(id, username, profile_picture, plus)")
      .eq("type", "public")
      .order("created_at", { ascending: false })
      .limit(limit)
    if (before) q = q.lt("created_at", before)
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ messages: (data ?? []).reverse() })
  }

  // DM history between two users
  if (!user_id || !with_user)
    return NextResponse.json({ error: "Missing user_id or with" }, { status: 400 })

  let q = db
    .from("messages")
    .select("*, sender:sender_id(id, username, profile_picture, plus)")
    .eq("type", "dm")
    .or(
      `and(sender_id.eq.${user_id},receiver_id.eq.${with_user}),and(sender_id.eq.${with_user},receiver_id.eq.${user_id})`
    )
    .order("created_at", { ascending: false })
    .limit(limit)
  if (before) q = q.lt("created_at", before)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark incoming messages as read
  await db
    .from("messages")
    .update({ read: true })
    .eq("type", "dm")
    .eq("sender_id", with_user)
    .eq("receiver_id", user_id)
    .eq("read", false)

  return NextResponse.json({ messages: (data ?? []).reverse() })
}

export async function POST(req: NextRequest) {
  const { sender_id, receiver_id, content, type = "dm" } = await req.json()

  if (!sender_id || !content?.trim())
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  if (type === "dm" && !receiver_id)
    return NextResponse.json({ error: "Missing receiver_id" }, { status: 400 })
  if (content.length > 500)
    return NextResponse.json({ error: "Message too long (max 500 chars)" }, { status: 400 })

  const db = createClient()

  const { data, error } = await db
    .from("messages")
    .insert({
      sender_id,
      receiver_id: type === "dm" ? receiver_id : null,
      content: content.trim(),
      type,
    })
    .select("*, sender:sender_id(id, username, profile_picture, plus)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify DM recipient
  if (type === "dm" && receiver_id) {
    const { data: sender } = await db
      .from("users")
      .select("username")
      .eq("id", sender_id)
      .single()
    await db.from("notifications").insert({
      user_id: receiver_id,
      type: "dm",
      message: `New message from ${sender?.username ?? "someone"}`,
      read: false,
    })
  }

  return NextResponse.json(data)
}
