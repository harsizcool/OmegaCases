import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("users")
    .select("id, username, profile_picture")
    .order("username")
  return NextResponse.json(data || [])
}
