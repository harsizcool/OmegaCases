import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { randomUUID } from "crypto"

export async function POST(req: Request) {
  const body = await req.json()
  const { callback_URL, redirect_after_success, getBalance, getUserId, getUsername, service_name } = body

  if (!callback_URL || !service_name) {
    return NextResponse.json({ error: "callback_URL and service_name required" }, { status: 400 })
  }

  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const requestId = randomUUID().slice(0, 8)
  const { error } = await db.from("oauth_requests").insert({
    id: requestId,
    user_id: user.id,
    service_name: service_name || "Unknown Service",
    callback_url: callback_URL,
    redirect_url: redirect_after_success || callback_URL,
    get_user_id: getUserId || false,
    get_username: getUsername || false,
    get_balance: getBalance || false,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    generated_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://omegacases.com"}/ext/auth/${requestId}`,
  })
}
