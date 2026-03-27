import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const db = await createClient()
  const { data } = await db.from("oauth_requests").select("*").eq("id", id).single()

  if (!data) return NextResponse.json({ success: false })
  return NextResponse.json({ success: true, request: data })
}
