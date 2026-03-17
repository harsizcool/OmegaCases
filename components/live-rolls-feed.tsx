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
  users: { username: string; avatar_url: string | null } | null
  items: { name: string; image_url: string | null; rarity: string; rap: number } | null
}

const MAX_ROLLS = 30

export default function LiveRollsFeed() {
  const [rolls, setRolls] = useState<Roll[]>([])
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()

    // Load initial recent rolls
    supabase
      .from("rolls")
      .select("id, created_at, users(username, avatar_url), items(name, image_url, rarity, rap)")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setRolls((data as Roll[]).reverse())
      })

    // Subscribe to realtime inserts
    const channel = supabase
      .channel("rolls-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rolls" },
        async (payload) => {
          const { data } = await supabase
            .from("rolls")
            .select("id, created_at, users(username, avatar_url), items(name, image_url, rarity, rap)")
            .eq("id", payload.new.id)
            .single()
          if (data) {
            setRolls((prev) => {
              const next = [...prev, data as Roll]
              return next.slice(-MAX_ROLLS)
            })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Auto-scroll to bottom when new rolls come in
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [rolls])

  return (
    <Box
      sx={{
        width: 220,
        flexShrink: 0,
        position: "sticky",
        top: 72,
        height: "calc(100vh - 80px)",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
        borderLeft: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <Box sx={{ px: 1.5, py: 1, borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: 8, height: 8, borderRadius: "50%", bgcolor: "#4caf50",
              boxShadow: "0 0 6px #4caf50",
              animation: "pulse 2s infinite",
              "@keyframes pulse": {
                "0%, 100%": { opacity: 1 },
                "50%": { opacity: 0.4 },
              },
            }}
          />
          <Typography variant="caption" fontWeight={700} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
            Live Rolls
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
          gap: 0,
          "&::-webkit-scrollbar": { width: 3 },
          "&::-webkit-scrollbar-thumb": { bgcolor: "divider", borderRadius: 2 },
        }}
      >
        {rolls.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
            No rolls yet...
          </Typography>
        )}
        {rolls.map((roll) => {
          const rarity = roll.items?.rarity ?? "Common"
          const color = RARITY_COLORS[rarity] ?? "#9e9e9e"
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
                transition: "background 0.2s",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              {/* Item image */}
              <Box
                component="img"
                src={roll.items?.image_url ?? "/placeholder.svg?width=32&height=32"}
                alt={roll.items?.name ?? "item"}
                sx={{ width: 32, height: 32, objectFit: "contain", flexShrink: 0, borderRadius: 1 }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color }}
                >
                  {roll.items?.name ?? "Unknown"}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.65rem" }}
                >
                  {roll.users?.username ?? "anon"}
                </Typography>
              </Box>
              {roll.items?.rap != null && (
                <Chip
                  label={`$${Number(roll.items.rap).toFixed(0)}`}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    bgcolor: color + "22",
                    color,
                    flexShrink: 0,
                    "& .MuiChip-label": { px: 0.75 },
                  }}
                />
              )}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
