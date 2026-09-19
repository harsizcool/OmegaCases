import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createNotification } from "@/lib/notifications"

// Admin user management: look people up, and adjust balance, cases and Plus.
//
// Unlike the other admin routes, these require the caller's session token as
// well as their id. The rest of the admin API only checks that the supplied
// user_id belongs to an admin, which is enough when the worst outcome is an
// edited item — but this endpoint creates balance out of nothing, and a user id
// is not a secret. The token is, so it is what proves the request came from the
// admin rather than from someone who saw their id.

const SELECT =
  "id, username, profile_picture, balance, zites_balance, cases_remaining, plus, admin, created_at"

// Limits that keep a slip of the keyboard from writing a value the column
// cannot hold. balance is NUMERIC(12,2) and cases_remaining is an integer.
const MAX_BALANCE = 99_999_999
const MAX_CASES = 10_000_000

type Adjustment = { mode?: "set" | "add"; value?: unknown }

/** Resolves an adjustment against the current value, or explains what is wrong with it. */
function resolve(
  label: string,
  current: number,
  adjustment: Adjustment,
  max: number
): { value: number } | { error: string } {
  const raw = Number(adjustment.value)
  if (!Number.isFinite(raw)) return { error: `${label} must be a number` }

  const next = adjustment.mode === "add" ? current + raw : raw
  if (!Number.isFinite(next)) return { error: `${label} is out of range` }
  if (next < 0) return { error: `${label} cannot be negative` }
  if (next > max) return { error: `${label} cannot be more than ${max.toLocaleString()}` }
  return { value: next }
}

/** Confirms the request came from a signed-in admin, and returns who that is. */
async function authorize(actor_id: unknown, session_token: unknown) {
  if (typeof actor_id !== "string" || typeof session_token !== "string" || !actor_id || !session_token) {
    return { error: "Not signed in", status: 401 as const }
  }

  const supabase = await createClient()
  const { data: actor } = await supabase
    .from("users")
    .select("id, username, admin, session_token")
    .eq("id", actor_id)
    .single()

  if (!actor || actor.session_token !== session_token) {
    return { error: "Not signed in", status: 401 as const }
  }
  if (!actor.admin) {
    return { error: "Unauthorized", status: 403 as const }
  }
  return { actor, supabase }
}

// GET /api/admin/users?actor_id=&session_token=&q= — search, or the newest accounts.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const auth = await authorize(searchParams.get("actor_id"), searchParams.get("session_token"))
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const query = (searchParams.get("q") ?? "").trim()
  let request_ = auth.supabase.from("users").select(SELECT).limit(25)

  if (query) {
    // Escape the wildcards so a search for "100%" does not match everything.
    const escaped = query.replace(/[%_]/g, (match) => `\\${match}`)
    request_ = request_.ilike("username", `%${escaped}%`).order("username")
  } else {
    request_ = request_.order("created_at", { ascending: false })
  }

  const { data, error } = await request_
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data ?? [] })
}

// POST /api/admin/users — adjust one account.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const auth = await authorize(body.actor_id, body.session_token)
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { actor, supabase } = auth

  const target_id = body.target_id
  if (typeof target_id !== "string" || !target_id) {
    return NextResponse.json({ error: "No account was chosen" }, { status: 400 })
  }

  const { data: target } = await supabase
    .from("users")
    .select("id, username, balance, cases_remaining, plus, admin")
    .eq("id", target_id)
    .single()

  if (!target) return NextResponse.json({ error: "Account not found" }, { status: 404 })

  const changes: Record<string, number | boolean> = {}
  const described: string[] = []

  if (body.balance && typeof body.balance === "object") {
    const result = resolve("Balance", Number(target.balance) || 0, body.balance, MAX_BALANCE)
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 })
    // Money is stored to two decimal places; anything finer would be lost
    // silently on write, so it is rounded here where it can be reported.
    const rounded = Math.round(result.value * 100) / 100
    if (rounded !== Number(target.balance)) {
      changes.balance = rounded
      described.push(`balance $${Number(target.balance).toFixed(2)} → $${rounded.toFixed(2)}`)
    }
  }

  if (body.cases && typeof body.cases === "object") {
    const result = resolve("Cases", Number(target.cases_remaining) || 0, body.cases, MAX_CASES)
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 })
    const whole = Math.floor(result.value)
    if (whole !== Number(target.cases_remaining)) {
      changes.cases_remaining = whole
      described.push(`cases ${target.cases_remaining ?? 0} → ${whole}`)
    }
  }

  if (typeof body.plus === "boolean" && body.plus !== target.plus) {
    changes.plus = body.plus
    described.push(body.plus ? "Plus granted" : "Plus removed")
  }

  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ user: target, changed: [], message: "Nothing to change" })
  }

  const { data: updated, error } = await supabase
    .from("users")
    .update(changes)
    .eq("id", target_id)
    .select(SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Someone whose balance moves without them doing anything deserves to know
  // why. Adjusting your own account is not worth a notification.
  if (target_id !== actor.id) {
    await createNotification({
      user_id: target_id,
      type: "announcement",
      title: "Your account was adjusted",
      body: `${actor.username} (admin) changed your account: ${described.join(", ")}.`,
    })
  }

  return NextResponse.json({ user: updated, changed: described })
}
