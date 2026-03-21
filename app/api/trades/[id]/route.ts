// API: POST /api/trades/[id]/accept  and  POST /api/trades/[id]/decline
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createNotification } from "@/lib/notifications"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: trade_id } = await params
  const { action, user_id } = await request.json()
  const supabase = await createClient()

  const { data: trade } = await supabase
    .from("trades")
    .select("*, trade_items(id, side, inventory_id)")
    .eq("id", trade_id)
    .eq("status", "pending")
    .single()

  if (!trade) return NextResponse.json({ error: "Trade not found or not pending" }, { status: 404 })

  if (action === "decline" || action === "cancel") {
    const allowed = action === "cancel" ? trade.sender_id : trade.receiver_id
    if (user_id !== allowed && user_id !== trade.sender_id && user_id !== trade.receiver_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }
    const newStatus = action === "cancel" ? "cancelled" : "declined"
    await supabase.from("trades").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", trade_id)

    // Notify the other party
    const notifyUserId = action === "cancel" ? trade.receiver_id : trade.sender_id
    await createNotification({
      user_id: notifyUserId,
      type: action === "cancel" ? "trade_cancelled" : "trade_declined",
      title: action === "cancel" ? "Trade Cancelled" : "Trade Declined",
      body: action === "cancel"
        ? "A trade offer you received was cancelled by the sender."
        : "Your trade offer was declined.",
      link: "/trade",
    })
    return NextResponse.json({ success: true })
  }

  if (action === "accept") {
    if (user_id !== trade.receiver_id) return NextResponse.json({ error: "Only receiver can accept" }, { status: 403 })

    // Check balances
    const { data: sender } = await supabase.from("users").select("id, balance").eq("id", trade.sender_id).single()
    const { data: receiver } = await supabase.from("users").select("id, balance").eq("id", trade.receiver_id).single()
    if (!sender || !receiver) return NextResponse.json({ error: "User not found" }, { status: 404 })

    if (Number(sender.balance) < trade.sender_balance) {
      return NextResponse.json({ error: "Sender no longer has enough balance" }, { status: 400 })
    }
    if (Number(receiver.balance) < trade.receiver_balance) {
      return NextResponse.json({ error: "You no longer have enough balance" }, { status: 400 })
    }

    // Swap inventory items
    const senderItems = trade.trade_items.filter((ti: any) => ti.side === "sender").map((ti: any) => ti.inventory_id)
    const receiverItems = trade.trade_items.filter((ti: any) => ti.side === "receiver").map((ti: any) => ti.inventory_id)

    for (const inv_id of senderItems) {
      await supabase.from("inventory").update({ user_id: trade.receiver_id }).eq("id", inv_id)
    }
    for (const inv_id of receiverItems) {
      await supabase.from("inventory").update({ user_id: trade.sender_id }).eq("id", inv_id)
    }

    // Transfer balances
    const senderNewBalance = Number(sender.balance) - trade.sender_balance + trade.receiver_balance
    const receiverNewBalance = Number(receiver.balance) - trade.receiver_balance + trade.sender_balance
    await supabase.from("users").update({ balance: senderNewBalance }).eq("id", trade.sender_id)
    await supabase.from("users").update({ balance: receiverNewBalance }).eq("id", trade.receiver_id)

    await supabase.from("trades").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", trade_id)

    // Notify sender their trade was accepted
    await createNotification({
      user_id: trade.sender_id,
      type: "trade_accepted",
      title: "Trade Accepted",
      body: "Your trade offer was accepted!",
      link: "/trade",
    })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
