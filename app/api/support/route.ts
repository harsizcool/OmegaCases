import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSupportSettings } from "@/lib/support"

// Support tickets, player side: open one, read your own, add to the thread.
//
// A ticket is identified by the account that owns it, and the session token is
// what proves the request comes from that account. Without it, anyone knowing a
// user id could read someone else's support thread, which is exactly the kind of
// thing people put payment details in.

const TICKET_FIELDS =
  "id, subject, category, status, last_message_at, unread_for_user, created_at, closed_at"

const MAX_SUBJECT = 120
const MAX_BODY = 4000
const MAX_OPEN_TICKETS = 5

async function authenticate(user_id: unknown, session_token: unknown) {
  if (typeof user_id !== "string" || typeof session_token !== "string" || !user_id || !session_token) {
    return { error: "Not signed in", status: 401 as const }
  }
  const supabase = await createClient()
  const { data: user } = await supabase
    .from("users")
    .select("id, username, session_token")
    .eq("id", user_id)
    .single()

  if (!user || user.session_token !== session_token) {
    return { error: "Not signed in", status: 401 as const }
  }
  return { user, supabase }
}

// GET ?user_id=&session_token=[&ticket_id=] — your tickets, or one whole thread.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const auth = await authenticate(searchParams.get("user_id"), searchParams.get("session_token"))
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { user, supabase } = auth

  const ticketId = searchParams.get("ticket_id")
  if (!ticketId) {
    const [{ data: tickets }, settings] = await Promise.all([
      supabase
        .from("support_tickets")
        .select(TICKET_FIELDS)
        .eq("user_id", user.id)
        .order("last_message_at", { ascending: false })
        .limit(50),
      getSupportSettings(),
    ])
    return NextResponse.json({ tickets: tickets ?? [], ...settings })
  }

  // Scoped to the signed-in account, so a guessed id returns nothing rather than
  // someone else's thread.
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select(TICKET_FIELDS)
    .eq("id", ticketId)
    .eq("user_id", user.id)
    .single()

  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 })

  const { data: messages } = await supabase
    .from("support_messages")
    .select("id, from_staff, body, created_at, users:author_id(username)")
    .eq("ticket_id", ticketId)
    .order("created_at")

  // Opening the thread is what marks it read for this side.
  if (ticket.unread_for_user) {
    await supabase.from("support_tickets").update({ unread_for_user: false }).eq("id", ticketId)
  }

  return NextResponse.json({ ticket, messages: messages ?? [] })
}

// POST — open a ticket, or reply to one of yours.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const auth = await authenticate(body.user_id, body.session_token)
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { user, supabase } = auth

  const message = typeof body.body === "string" ? body.body.trim() : ""
  if (!message) return NextResponse.json({ error: "Write a message first" }, { status: 400 })
  if (message.length > MAX_BODY) {
    return NextResponse.json({ error: `Messages are limited to ${MAX_BODY} characters` }, { status: 400 })
  }

  // ─── reply to an existing ticket ───────────────────────────────────────────
  if (typeof body.ticket_id === "string" && body.ticket_id) {
    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("id, status, subject")
      .eq("id", body.ticket_id)
      .eq("user_id", user.id)
      .single()

    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    if (ticket.status === "closed") {
      return NextResponse.json(
        { error: "This ticket is closed. Open a new one and mention it." },
        { status: 409 }
      )
    }

    await supabase.from("support_messages").insert({
      ticket_id: ticket.id,
      author_id: user.id,
      from_staff: false,
      body: message,
    })
    // Back to open: a reply from the player means it needs looking at again.
    await supabase
      .from("support_tickets")
      .update({
        status: "open",
        last_message_at: new Date().toISOString(),
        unread_for_staff: true,
      })
      .eq("id", ticket.id)

    return NextResponse.json({ success: true, ticket_id: ticket.id })
  }

  // ─── open a new ticket ─────────────────────────────────────────────────────
  const { enabled } = await getSupportSettings()
  if (!enabled) {
    return NextResponse.json(
      { error: "Support is not accepting new tickets at the moment." },
      { status: 503 }
    )
  }

  const subject = typeof body.subject === "string" ? body.subject.trim() : ""
  if (!subject) return NextResponse.json({ error: "Give your ticket a subject" }, { status: 400 })
  if (subject.length > MAX_SUBJECT) {
    return NextResponse.json({ error: `Subjects are limited to ${MAX_SUBJECT} characters` }, { status: 400 })
  }

  const category = typeof body.category === "string" ? body.category : "other"
  const allowed = ["payment", "account", "trade", "bug", "report", "other"]
  if (!allowed.includes(category)) {
    return NextResponse.json({ error: "Pick one of the listed categories" }, { status: 400 })
  }

  // A cap on open tickets, so the queue cannot be flooded from one account.
  const { count } = await supabase
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .neq("status", "closed")

  if ((count ?? 0) >= MAX_OPEN_TICKETS) {
    return NextResponse.json(
      {
        error: `You already have ${count} tickets waiting. Add to one of those instead of opening another.`,
      },
      { status: 429 }
    )
  }

  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({ user_id: user.id, subject, category })
    .select(TICKET_FIELDS)
    .single()

  if (error || !ticket) {
    return NextResponse.json({ error: error?.message ?? "Could not open the ticket" }, { status: 500 })
  }

  await supabase.from("support_messages").insert({
    ticket_id: ticket.id,
    author_id: user.id,
    from_staff: false,
    body: message,
  })

  return NextResponse.json({ success: true, ticket })
}

// PATCH — the player closing their own ticket.
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const auth = await authenticate(body.user_id, body.session_token)
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { user, supabase } = auth

  if (typeof body.ticket_id !== "string" || !body.ticket_id) {
    return NextResponse.json({ error: "No ticket was chosen" }, { status: 400 })
  }

  const { error } = await supabase
    .from("support_tickets")
    .update({ status: "closed", closed_at: new Date().toISOString(), unread_for_staff: false })
    .eq("id", body.ticket_id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
