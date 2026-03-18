import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requirePlusUser } from "@/lib/require-plus"

const PAGE_SIZE = 1000

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const { searchParams } = new URL(request.url)

  // If a user_id param is passed (API docs external call), enforce Plus auth
  const apiUserId = searchParams.get("user_id")
  if (apiUserId !== null) {
    const auth = await requirePlusUser(apiUserId)
    if (auth.error) return auth.error
  }

  const page = Math.max(0, parseInt(searchParams.get("page") || "0", 10))
  const supabase = await createClient()

  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data, error, count } = await supabase
    .from("inventory")
    .select("*, items(*)", { count: "exact" })
    .eq("user_id", userId)
    .order("obtained_at", { ascending: false })
    .range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data || [], total: count ?? 0, page, pageSize: PAGE_SIZE })
}
