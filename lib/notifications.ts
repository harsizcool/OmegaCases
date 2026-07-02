import { createClient } from "@/lib/supabase/server"

export type NotificationType =
  | "item_sold"
  | "trade_received"
  | "trade_accepted"
  | "trade_declined"
  | "trade_cancelled"
  | "announcement"
  | "oauth_spend"
  | "pool_activated"
  | "pool_liveness_failed"
  | "pool_offline"
  | "pool_block_found"
  | "pool_reward"

export async function createNotification({
  user_id,
  type,
  title,
  body,
  link,
}: {
  user_id: string
  type: NotificationType
  title: string
  body: string
  link?: string
}) {
  const supabase = await createClient()
  await supabase.from("notifications").insert({ user_id, type, title, body, link: link ?? null })
}
