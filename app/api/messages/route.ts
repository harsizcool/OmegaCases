import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { filterChat } from "@/lib/chat-filter"

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

  // Apply word filter to public messages only (DMs are private)
  const finalContent = type === "public" ? filterChat(content.trim()) : content.trim()

  const { data, error } = await db
    .from("messages")
    .insert({
      sender_id,
      receiver_id: type === "dm" ? receiver_id : null,
      content: finalContent,
      type,
    })
    .select("*, sender:sender_id(id, username, profile_picture, plus)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch sender name once for all notifications below
  const { data: senderData } = await db
    .from("users")
    .select("username")
    .eq("id", sender_id)
    .single()
  const senderName = senderData?.username ?? "Someone"

  if (type === "dm" && receiver_id) {
    // ── DM notification ──────────────────────────────────────────────────────
    await db.from("notifications").insert({
      user_id: receiver_id,
      type: "dm",
      title: "New Message",
      body: `${senderName} sent you a message`,
      link: `/chat?with=${sender_id}`,
      read: false,
    })
  } else if (type === "public") {
    // ── @mention notifications ────────────────────────────────────────────────
    const mentionPattern = /@(\w+)/g
    const mentioned: string[] = []
    let m: RegExpExecArray | null
    while ((m = mentionPattern.exec(content)) !== null) {
      const uname = m[1].toLowerCase()
      if (!mentioned.includes(uname)) mentioned.push(uname)
    }

    if (mentioned.length > 0) {
      const { data: mentionedUsers } = await db
        .from("users")
        .select("id, username")
        .in("username", mentioned)

      const toNotify = ((mentionedUsers ?? []) as { id: string; username: string }[]).filter(
        (u) => u.id !== sender_id
      )
      if (toNotify.length > 0) {
        await db.from("notifications").insert(
          toNotify.map((u) => ({
            user_id: u.id,
            type: "mention",
            title: "You were mentioned",
            body: `${senderName} mentioned you in Public Chat`,
            link: "/chat/public",
            read: false,
          }))
        )
      }
    }
  }

  return NextResponse.json(data)
}
