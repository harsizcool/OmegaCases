import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST /api/oauth/notify
// Body: { token, title, body }
// Sends a notification to the authorized user. Requires notify scope.
export async function POST(req: Request) {
  const { token, title, body } = await req.json()
  if (!token || !title || !body) {
    return NextResponse.json({ error: "token, title, and body required" }, { status: 400 })
  }

  const db = await createClient()

  const { data: tok } = await db
    .from("oauth_tokens")
    .select("user_id, scopes, oauth_apps(name)")
    .eq("token", token)
    .single()

  if (!tok) return NextResponse.json({ error: "Invalid or revoked token" }, { status: 401 })
  if (!tok.scopes.includes("notify")) {
    return NextResponse.json({ error: "Token does not have notify scope" }, { status: 403 })
  }

  const appName = (tok.oauth_apps as any)?.name ?? "An application"

  await db.from("notifications").insert({
    user_id: tok.user_id,
    type:    "announcement",
    title:   `${appName}: ${title}`,
    body,
    link:    null,
  })

  await db.from("oauth_tokens").update({ last_used_at: new Date().toISOString() }).eq("token", token)

  return NextResponse.json({ ok: true })
}
