import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const body = await req.json()
  const { oauth_request_id, accept } = body

  if (!oauth_request_id) {
    return NextResponse.json({ error: "oauth_request_id required" }, { status: 400 })
  }

  const db = await createClient()
  const { data: req_data } = await db
    .from("oauth_requests")
    .select("*")
    .eq("id", oauth_request_id)
    .single()

  if (!req_data) return NextResponse.json({ error: "Request not found or expired" }, { status: 404 })

  // Delete the request (one-time use)
  await db.from("oauth_requests").delete().eq("id", oauth_request_id)

  if (!accept) {
    return NextResponse.json({ success: false, message: "User declined" })
  }

  // Fetch user data
  const { data: user_data } = await db
    .from("users")
    .select("id, username, balance")
    .eq("id", req_data.user_id)
    .single()

  if (!user_data) return NextResponse.json({ error: "User not found" }, { status: 404 })

  // Build response based on permissions
  const user_info: any = {}
  if (req_data.get_user_id) user_info.user_id = user_data.id
  if (req_data.get_username) user_info.username = user_data.username
  if (req_data.get_balance) user_info.balance = user_data.balance

  // Send callback
  try {
    await fetch(req_data.callback_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, user_data: user_info }),
    })
  } catch {}

  return NextResponse.json({ success: true, redirect_url: req_data.redirect_url })
}
