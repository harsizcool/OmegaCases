"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"

export default function DiscountBanner() {
  const [text, setText] = useState("")
  const [color, setColor] = useState("#1565c0")
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch("/api/banner")
      .then((r) => r.json())
      .then((d) => {
        if (d?.text) { setText(d.text); setColor(d.color || "#1565c0") }
      })
      .catch(() => {})
  }, [])

  if (!text || dismissed) return null

  return (
    <div
      className="relative z-50 flex items-center justify-center gap-2 px-4 py-1.5 text-white"
      style={{ backgroundColor: color }}
    >
      <span className="text-center text-xs sm:text-sm font-bold tracking-wide">{text}</span>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-80 hover:opacity-100 p-0.5 rounded"
        aria-label="Dismiss banner"
      >
        <X size={14} />
      </button>
    </div>
  )
}
