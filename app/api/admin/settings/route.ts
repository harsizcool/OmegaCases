import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAnonClient } from "@supabase/supabase-js"

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
  // Verify admin via bearer token sent from the browser
  const authHeader = req.headers.get("Authorization") || ""
  const token = authHeader.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const anonDb = createAnonClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await anonDb.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Check admin flag using service role client
  const db = await createClient()
  const { data: profile } = await db.from("users").select("admin").eq("id", user.id).single()
  if (!profile?.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { key, value } = body
  if (!key || value === undefined) {
    return NextResponse.json({ error: "key and value are required" }, { status: 400 })
  }

  const { error } = await db
    .from("game_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
