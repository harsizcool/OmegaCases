"use client"

import { useEffect, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"

const THRESHOLD = 70   // px of pull needed to trigger refresh
const DAMPEN    = 0.45 // resistance factor (makes it feel physical)

export default function PullToRefresh() {
  const [pullY, setPullY]       = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startYRef  = useRef(0)
  const pullYRef   = useRef(0)    // shadow of state for use inside closures
  const activeRef  = useRef(false) // are we currently tracking a pull?

  useEffect(() => {
    // Only run in PWA standalone mode — browsers have their own PTR
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true // iOS Safari legacy

    if (!isStandalone) return

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startYRef.current  = e.touches[0].clientY
        activeRef.current  = true
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!activeRef.current) return
      // If user scrolled down mid-gesture, stop tracking
      if (window.scrollY > 0) { activeRef.current = false; pullYRef.current = 0; setPullY(0); return }

      const dy = e.touches[0].clientY - startYRef.current
      if (dy > 0) {
        e.preventDefault() // block native scroll-bounce while pulling
        const clamped = Math.min(dy * DAMPEN, THRESHOLD + 24)
        pullYRef.current = clamped
        setPullY(clamped)
      }
    }

    const onTouchEnd = () => {
      if (!activeRef.current) return
      activeRef.current = false

      if (pullYRef.current >= THRESHOLD) {
        setRefreshing(true)
        // Small delay so the spinner is visible before reload
        setTimeout(() => window.location.reload(), 350)
      } else {
        pullYRef.current = 0
        setPullY(0)
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchmove",  onTouchMove,  { passive: false })
    window.addEventListener("touchend",   onTouchEnd)

    return () => {
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchmove",  onTouchMove)
      window.removeEventListener("touchend",   onTouchEnd)
    }
  }, []) // mount-only — refs hold mutable state, no re-sub needed

  const visible = pullY > 4 || refreshing
  if (!visible) return null

  const ready = pullY >= THRESHOLD || refreshing
  const height = refreshing ? THRESHOLD : pullY

  return (
    <div
      className="fixed inset-x-0 top-0 z-[200] flex justify-center items-end pointer-events-none pb-2 transition-[height] duration-100"
      style={{ height }}
    >
      <div
        className={`w-8 h-8 rounded-full bg-card border border-border/60 shadow-lg flex items-center justify-center transition-all duration-150 ${
          ready ? "scale-100 opacity-100" : "scale-75 opacity-60"
        }`}
      >
        <RefreshCw
          size={14}
          className={`text-primary transition-none ${refreshing ? "animate-spin" : ""}`}
          style={refreshing ? undefined : { transform: `rotate(${pullY * 5}deg)` }}
        />
      </div>
    </div>
  )
}
