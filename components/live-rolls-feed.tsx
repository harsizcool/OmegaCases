"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Box, Typography, Chip } from "@mui/material"

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
  const seenIds = useRef<Set<string>>(new Set())

  // Initial load via server API (single joined query)
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

  // Realtime subscription for new inserts
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

          // Enrich with user + item in parallel
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

          seenIds.current.add(enriched.id)
          setRolls((prev) => [...prev, enriched].slice(-MAX_ROLLS))
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED")
      })

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Auto-scroll to bottom on new roll
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [rolls.length])

  return (
    <Box
      sx={{
        width: 220,
        flexShrink: 0,
        position: "sticky",
        top: 72,
        height: "calc(100vh - 80px)",
        display: { xs: "none", lg: "flex" },
        flexDirection: "column",
        bgcolor: "background.paper",
        borderLeft: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
        zIndex: 10,
      }}
    >
      {/* Header */}
      <Box sx={{ px: 1.5, py: 1, borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: connected ? "#4caf50" : "#bdbdbd",
              boxShadow: connected ? "0 0 6px #4caf50" : "none",
              transition: "all 0.3s",
              animation: connected ? "pulse 2s infinite" : "none",
              "@keyframes pulse": {
                "0%, 100%": { opacity: 1 },
                "50%": { opacity: 0.4 },
              },
            }}
          />
          <Typography variant="caption" fontWeight={700} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
            Live Rolls
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ ml: "auto", fontSize: "0.65rem" }}>
            {rolls.length}
          </Typography>
        </Box>
      </Box>

      {/* Roll list */}
      <Box
        ref={listRef}
        sx={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          "&::-webkit-scrollbar": { width: 3 },
          "&::-webkit-scrollbar-thumb": { bgcolor: "divider", borderRadius: 2 },
        }}
      >
        {rolls.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
            No rolls yet — open some cases!
          </Typography>
        )}
        {rolls.map((roll) => {
          const color = RARITY_COLORS[roll.rarity] ?? "#9e9e9e"
          return (
            <Box
              key={roll.id}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.5,
                py: 0.75,
                borderBottom: "1px solid",
                borderColor: "divider",
                borderLeft: `3px solid ${color}`,
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Box
                component="img"
                src={roll.image_url ?? "/placeholder.svg?width=32&height=32"}
                alt={roll.item_name}
                sx={{ width: 32, height: 32, objectFit: "contain", flexShrink: 0, borderRadius: 1 }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color, lineHeight: 1.3 }}
                >
                  {roll.item_name}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.65rem" }}
                >
                  {roll.username}
                </Typography>
                <Chip
                  label={roll.rarity}
                  size="small"
                  sx={{
                    height: 14,
                    fontSize: "0.55rem",
                    bgcolor: color + "22",
                    color,
                    mt: 0.25,
                    "& .MuiChip-label": { px: 0.5 },
                  }}
                />
              </Box>
              {roll.rap > 0 && (
                <Typography
                  variant="caption"
                  sx={{ fontSize: "0.6rem", fontWeight: 700, color, flexShrink: 0, whiteSpace: "nowrap" }}
                >
                  ${Number(roll.rap).toFixed(0)}
                </Typography>
              )}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
