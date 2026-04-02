import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get("user_id")
  if (!user_id) return NextResponse.json({ error: "Missing user_id" }, { status: 400 })

  const db = createClient()

  // Grab recent DMs involving this user
  const { data, error } = await db
    .from("messages")
    .select("id, sender_id, receiver_id, content, read, created_at")
    .eq("type", "dm")
    .or(`sender_id.eq.${user_id},receiver_id.eq.${user_id}`)
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by conversation partner (most recent message wins for preview)
  const convMap = new Map<string, { last_message: string; last_at: string; unread: number }>()
  for (const msg of data ?? []) {
    const partnerId = msg.sender_id === user_id ? msg.receiver_id : msg.sender_id
    if (!partnerId) continue
    if (!convMap.has(partnerId)) {
      convMap.set(partnerId, {
        last_message: msg.content,
        last_at: msg.created_at,
        unread: msg.receiver_id === user_id && !msg.read ? 1 : 0,
      })
    } else {
      if (!msg.read && msg.receiver_id === user_id) {
        convMap.get(partnerId)!.unread++
      }
    }
  }

  if (convMap.size === 0) return NextResponse.json({ conversations: [] })

  const partnerIds = [...convMap.keys()]
  const { data: users } = await db
    .from("users")
    .select("id, username, profile_picture, plus")
    .in("id", partnerIds)

  const userMap = new Map((users ?? []).map((u: any) => [u.id, u]))

  const conversations = partnerIds
    .map((pid) => {
      const conv = convMap.get(pid)!
      const partner = userMap.get(pid)
      if (!partner) return null
      return { partner, ...conv }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime())

  return NextResponse.json({ conversations })
}
