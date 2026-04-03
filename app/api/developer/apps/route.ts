import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { randomBytes } from "crypto"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const user_id = searchParams.get("user_id")
  if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 })

  const db = await createClient()
  const { data } = await db
    .from("oauth_apps")
    .select("id, name, client_id, client_secret, scopes, created_at")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })

  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const { user_id, name, scopes } = await req.json()
  if (!user_id || !name?.trim())
    return NextResponse.json({ error: "user_id and name required" }, { status: 400 })

  const db = await createClient()
  const client_id     = randomBytes(12).toString("hex")
  const client_secret = randomBytes(24).toString("hex")

  const { data, error } = await db
    .from("oauth_apps")
    .insert({ user_id, name: name.trim(), client_id, client_secret, scopes: scopes ?? [] })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
