// API: GET/POST /api/trades
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createNotification } from "@/lib/notifications"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get("user_id")
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 })

  const supabase = await createClient()

  const { data: sent } = await supabase
    .from("trades")
    .select(`
      *,
      receiver:users!trades_receiver_id_fkey(id, username, profile_picture, plus),
      trade_items(id, side, inventory:inventory(id, item_id, items(id, name, image_url, rarity, rap)))
    `)
    .eq("sender_id", userId)
    .order("created_at", { ascending: false })

  const { data: received } = await supabase
    .from("trades")
    .select(`
      *,
      sender:users!trades_sender_id_fkey(id, username, profile_picture, plus),
      trade_items(id, side, inventory:inventory(id, item_id, items(id, name, image_url, rarity, rap)))
    `)
    .eq("receiver_id", userId)
    .order("created_at", { ascending: false })

  return NextResponse.json({ sent: sent || [], received: received || [] })
}

export async function POST(request: Request) {
  const body = await request.json()
  const { sender_id, receiver_id, sender_items, receiver_items, sender_balance, receiver_balance } = body
  const supabase = await createClient()

  // Validate balance caps
  if (Number(sender_balance) > 50 || Number(receiver_balance) > 50) {
    return NextResponse.json({ error: "Max $50 balance per trade side" }, { status: 400 })
  }
  if ((sender_items?.length || 0) > 6 || (receiver_items?.length || 0) > 6) {
    return NextResponse.json({ error: "Max 6 items per side" }, { status: 400 })
  }
  if (sender_id === receiver_id) {
    return NextResponse.json({ error: "Cannot trade with yourself" }, { status: 400 })
  }

  // Verify sender has enough balance
  const { data: senderUser } = await supabase
    .from("users").select("balance").eq("id", sender_id).single()
  if (!senderUser) return NextResponse.json({ error: "Sender not found" }, { status: 404 })
  if (Number(senderUser.balance) < Number(sender_balance)) {
    return NextResponse.json({ error: "Insufficient balance to offer" }, { status: 400 })
  }

  // Create trade
  const { data: trade, error } = await supabase
    .from("trades")
    .insert({ sender_id, receiver_id, sender_balance: Number(sender_balance) || 0, receiver_balance: Number(receiver_balance) || 0 })
    .select()
    .single()
  if (error || !trade) return NextResponse.json({ error: error?.message || "Failed to create trade" }, { status: 500 })

  // Insert trade items
  const itemInserts = [
    ...(sender_items || []).map((inv_id: string) => ({ trade_id: trade.id, inventory_id: inv_id, side: "sender" })),
    ...(receiver_items || []).map((inv_id: string) => ({ trade_id: trade.id, inventory_id: inv_id, side: "receiver" })),
  ]
  if (itemInserts.length > 0) {
    await supabase.from("trade_items").insert(itemInserts)
  }

  // Notify receiver of new trade offer
  const { data: senderProfile } = await supabase
    .from("users").select("username").eq("id", sender_id).single()
  await createNotification({
    user_id: receiver_id,
    type: "trade_received",
    title: "New Trade Offer",
    body: `${senderProfile?.username ?? "Someone"} sent you a trade offer.`,
    link: "/trade",
  })

  return NextResponse.json({ success: true, trade_id: trade.id })
}
