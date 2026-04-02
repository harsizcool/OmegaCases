"use client"

import { useEffect, useRef } from "react"

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  rot: number
  rotSpeed: number
  life: number
}

const COLORS = ["#1976d2", "#42a5f5", "#ffca28", "#ef5350", "#66bb6a", "#ab47bc"]

export default function Confetti({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animRef = useRef<number>(0)

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(animRef.current)
      particlesRef.current = []
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext("2d")
        ctx?.clearRect(0, 0, canvas.width, canvas.height)
      }
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    for (let i = 0; i < 200; i++) {
      particlesRef.current.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 6 + Math.random() * 8,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        life: 1,
      })
    }

    const ctx = canvas.getContext("2d")!
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0)

      for (const p of particlesRef.current) {
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.globalAlpha = p.life
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()

        p.x += p.vx
        p.y += p.vy
        p.vy += 0.08
        p.rot += p.rotSpeed
        p.life -= 0.007

        if (p.y > canvas.height) p.life = 0
      }

      if (particlesRef.current.length > 0) {
        animRef.current = requestAnimationFrame(draw)
      }
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [active])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
    />
  )
}
