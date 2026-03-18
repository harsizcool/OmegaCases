import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from("users")
    .select("id, username, profile_picture, balance, admin, plus, cases, created_at")
    .eq("username", username)
    .single()

  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(data)
}
