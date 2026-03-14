"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Box, Typography } from "@mui/material"
import type { Item, Rarity } from "@/lib/types"
import { RARITY_COLORS, RARITY_GLOW } from "@/lib/types"

const ITEM_WIDTH = 140
const ITEM_GAP = 8
const TOTAL_ITEM = ITEM_WIDTH + ITEM_GAP
const VISIBLE_ITEMS = 7
const SPINNER_WIDTH = VISIBLE_ITEMS * TOTAL_ITEM - ITEM_GAP
const CENTER_OFFSET = Math.floor(VISIBLE_ITEMS / 2) * TOTAL_ITEM

const TICK_SRC = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/case%20tick%20sound-XkLDyOzDrmlVl8p3DMaTwFZjDlwS2P.mp3"

interface Props {
  items: Item[]
  targetItem: Item
  onComplete: () => void
  spinning: boolean
}

function playTick() {
  try {
    const audio = new Audio(TICK_SRC)
    audio.volume = 0.4
    audio.play().catch(() => {})
  } catch {}
}

export default function CaseSpinner({ items, targetItem, onComplete, spinning }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const animFrameRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const lastTickIndexRef = useRef<number>(-1)
  const [currentOffset, setCurrentOffset] = useState(0)

  // Build a long strip: 80 random items, target forced near end
  const stripItems = useRef<Item[]>([])
  const targetIndexRef = useRef(0)

  useEffect(() => {
    if (!spinning || items.length === 0) return

    // Build strip of 60 random items, then put target at position 55
    const total = 60
    const targetPos = 52
    const strip: Item[] = []
    for (let i = 0; i < total; i++) {
      if (i === targetPos) {
        strip.push(targetItem)
      } else {
        strip.push(items[Math.floor(Math.random() * items.length)])
      }
    }
    stripItems.current = strip
    targetIndexRef.current = targetPos

    // Final offset: center the target item
    const finalOffset = targetPos * TOTAL_ITEM - CENTER_OFFSET + ITEM_WIDTH / 2

    // Start from offset 0
    const startOffset = 0
    const distance = finalOffset - startOffset
    const duration = 5000 // ms

    startTimeRef.current = performance.now()
    lastTickIndexRef.current = -1

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current
      const t = Math.min(elapsed / duration, 1)

      // Ease out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      const offset = startOffset + distance * eased
      setCurrentOffset(offset)

      // Tick sound: fire when we cross a new item boundary
      const currentIndex = Math.floor(offset / TOTAL_ITEM)
      if (currentIndex !== lastTickIndexRef.current && t < 0.95) {
        lastTickIndexRef.current = currentIndex
        playTick()
      }

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate)
      } else {
        setCurrentOffset(finalOffset)
        onComplete()
      }
    }

    animFrameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [spinning, targetItem, items, onComplete])

  return (
    <Box
      sx={{
        position: "relative",
        width: SPINNER_WIDTH,
        maxWidth: "100%",
        overflow: "hidden",
        borderRadius: 2,
        border: "2px solid #1976d2",
        bgcolor: "#f0f7ff",
        mx: "auto",
      }}
    >
      {/* Center marker */}
      <Box
        sx={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: 3,
          bgcolor: "primary.main",
          zIndex: 10,
          transform: "translateX(-50%)",
          boxShadow: "0 0 8px #1976d2",
        }}
      />
      {/* Fade edges */}
      <Box
        sx={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 80,
          background: "linear-gradient(to right, #f0f7ff, transparent)",
          zIndex: 5,
          pointerEvents: "none",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 80,
          background: "linear-gradient(to left, #f0f7ff, transparent)",
          zIndex: 5,
          pointerEvents: "none",
        }}
      />

      {/* Track */}
      <Box
        ref={trackRef}
        sx={{
          display: "flex",
          gap: `${ITEM_GAP}px`,
          transform: `translateX(-${currentOffset}px)`,
          willChange: "transform",
          py: 1,
          px: "4px",
        }}
      >
        {stripItems.current.map((item, i) => {
          const color = RARITY_COLORS[item.rarity as Rarity]
          const glow = RARITY_GLOW[item.rarity as Rarity]
          return (
            <Box
              key={i}
              sx={{
                width: ITEM_WIDTH,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.5,
                p: 1,
                borderRadius: 2,
                border: `2px solid ${color}`,
                boxShadow: glow,
                bgcolor: "#fff",
              }}
            >
              <Box
                component="img"
                src={item.image_url}
                alt={item.name}
                sx={{ width: 80, height: 80, objectFit: "contain" }}
              />
              <Typography
                variant="caption"
                fontWeight={600}
                textAlign="center"
                sx={{
                  color,
                  fontSize: "0.65rem",
                  lineHeight: 1.2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 120,
                }}
              >
                {item.name}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
