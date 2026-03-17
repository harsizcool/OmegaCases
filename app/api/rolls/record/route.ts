import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const { user_id, item_id } = await request.json()
  if (!user_id || !item_id) {
    return NextResponse.json({ error: "Missing user_id or item_id" }, { status: 400 })
  }
  const supabase = await createClient()
  const { error } = await supabase.from("rolls").insert({ user_id, item_id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
