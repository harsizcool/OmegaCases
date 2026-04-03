"use client"

import NextLink from "next/link"
import { Layers3, Bomb, TowerControl, ShieldCheck, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const GAMES = [
  {
    href: "/arcade/towers",
    icon: TowerControl,
    name: "Towers",
    desc: "Climb the tower row by row. Pick the safe column on each level — one wrong move ends the run. Cash out any time.",
    tags: ["Strategy", "Risk/Reward"],
    color: "text-blue-400",
    border: "border-blue-500/20 hover:border-blue-500/50",
    bg: "bg-blue-500/5",
    badge: "bg-blue-500/15 text-blue-300",
  },
  {
    href: "/arcade/mines",
    icon: Bomb,
    name: "Mines",
    desc: "A 5×5 grid hides mines. Reveal safe tiles to grow your multiplier. One mine ends everything — cash out before it's too late.",
    tags: ["Luck", "Tension"],
    color: "text-red-400",
    border: "border-red-500/20 hover:border-red-500/50",
    bg: "bg-red-500/5",
    badge: "bg-red-500/15 text-red-300",
  },
]

export default function ArcadePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Layers3 size={26} className="text-primary" />
          <h1 className="text-3xl font-bold">Arcade</h1>
        </div>
        <p className="text-muted-foreground text-sm">Provably fair games. Beat the odds, cash out at the right time.</p>
        <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-green-400">
          <ShieldCheck size={13} />
          All outcomes verifiable via HMAC-SHA256
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {GAMES.map(({ href, icon: Icon, name, desc, tags, color, border, bg, badge }) => (
          <NextLink
            key={href}
            href={href}
            className={`group rounded-2xl border ${border} ${bg} p-6 flex flex-col gap-4 transition-all hover:-translate-y-0.5`}
          >
            <div className="flex items-start justify-between">
              <div className={`w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center`}>
                <Icon size={24} className={color} />
              </div>
              <div className="flex gap-1.5 flex-wrap justify-end">
                {tags.map(t => (
                  <span key={t} className={`text-[0.6rem] font-bold px-2 py-0.5 rounded-full ${badge}`}>{t}</span>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold mb-1">{name}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mt-auto">
              <Zap size={12} /> Play Now
            </div>
          </NextLink>
        ))}
      </div>
    </div>
  )
}
