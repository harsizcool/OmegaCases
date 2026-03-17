"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material"
import type { Item, Rarity } from "@/lib/types"
import { RARITY_COLORS, RARITY_GLOW } from "@/lib/types"

const ITEM_WIDTH = 140
const ITEM_GAP = 8
const TOTAL_ITEM = ITEM_WIDTH + ITEM_GAP
const VISIBLE_ITEMS = 7
const MAX_SPINNER_WIDTH = VISIBLE_ITEMS * TOTAL_ITEM - ITEM_GAP

// Mobile reduced dimensions
const ITEM_WIDTH_MOBILE = 90
const ITEM_GAP_MOBILE = 6
const TOTAL_ITEM_MOBILE = ITEM_WIDTH_MOBILE + ITEM_GAP_MOBILE
const VISIBLE_ITEMS_MOBILE = 5
const MAX_SPINNER_WIDTH_MOBILE = VISIBLE_ITEMS_MOBILE * TOTAL_ITEM_MOBILE - ITEM_GAP_MOBILE

const TICK_SRC = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/case%20tick%20sound-XkLDyOzDrmlVl8p3DMaTwFZjDlwS2P.mp3"

interface Props {
  items: Item[]
  targetItem: Item
  onComplete: () => void
  spinning: boolean
  speed?: number  // 1 = normal, 2 = 2x
  muted?: boolean
}

function playTick() {
  try {
    const audio = new Audio(TICK_SRC)
    audio.volume = 0.4
    audio.play().catch(() => {})
  } catch {}
}

export default function CaseSpinner({ items, targetItem, onComplete, spinning, speed = 1, muted = false }: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"))

  const itemW = isMobile ? ITEM_WIDTH_MOBILE : ITEM_WIDTH
  const itemGap = isMobile ? ITEM_GAP_MOBILE : ITEM_GAP
  const totalItem = itemW + itemGap
  const maxWidth = isMobile ? MAX_SPINNER_WIDTH_MOBILE : MAX_SPINNER_WIDTH

  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const animFrameRef = useRef<number>(0)
  const lastTickIndexRef = useRef<number>(-1)

  // Strip items stored in ref — no re-render needed when they change
  const stripLength = isMobile ? 40 : 60
  const targetPos = isMobile ? 32 : 52
  const [stripItems, setStripItems] = useState<Item[]>([])

  useEffect(() => {
    if (!spinning || items.length === 0) return

    // Build strip synchronously before starting animation
    const strip: Item[] = []
    for (let i = 0; i < stripLength; i++) {
      strip.push(i === targetPos ? targetItem : items[Math.floor(Math.random() * items.length)])
    }
    setStripItems(strip)

    // Wait one frame for React to render the strip, then start animating
    const raf = requestAnimationFrame(() => {
      const containerWidth = containerRef.current?.offsetWidth ?? maxWidth
      const centerOffset = Math.floor(containerWidth / 2)
      const finalOffset = targetPos * totalItem - centerOffset + itemW / 2
      const startOffset = 0
      const distance = finalOffset - startOffset
      const duration = 5000 / speed

      const startTime = performance.now()
      lastTickIndexRef.current = -1

      const animate = (now: number) => {
        const elapsed = now - startTime
        const t = Math.min(elapsed / duration, 1)
        // Cubic ease-out
        const eased = 1 - Math.pow(1 - t, 3)
        const offset = startOffset + distance * eased

        // Directly mutate DOM — zero React overhead
        if (trackRef.current) {
          trackRef.current.style.transform = `translateX(-${offset}px)`
        }

        const currentIndex = Math.floor(offset / totalItem)
        if (currentIndex !== lastTickIndexRef.current && t < 0.95) {
          lastTickIndexRef.current = currentIndex
          if (!muted) playTick()
        }

        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(animate)
        } else {
          if (trackRef.current) {
            trackRef.current.style.transform = `translateX(-${finalOffset}px)`
          }
          onComplete()
        }
      }

      animFrameRef.current = requestAnimationFrame(animate)
    })

    return () => {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [spinning, targetItem, items, onComplete, speed, totalItem, itemW, stripLength, targetPos, maxWidth, muted])

  return (
    <Box
      ref={containerRef}
      sx={{
        position: "relative",
        width: "100%",
        maxWidth: maxWidth,
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
          pointerEvents: "none",
        }}
      />
      {/* Fade edges */}
      <Box sx={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 48, background: "linear-gradient(to right, #f0f7ff, transparent)", zIndex: 5, pointerEvents: "none" }} />
      <Box sx={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 48, background: "linear-gradient(to left, #f0f7ff, transparent)", zIndex: 5, pointerEvents: "none" }} />

      {/* Track — driven by direct DOM style, not React state */}
      <Box
        ref={trackRef}
        sx={{
          display: "flex",
          gap: `${itemGap}px`,
          willChange: "transform",
          py: 1,
          px: "4px",
        }}
      >
        {stripItems.map((item, i) => {
          const color = RARITY_COLORS[item.rarity as Rarity]
          const glow = RARITY_GLOW[item.rarity as Rarity]
          return (
            <Box
              key={i}
              sx={{
                width: itemW,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.5,
                p: isMobile ? 0.5 : 1,
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
                sx={{ width: isMobile ? 52 : 80, height: isMobile ? 52 : 80, objectFit: "contain" }}
              />
              <Typography
                variant="caption"
                fontWeight={600}
                textAlign="center"
                sx={{
                  color,
                  fontSize: isMobile ? "0.55rem" : "0.65rem",
                  lineHeight: 1.2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: isMobile ? 80 : 120,
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
