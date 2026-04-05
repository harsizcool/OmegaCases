import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get("username")
  const id       = searchParams.get("id")

  const supabase = await createClient()

  if (username) {
    const { data } = await supabase
      .from("users")
      .select("id, username, profile_picture, balance, plus, cases, created_at")
      .ilike("username", username)
      .single()
    if (!data) return NextResponse.json({ error: "User not found" }, { status: 404 })
    return NextResponse.json(data)
  }

  if (id) {
    const { data } = await supabase
      .from("users")
      .select("id, username, profile_picture, balance, plus, cases, created_at")
      .eq("id", id)
      .single()
    if (!data) return NextResponse.json({ error: "User not found" }, { status: 404 })
    return NextResponse.json(data)
  }

  // No filter — return limited list (search use-case)
  const { data } = await supabase
    .from("users")
    .select("id, username, profile_picture")
    .order("username")
    .limit(50)
  return NextResponse.json(data || [])
}
