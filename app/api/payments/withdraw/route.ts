import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1482463519625445551/4O9juWv4hZGMZjk5DUxCL8RxgtGPZ_UUrY7G2qj0g-55324-cdC_UsHn5aomBW2gL-Sg"

export async function POST(request: Request) {
  const { user_id, amount, crypto, wallet_address } = await request.json()

  if (!user_id || !amount || !crypto || !wallet_address) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  if (Number(amount) < 3) {
    return NextResponse.json({ error: "Minimum withdrawal is $3.00" }, { status: 400 })
  }

  const FEE_RATE = 0.05
  const fee = Number(amount) * FEE_RATE
  const net = Number(amount) - fee

  const supabase = await createClient()

  const { data: user } = await supabase
    .from("users")
    .select("balance, username")
    .eq("id", user_id)
    .single()

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if (Number(user.balance) < Number(amount)) {
    return NextResponse.json({ error: "Insufficient balance" }, { status: 402 })
  }

  // Deduct balance
  await supabase
    .from("users")
    .update({ balance: Number(user.balance) - Number(amount) })
    .eq("id", user_id)

  // Record withdrawal
  await supabase.from("withdrawals").insert({
    user_id,
    amount_usd: amount,
    fee_usd: fee,
    net_usd: net,
    crypto,
    wallet_address,
    status: "pending",
  })

  // Send Discord webhook
  await fetch(DISCORD_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: "New Withdrawal Request",
          color: 0x1976d2,
          fields: [
            { name: "Username", value: user.username, inline: true },
            { name: "Crypto", value: crypto, inline: true },
            { name: "Amount (USD)", value: `$${Number(amount).toFixed(2)}`, inline: true },
            { name: "Fee (5%)", value: `$${fee.toFixed(2)}`, inline: true },
            { name: "Net Payout", value: `$${net.toFixed(2)}`, inline: true },
            { name: "Wallet Address", value: `\`${wallet_address}\``, inline: false },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  })

  return NextResponse.json({ success: true, fee, net })
}
