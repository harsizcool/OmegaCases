import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const db = await createClient()
  const { data, error } = await db
    .from("game_settings")
    .select("key, value")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const settings: Record<string, any> = {}
  for (const row of data ?? []) {
    settings[row.key] = row.value
  }
  return NextResponse.json(settings)
}

export async function POST(req: Request) {
  const db = await createClient()
  const body = await req.json()
  const { key, value, user_id } = body

  if (!key || value === undefined) {
    return NextResponse.json({ error: "key and value are required" }, { status: 400 })
  }

  // Auth: accept either a Bearer token OR a user_id body param
  let adminId: string | null = null

  const authHeader = req.headers.get("Authorization") || ""
  const token = authHeader.replace("Bearer ", "").trim()

  if (token) {
    // Verify via JWT
    const { data: { user } } = await db.auth.getUser(token)
    adminId = user?.id ?? null
  } else if (user_id) {
    adminId = user_id
  }

  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await db.from("users").select("admin").eq("id", adminId).single()
  if (!profile?.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { error } = await db
    .from("game_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
