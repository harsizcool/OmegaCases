import { createClient } from "@/lib/supabase/server"
import { createNotification } from "@/lib/notifications"

export const SUPPORT_CATEGORIES = [
  { value: "payment", label: "Deposits and withdrawals" },
  { value: "account", label: "My account" },
  { value: "trade", label: "Trades and the marketplace" },
  { value: "bug", label: "Something is broken" },
  { value: "report", label: "Reporting someone" },
  { value: "other", label: "Something else" },
] as const

export type SupportSettings = {
  /** Whether the support page accepts new tickets. */
  enabled: boolean
  /** A note shown above the form, for things like "replies take 24 hours". */
  notice: string
}

/** Reads the admin-controlled support settings, defaulting to open with no note. */
export async function getSupportSettings(): Promise<SupportSettings> {
  try {
    const db = await createClient()
    const { data } = await db
      .from("game_settings")
      .select("key, value")
      .in("key", ["support_enabled", "support_notice"])

    const settings: Record<string, unknown> = {}
    for (const row of data ?? []) settings[row.key] = row.value

    return {
      // Only an explicit false closes support: a missing row should not leave
      // players with no way to get help.
      enabled: settings.support_enabled !== false,
      notice: typeof settings.support_notice === "string" ? settings.support_notice : "",
    }
  } catch {
    return { enabled: true, notice: "" }
  }
}

/** Tells a player that staff have answered, with a link straight to the thread. */
export async function notifyReply(user_id: string, subject: string, ticket_id: string) {
  await createNotification({
    user_id,
    type: "announcement",
    title: "Support replied",
    body: `Support answered your ticket “${subject}”.`,
    link: `/support?ticket=${ticket_id}`,
  })
}
