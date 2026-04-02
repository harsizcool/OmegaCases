"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useIsMobile } from "@/components/ui/use-mobile"
import type { Item, Rarity } from "@/lib/types"
import { RARITY_COLORS, RARITY_GLOW } from "@/lib/types"

const ITEM_WIDTH = 140
const ITEM_GAP = 8
const TOTAL_ITEM = ITEM_WIDTH + ITEM_GAP
const VISIBLE_ITEMS = 7
const MAX_SPINNER_WIDTH = VISIBLE_ITEMS * TOTAL_ITEM - ITEM_GAP

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
  speed?: number
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
  const isMobile = useIsMobile()

  const itemW = isMobile ? ITEM_WIDTH_MOBILE : ITEM_WIDTH
  const itemGap = isMobile ? ITEM_GAP_MOBILE : ITEM_GAP
  const totalItem = itemW + itemGap
  const maxWidth = isMobile ? MAX_SPINNER_WIDTH_MOBILE : MAX_SPINNER_WIDTH

  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const animFrameRef = useRef<number>(0)
  const lastTickIndexRef = useRef<number>(-1)

  const stripLength = isMobile ? 40 : 60
  const targetPos = isMobile ? 32 : 52
  const [stripItems, setStripItems] = useState<Item[]>([])

  useEffect(() => {
    if (!spinning || items.length === 0) return

    const strip: Item[] = []
    for (let i = 0; i < stripLength; i++) {
      strip.push(i === targetPos ? targetItem : items[Math.floor(Math.random() * items.length)])
    }
    setStripItems(strip)

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
        const eased = 1 - Math.pow(1 - t, 3)
        const offset = startOffset + distance * eased

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
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl border-2 border-primary bg-blue-50 dark:bg-slate-800 mx-auto"
      style={{ maxWidth }}
    >
      {/* Center marker */}
      <div
        className="absolute left-1/2 top-0 bottom-0 w-[3px] bg-primary z-10 -translate-x-1/2 pointer-events-none"
        style={{ boxShadow: "0 0 8px var(--color-primary)" }}
      />
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-blue-50 dark:from-slate-800 to-transparent z-[5] pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-blue-50 dark:from-slate-800 to-transparent z-[5] pointer-events-none" />

      <div
        ref={trackRef}
        className="flex py-2 px-1 will-change-transform"
        style={{ gap: itemGap }}
      >
        {stripItems.map((item, i) => {
          const color = RARITY_COLORS[item.rarity as Rarity]
          const glow = RARITY_GLOW[item.rarity as Rarity]
          return (
            <div
              key={i}
              className="shrink-0 flex flex-col items-center gap-1 rounded-xl border-2 bg-white dark:bg-slate-900"
              style={{
                width: itemW,
                borderColor: color,
                boxShadow: glow,
                padding: isMobile ? "4px" : "8px",
              }}
            >
              <img
                src={item.image_url}
                alt={item.name}
                style={{ width: isMobile ? 52 : 80, height: isMobile ? 52 : 80 }}
                className="object-contain"
              />
              <span
                className="font-semibold text-center leading-tight overflow-hidden text-ellipsis whitespace-nowrap block"
                style={{
                  color,
                  fontSize: isMobile ? "0.55rem" : "0.65rem",
                  maxWidth: isMobile ? 80 : 120,
                }}
              >
                {item.name}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
