import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { notifyReply } from "@/lib/support"

// Support tickets, staff side: the queue, one thread, and replying.

const TICKET_FIELDS =
  "id, user_id, subject, category, status, last_message_at, unread_for_staff, created_at, closed_at, users:user_id(username, profile_picture, plus)"

const MAX_BODY = 4000

// GET ?status=open|answered|closed|all [&ticket_id=]
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const auth = await requireAdmin(searchParams.get("actor_id"), searchParams.get("session_token"))
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase } = auth

  const ticketId = searchParams.get("ticket_id")
  if (ticketId) {
    const { data: ticket } = await supabase
      .from("support_tickets")
      .select(TICKET_FIELDS)
      .eq("id", ticketId)
      .single()

    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 })

    const { data: messages } = await supabase
      .from("support_messages")
      .select("id, from_staff, body, created_at, users:author_id(username)")
      .eq("ticket_id", ticketId)
      .order("created_at")

    // Opening it is what clears it from the unanswered count.
    if (ticket.unread_for_staff) {
      await supabase.from("support_tickets").update({ unread_for_staff: false }).eq("id", ticketId)
    }

    return NextResponse.json({ ticket, messages: messages ?? [] })
  }

  const status = searchParams.get("status") ?? "open"
  let query = supabase
    .from("support_tickets")
    .select(TICKET_FIELDS)
    .order("last_message_at", { ascending: false })
    .limit(100)

  if (status !== "all") query = query.eq("status", status)

  const [{ data: tickets, error }, { count: waiting }] = await Promise.all([
    query,
    supabase
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tickets: tickets ?? [], waiting: waiting ?? 0 })
}

// POST — reply to a ticket, and optionally set its status in the same move.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const auth = await requireAdmin(body.actor_id, body.session_token)
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { actor, supabase } = auth

  if (typeof body.ticket_id !== "string" || !body.ticket_id) {
    return NextResponse.json({ error: "No ticket was chosen" }, { status: 400 })
  }

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, user_id, subject, status")
    .eq("id", body.ticket_id)
    .single()

  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 })

  const message = typeof body.body === "string" ? body.body.trim() : ""
  const requestedStatus = typeof body.status === "string" ? body.status : null

  if (!message && !requestedStatus) {
    return NextResponse.json({ error: "Write a reply, or change the status" }, { status: 400 })
  }
  if (message.length > MAX_BODY) {
    return NextResponse.json({ error: `Replies are limited to ${MAX_BODY} characters` }, { status: 400 })
  }
  if (requestedStatus && !["open", "answered", "closed"].includes(requestedStatus)) {
    return NextResponse.json({ error: "Unknown status" }, { status: 400 })
  }

  const update: Record<string, unknown> = { unread_for_staff: false }

  if (message) {
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: ticket.id,
      author_id: actor.id,
      from_staff: true,
      body: message,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    update.last_message_at = new Date().toISOString()
    update.unread_for_user = true
    // A reply moves it to answered unless the status was set explicitly.
    update.status = requestedStatus ?? "answered"
  } else if (requestedStatus) {
    update.status = requestedStatus
  }

  if (update.status === "closed") update.closed_at = new Date().toISOString()

  const { data: updated, error } = await supabase
    .from("support_tickets")
    .update(update)
    .eq("id", ticket.id)
    .select(TICKET_FIELDS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Only a reply is worth a notification; a status change on its own is not.
  if (message) {
    await notifyReply(ticket.user_id, ticket.subject, ticket.id)
  }

  return NextResponse.json({ success: true, ticket: updated })
}
