"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * Tracks how many authenticated users are currently online using
 * Supabase Realtime Presence. Each signed-in browser tab joins the
 * shared "online-users" channel and tracks itself. The count is the
 * number of unique user keys present at any given moment.
 */
export function useOnlineUsers(userId?: string | null) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    // Only track if the viewer is signed in
    if (!userId) return

    const supabase = createClient()
    const channel = supabase.channel("online-users", {
      config: { presence: { key: userId } },
    })

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState()
        setCount(Object.keys(state).length)
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: userId, online_at: new Date().toISOString() })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  return count
}
