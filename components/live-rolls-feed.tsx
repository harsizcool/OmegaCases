"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"

const RARITY_COLORS: Record<string, string> = {
  Common: "#9e9e9e",
  Uncommon: "#4caf50",
  Rare: "#2196f3",
  Legendary: "#ff9800",
  Omega: "#e91e63",
}

type Roll = {
  id: string
  created_at: string
  user_id: string
  item_id: string
  username: string
  item_name: string
  image_url: string | null
  rarity: string
  rap: number
}

const MAX_ROLLS = 30

export default function LiveRollsFeed() {
  const [rolls, setRolls] = useState<Roll[]>([])
  const [connected, setConnected] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const tickerRef = useRef<HTMLDivElement>(null)
  const seenIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    fetch("/api/rolls")
      .then((r) => r.json())
      .then((data: Roll[]) => {
        if (Array.isArray(data)) {
          data.forEach((r) => seenIds.current.add(r.id))
          setRolls(data)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel("rolls-feed", { config: { broadcast: { ack: false } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rolls" },
        async (payload) => {
          const row = payload.new as { id: string; user_id: string; item_id: string; created_at: string }
          if (seenIds.current.has(row.id)) return
          seenIds.current.add(row.id)

          const [userRes, itemRes] = await Promise.all([
            supabase.from("users").select("username").eq("id", row.user_id).single(),
            supabase.from("items").select("name, image_url, rarity, rap").eq("id", row.item_id).single(),
          ])

          const enriched: Roll = {
            id: row.id,
            created_at: row.created_at,
            user_id: row.user_id,
            item_id: row.item_id,
            username: userRes.data?.username ?? "anon",
            item_name: itemRes.data?.name ?? "Unknown",
            image_url: itemRes.data?.image_url ?? null,
            rarity: itemRes.data?.rarity ?? "Common",
            rap: itemRes.data?.rap ?? 0,
          }

          setRolls((prev) => [...prev, enriched].slice(-MAX_ROLLS))
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED")
      })

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  })

  useEffect(() => {
    if (tickerRef.current) {
      tickerRef.current.scrollLeft = tickerRef.current.scrollWidth
    }
  })

  return (
    <>
      {/* Desktop: right sidebar (lg+) */}
      <div className="hidden lg:flex w-[220px] shrink-0 sticky top-[72px] h-[calc(100vh-80px)] flex-col bg-card border-l border-border overflow-hidden z-10">
        <div className="px-3 py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full shrink-0 transition-all duration-300"
              style={{
                backgroundColor: connected ? "#4caf50" : "#bdbdbd",
                boxShadow: connected ? "0 0 6px #4caf50" : "none",
                animation: connected ? "pulse 2s infinite" : "none",
              }}
            />
            <span className="text-[0.65rem] font-bold uppercase tracking-wide">Live Rolls</span>
            <span className="ml-auto text-[0.65rem] text-muted-foreground">{rolls.length}</span>
          </div>
        </div>

        <div
          ref={listRef}
          className="flex-1 overflow-y-auto flex flex-col [scrollbar-width:thin] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full"
        >
          {rolls.length === 0 && (
            <p className="text-[0.7rem] text-muted-foreground p-4 text-center">No rolls yet — open some cases!</p>
          )}
          {rolls.map((roll) => {
            const color = RARITY_COLORS[roll.rarity] ?? "#9e9e9e"
            return (
              <div
                key={roll.id}
                className="flex items-center gap-2 px-3 py-1.5 border-b border-border hover:bg-accent transition-colors"
                style={{ borderLeft: `3px solid ${color}` }}
              >
                <img
                  src={roll.image_url ?? "/placeholder.svg?width=32&height=32"}
                  alt={roll.item_name}
                  className="w-8 h-8 object-contain shrink-0 rounded"
                />
                <div className="flex-1 min-w-0">
                  <span
                    className="block text-[0.65rem] font-bold overflow-hidden text-ellipsis whitespace-nowrap leading-snug"
                    style={{ color }}
                  >
                    {roll.item_name}
                  </span>
                  <span className="block text-[0.6rem] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                    {roll.username}
                  </span>
                  <span
                    className="text-[0.55rem] font-semibold px-1 py-px rounded-full mt-0.5 inline-block"
                    style={{ backgroundColor: color + "22", color }}
                  >
                    {roll.rarity}
                  </span>
                </div>
                {roll.rap > 0 && (
                  <span className="text-[0.6rem] font-bold shrink-0 whitespace-nowrap" style={{ color }}>
                    ${Number(roll.rap).toFixed(0)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Mobile: bottom ticker bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 border-t border-border flex items-center h-11 backdrop-blur-sm">
        <div className="flex items-center gap-1.5 px-3 border-r border-border shrink-0 h-full">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              backgroundColor: connected ? "#4caf50" : "#bdbdbd",
              boxShadow: connected ? "0 0 6px #4caf50" : "none",
            }}
          />
          <span className="text-[0.6rem] font-bold uppercase tracking-wide whitespace-nowrap">Live</span>
        </div>

        <div
          ref={tickerRef}
          className="flex-1 flex items-center gap-2 overflow-x-auto px-2 h-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {rolls.length === 0 && (
            <span className="text-[0.65rem] text-muted-foreground whitespace-nowrap px-2">No rolls yet</span>
          )}
          {rolls.map((roll) => {
            const color = RARITY_COLORS[roll.rarity] ?? "#9e9e9e"
            return (
              <div
                key={roll.id}
                className="flex items-center gap-1 shrink-0 rounded px-1.5 py-0.5"
                style={{
                  border: `1px solid ${color}44`,
                  borderLeft: `3px solid ${color}`,
                  backgroundColor: color + "11",
                }}
              >
                <img
                  src={roll.image_url ?? "/placeholder.svg?width=24&height=24"}
                  alt={roll.item_name}
                  className="w-6 h-6 object-contain shrink-0"
                />
                <div>
                  <span className="block text-[0.6rem] font-bold whitespace-nowrap leading-tight" style={{ color }}>
                    {roll.item_name.length > 16 ? roll.item_name.slice(0, 16) + "…" : roll.item_name}
                  </span>
                  <span className="block text-[0.55rem] text-muted-foreground whitespace-nowrap leading-tight">
                    {roll.username}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
