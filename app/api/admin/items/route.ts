import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/admin-auth"

const RARITIES = ["Common", "Uncommon", "Rare", "Legendary", "Omega"]

// Admin-only: Create item
export async function POST(request: Request) {
  const body = await request.json()
  const { user_id, name, image_url, rarity, likelihood, market_price } = body

  const supabase = await createClient()

  // Verify admin
  const { data: user } = await supabase
    .from("users")
    .select("admin")
    .eq("id", user_id)
    .single()

  if (!user?.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("items")
    .insert({ name, image_url, rarity, likelihood, market_price, rap: market_price })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// GET: all items, or — with ?usage=<id> — what deleting one item would destroy.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)

  const usageFor = searchParams.get("usage")
  if (usageFor) {
    const auth = await requireAdmin(searchParams.get("actor_id"), searchParams.get("session_token"))
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    return NextResponse.json({ usage: await countUsage(auth.supabase, usageFor) })
  }

  const { data } = await supabase.from("items").select("*").order("rarity").order("name")
  return NextResponse.json(data || [])
}

// ─── Editing and removal ─────────────────────────────────────────────────────
//
// These require the caller's session token as well as their id (see
// requireAdmin). Editing an item changes what everyone's inventory is worth, and
// deleting one destroys data, so proof of who is asking matters more here than
// it does for the list above.

/** The fields an admin may change, with how each is validated. */
const EDITABLE = {
  name: (v: unknown) =>
    typeof v === "string" && v.trim().length > 0 && v.trim().length <= 120
      ? { value: v.trim() }
      : { error: "Name must be between 1 and 120 characters" },
  image_url: (v: unknown) =>
    typeof v === "string" && v.trim().length > 0
      ? { value: v.trim() }
      : { error: "An image is required" },
  rarity: (v: unknown) =>
    typeof v === "string" && RARITIES.includes(v)
      ? { value: v }
      : { error: `Rarity must be one of ${RARITIES.join(", ")}` },
  likelihood: (v: unknown) =>
    Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100
      ? { value: Number(v) }
      : { error: "Likelihood must be a percentage between 0 and 100" },
  market_price: (v: unknown) =>
    Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 9_999_999
      ? { value: Math.round(Number(v) * 100) / 100 }
      : { error: "Price must be between 0 and 9,999,999" },
  rap: (v: unknown) =>
    Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 9_999_999
      ? { value: Math.round(Number(v) * 100) / 100 }
      : { error: "RAP must be between 0 and 9,999,999" },
  limited_time: (v: unknown) =>
    typeof v === "boolean" ? { value: v } : { error: "Limited time must be true or false" },
} as const

// PATCH: edit an existing item.
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const auth = await requireAdmin(body.actor_id, body.session_token)
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "No item was chosen" }, { status: 400 })
  }

  const changes: Record<string, unknown> = {}
  for (const [field, validate] of Object.entries(EDITABLE)) {
    if (!(field in body)) continue
    const result = validate(body[field])
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 })
    changes[field] = result.value
  }

  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ error: "Nothing to change" }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from("items")
    .update(changes)
    .eq("id", body.id)
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Item not found" }, { status: 404 })
  return NextResponse.json(data)
}

// DELETE: remove an item permanently.
//
// Every table that references an item does so with ON DELETE CASCADE, so this
// also erases the inventory rows that hold it, its marketplace listings and
// sales, and the provably-fair roll records that produced it. None of that can
// be recovered, which is why the caller has to have counted the cost first: the
// item's own name is required as confirmation, and the counts are available from
// GET ?usage=<id> so they can be shown before anyone types it.
export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const auth = await requireAdmin(body.actor_id, body.session_token)
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "No item was chosen" }, { status: 400 })
  }

  const { data: item } = await auth.supabase
    .from("items")
    .select("id, name")
    .eq("id", body.id)
    .single()

  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 })

  if (typeof body.confirm_name !== "string" || body.confirm_name.trim() !== item.name) {
    return NextResponse.json(
      { error: `To delete this item, type its name exactly: ${item.name}` },
      { status: 400 }
    )
  }

  const usage = await countUsage(auth.supabase, item.id)
  const { error } = await auth.supabase.from("items").delete().eq("id", item.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: item.name, destroyed: usage })
}

/** Counts what a deletion would take with it. */
async function countUsage(supabase: SupabaseLike, item_id: string) {
  const count = async (table: string) => {
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("item_id", item_id)
    return count ?? 0
  }

  const [inventory, listings, sales, rolls, battle_rolls] = await Promise.all([
    count("inventory"),
    count("listings"),
    count("sales"),
    count("rolls"),
    count("battle_rolls"),
  ])
  return { inventory, listings, sales, rolls, battle_rolls }
}

type SupabaseLike = Awaited<ReturnType<typeof createClient>>
