import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url)
  const user_id = searchParams.get("user_id")
  if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 })

  const db = await createClient()
  const { error } = await db
    .from("oauth_apps")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
