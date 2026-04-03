import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/oauth/app?client_id=xxx — public, returns app name + owner + scopes
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get("client_id")
  if (!client_id) return NextResponse.json({ error: "client_id required" }, { status: 400 })

  const db = await createClient()
  const { data } = await db
    .from("oauth_apps")
    .select("name, scopes, users(username)")
    .eq("client_id", client_id)
    .single()

  if (!data) return NextResponse.json({ error: "App not found" }, { status: 404 })
  return NextResponse.json({
    name: data.name,
    scopes: data.scopes,
    owner: (data as any).users?.username ?? "unknown",
  })
}
