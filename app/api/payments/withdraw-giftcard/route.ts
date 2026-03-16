import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1482463519625445551/4O9juWv4hZGMZjk5DUxCL8RxgtGPZ_UUrY7G2qj0g-55324-cdC_UsHn5aomBW2gL-Sg"

const GC_LABELS: Record<string, string> = {
  apple: "Apple Gift Card",
  googleplay: "Google Play Gift Card",
}

const GC_IMAGES: Record<string, string> = {
  apple: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-4M8hfftlQRiF0D5HbGBpsQXzrUFnAY.png",
  googleplay: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-T1aUnzr7ks3dgdhlIzVGzqb73TOIaT.png",
}

export async function POST(request: Request) {
  const { user_id, gc_type, amount, email } = await request.json()

  if (!user_id || !gc_type || !amount || !email) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  if (![10, 20].includes(Number(amount))) {
    return NextResponse.json({ error: "Invalid gift card amount. Choose $10 or $20." }, { status: 400 })
  }

  if (!["apple", "googleplay"].includes(gc_type)) {
    return NextResponse.json({ error: "Invalid gift card type" }, { status: 400 })
  }

  if (!email.includes("@")) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
  }

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

  // Deduct balance immediately
  await supabase
    .from("users")
    .update({ balance: Number(user.balance) - Number(amount) })
    .eq("id", user_id)

  // Record withdrawal
  await supabase.from("withdrawals").insert({
    user_id,
    amount_usd: amount,
    fee_usd: 0,
    net_usd: amount,
    crypto: `giftcard_${gc_type}`,
    wallet_address: email,
    status: "pending",
  })

  const label = GC_LABELS[gc_type] ?? gc_type
  const thumbnail = GC_IMAGES[gc_type]

  // Notify Discord
  await fetch(DISCORD_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: "<@1058838805253210172> New gift card withdrawal request!",
      embeds: [
        {
          title: "Gift Card Withdrawal Request",
          color: 0x43a047,
          thumbnail: { url: thumbnail },
          fields: [
            { name: "Username", value: user.username, inline: true },
            { name: "Gift Card", value: label, inline: true },
            { name: "Amount", value: `$${Number(amount).toFixed(2)}`, inline: true },
            { name: "Delivery Email", value: email, inline: false },
          ],
          footer: { text: "Deliver within up to 3 days" },
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  })

  return NextResponse.json({ success: true })
}
