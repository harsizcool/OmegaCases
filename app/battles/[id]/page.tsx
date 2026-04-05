"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import NextLink from "next/link"
import { Swords, Trophy, Copy, Loader2, Crown, ArrowLeft, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/lib/auth-context"
import { useMuteSounds } from "@/lib/use-mute-sounds"
import { createClient } from "@/lib/supabase/client"
import { RARITY_COLORS } from "@/lib/types"
import BattleSpinner, { type SpinItem } from "@/components/battle-spinner"
import Confetti from "@/components/confetti"

const CONFETTI_SRC = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/confetti-pop-sound-fNcAXWXi7MdyVXwS9yqsN7dqp9PhVx.mp3"
function playSound(src: string) {
  try { const a = new Audio(src); a.volume = 0.6; a.play().catch(() => {}) } catch {}
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface BattleUser {
  id: string
  username: string
  profile_picture: string | null
  plus: boolean
}

interface RollItem {
  id: string
  name: string
  image_url: string
  rarity: string
  market_price: number
}

interface BattleRoll {
  id: string
  user_id: string
  item_id: string
  round: number
  roll_index: number
  rap: number
  items: RollItem
}

interface Battle {
  id: string
  creator_id: string
  joiner_id: string | null
  joiner2_id: string | null
  joiner3_id: string | null
  winner_id: string | null
  status: "waiting" | "in_progress" | "completed" | "cancelled"
  case_count: number
  max_players: number
  exclusive: boolean
  created_at: string
  completed_at: string | null
  creator: BattleUser | null
  joiner: BattleUser | null
  joiner2: BattleUser | null
  joiner3: BattleUser | null
  rolls: BattleRoll[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildRounds(rolls: BattleRoll[], playerIds: string[]) {
  const byRound = new Map<number, Record<string, BattleRoll>>()
  for (const roll of rolls) {
    if (!byRound.has(roll.round)) byRound.set(roll.round, {})
    byRound.get(roll.round)![roll.user_id] = roll
  }
  return [...byRound.entries()]
    .map(([round, byPlayer]) => ({ round, byPlayer }))
    .sort((a, b) => a.round - b.round)
    // Only include rounds where at least one player in playerIds rolled
    .filter(({ byPlayer }) => playerIds.some((pid) => byPlayer[pid]))
}

// ── Cards ──────────────────────────────────────────────────────────────────────

function RevealedCard({ roll }: { roll: BattleRoll }) {
  const color = (RARITY_COLORS as Record<string, string>)[roll.items.rarity] ?? "#9e9e9e"
  return (
    <div
      className="w-full mx-auto rounded-xl border p-2 flex flex-col items-center gap-1 animate-in fade-in zoom-in-95 duration-300"
      style={{ borderColor: color + "60", background: color + "10", maxWidth: 270 }}
    >
      <img src={roll.items.image_url} alt={roll.items.name} className="w-12 h-12 object-contain" />
      <p className="text-[0.58rem] font-semibold text-center leading-tight line-clamp-2">{roll.items.name}</p>
      <p className="text-[0.7rem] font-bold" style={{ color }}>${Number(roll.rap).toFixed(2)}</p>
    </div>
  )
}

function PlaceholderCard() {
  return (
    <div
      className="w-full mx-auto rounded-xl bg-muted/30 border border-border/30 flex items-center justify-center"
      style={{ maxWidth: 270, height: 100 }}
    >
      <div className="w-7 h-7 rounded-full bg-muted/60" />
    </div>
  )
}

// ── Player header card ─────────────────────────────────────────────────────────

function PlayerHeader({ player, isWinner, rap }: { player: BattleUser | null; isWinner: boolean; rap: number }) {
  return (
    <div className={`flex items-center gap-2 bg-card border rounded-xl p-2.5 transition-colors ${isWinner ? "border-amber-500/50 bg-amber-500/5" : "border-border/60"}`}>
      <Avatar className="w-7 h-7 shrink-0">
        {player?.profile_picture && <img src={player.profile_picture} className="w-full h-full object-cover rounded-full" />}
        <AvatarFallback className="bg-primary/20 text-primary text-[0.6rem] font-bold">
          {player?.username?.[0]?.toUpperCase() ?? "?"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-[0.65rem] font-bold truncate">{player?.username ?? "…"}</p>
          {player?.plus && <Crown size={7} className="text-amber-400 shrink-0" />}
          {isWinner && <Trophy size={9} className="text-amber-400 shrink-0" />}
        </div>
        <p className="text-[0.65rem] font-bold text-primary tabular-nums">${rap.toFixed(2)}</p>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function BattleRoomPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { muted } = useMuteSounds()

  const [battle, setBattle] = useState<Battle | null>(null)
  const [allItems, setAllItems] = useState<SpinItem[]>([])
  const [pageStatus, setPageStatus] = useState<"loading" | "waiting" | "animating" | "done">("loading")
  const [confettiActive, setConfettiActive] = useState(false)

  const battleRef = useRef<Battle | null>(null)
  battleRef.current = battle

  const mutedRef = useRef(muted)
  mutedRef.current = muted

  const [spinningRound, setSpinningRound] = useState<number | null>(null)
  const [revealedRounds, setRevealedRounds] = useState<Set<number>>(new Set())
  const doneCountRef = useRef(0)
  const totalRoundsRef = useRef(0)
  const spinnerCountRef = useRef(2) // 2, 3, or 4 depending on max_players
  const animStartedRef = useRef(false)

  const [copied, setCopied] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // ── Fetch ──

  const fetchBattle = useCallback(async () => {
    try {
      const res = await fetch(`/api/battles/${id}`)
      if (!res.ok) return
      const data: Battle = await res.json()
      setBattle(data)
      if (data.status === "completed") {
        setPageStatus((prev) => (prev === "animating" || prev === "done" ? prev : "animating"))
      } else if (data.status === "waiting" || data.status === "in_progress") {
        setPageStatus((prev) => (prev === "loading" ? "waiting" : prev))
      } else {
        setPageStatus("done")
      }
    } catch {}
  }, [id])

  useEffect(() => {
    fetch("/api/admin/items").then((r) => r.json()).then((d) => setAllItems(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  useEffect(() => { fetchBattle() }, [fetchBattle])

  // Realtime
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`battle-room-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "battles", filter: `id=eq.${id}` },
        async (payload) => {
          const s = payload.new?.status
          if (s === "completed" || s === "cancelled" || s === "waiting") await fetchBattle()
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id, fetchBattle])

  // Poll while waiting (handles realtime gaps and 3-way "waiting for 3rd" state)
  useEffect(() => {
    if (pageStatus !== "waiting") return
    const interval = setInterval(fetchBattle, 3000)
    return () => clearInterval(interval)
  }, [pageStatus, fetchBattle])

  // Start animation
  useEffect(() => {
    if (pageStatus !== "animating" || !battle || animStartedRef.current) return
    animStartedRef.current = true

    const playerIds = getPlayerIds(battle)
    const rounds = buildRounds(battle.rolls, playerIds)
    totalRoundsRef.current = rounds.length
    spinnerCountRef.current = playerIds.length

    if (rounds.length === 0) { setPageStatus("done"); return }
    doneCountRef.current = 0
    setSpinningRound(0)
  }, [pageStatus, battle])

  // Spinner complete handler
  const handleSpinComplete = useCallback((round: number) => {
    doneCountRef.current += 1
    if (doneCountRef.current < spinnerCountRef.current) return

    doneCountRef.current = 0
    setRevealedRounds((prev) => new Set([...prev, round]))

    // Confetti for Omega reveal
    if (battleRef.current) {
      const hasOmega = battleRef.current.rolls.some((r) => r.round === round && r.items.rarity === "Omega")
      if (hasOmega) {
        setConfettiActive(true)
        if (!mutedRef.current) playSound(CONFETTI_SRC)
        setTimeout(() => setConfettiActive(false), 6000)
      }
    }

    setTimeout(() => {
      const next = round + 1
      if (next < totalRoundsRef.current) {
        setSpinningRound(next)
      } else {
        setSpinningRound(null)
        setTimeout(() => setPageStatus("done"), 400)
      }
    }, 700)
  }, [])

  const cancelBattle = async () => {
    if (!user || !battle || cancelling) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/battles/${battle.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      })
      if (res.ok) await fetchBattle()
    } finally { setCancelling(false) }
  }

  const copyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // ── Helpers ──

  function getPlayerIds(b: Battle): string[] {
    return [b.creator_id, b.joiner_id, b.joiner2_id, b.joiner3_id].filter(Boolean) as string[]
  }

  function getPlayers(b: Battle): (BattleUser | null)[] {
    const mp = b.max_players ?? 2
    const list: (BattleUser | null)[] = [b.creator, b.joiner]
    if (mp >= 3) list.push(b.joiner2 ?? null)
    if (mp >= 4) list.push(b.joiner3 ?? null)
    return list
  }

  function getPlayerIdList(b: Battle): string[] {
    const mp = b.max_players ?? 2
    const list: string[] = [b.creator_id]
    if (b.joiner_id) list.push(b.joiner_id)
    if (mp >= 3 && b.joiner2_id) list.push(b.joiner2_id)
    if (mp >= 4 && b.joiner3_id) list.push(b.joiner3_id)
    return list
  }

  // ── Loading ──
  if (pageStatus === "loading") {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!battle) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <p className="text-muted-foreground">Battle not found.</p>
      </div>
    )
  }

  const maxPlayers = battle.max_players ?? 2
  const isThreeWay = maxPlayers === 3
  const isFourWay = maxPlayers === 4

  // ── Cancelled ──
  if (battle.status === "cancelled") {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] gap-4">
        <X size={32} className="text-destructive" />
        <p className="text-lg font-bold">Battle Cancelled</p>
        <p className="text-sm text-muted-foreground">Cases were refunded to all players.</p>
        <Button variant="outline" asChild>
          <NextLink href="/battles"><ArrowLeft size={14} className="mr-2" />Back to Battles</NextLink>
        </Button>
      </div>
    )
  }

  // ── Waiting ──
  if (pageStatus === "waiting") {
    const joinedCount = [battle.creator_id, battle.joiner_id, battle.joiner2_id].filter(Boolean).length
    const neededCount = battle.max_players ?? 2

    return (
      <div className="max-w-md mx-auto px-4 py-10 flex flex-col items-center gap-5">
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <Swords size={18} className={battle.exclusive ? "text-amber-400" : "text-primary"} />
          <h1 className="text-base font-bold">Battle #{battle.id.slice(0, 8)}</h1>
          {maxPlayers > 2 && (
            <span className="text-[0.6rem] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 uppercase">
              {isThreeWay ? "1v1v1" : "1v1v1v1"}
            </span>
          )}
          {battle.exclusive && (
            <span className="flex items-center gap-1 text-[0.6rem] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 uppercase">
              👑 Exclusives
            </span>
          )}
        </div>

        {/* Players joined so far */}
        <div className="w-full space-y-2">
          {[battle.creator, battle.joiner, ...(maxPlayers >= 3 ? [battle.joiner2] : []), ...(maxPlayers >= 4 ? [battle.joiner3] : [])].map((player, idx) => (
            <div key={idx} className={`flex items-center gap-3 rounded-xl p-3 border ${player ? "bg-card border-border/60" : "bg-muted/20 border-border/30 border-dashed"}`}>
              {player ? (
                <>
                  <Avatar className="w-9 h-9 shrink-0">
                    {player.profile_picture && <img src={player.profile_picture} className="w-full h-full object-cover rounded-full" />}
                    <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
                      {player.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-sm font-bold">{player.username}</p>
                  <span className="ml-auto text-[0.6rem] font-bold px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">Ready</span>
                </>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
                    <Loader2 size={14} className="animate-spin text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Waiting for player {idx + 1}…</p>
                </>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">{joinedCount}/{neededCount} players joined</p>

        <div className="w-full space-y-2">
          <p className="text-xs text-center text-muted-foreground">Share this link to invite opponents</p>
          <div className="flex gap-2">
            <div className="flex-1 bg-muted/60 border border-border/40 rounded-lg px-3 py-1.5 text-xs font-mono text-muted-foreground overflow-hidden">
              <span className="block truncate">{typeof window !== "undefined" ? window.location.href : ""}</span>
            </div>
            <Button size="sm" variant="outline" onClick={copyLink} className="shrink-0 gap-1.5">
              <Copy size={12} />{copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>

        {user?.id === battle.creator_id && (
          <Button variant="destructive" size="sm" onClick={cancelBattle} disabled={cancelling}>
            {cancelling ? <Loader2 size={13} className="animate-spin mr-2" /> : <X size={13} className="mr-2" />}
            Cancel Battle
          </Button>
        )}

        <NextLink href="/battles" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft size={11} /> Back to lobby
        </NextLink>
      </div>
    )
  }

  // ── Animating / Done ──

  const playerIdList = getPlayerIdList(battle)
  const players = getPlayers(battle)
  const rounds = buildRounds(battle.rolls, playerIdList)
  const mainRounds = rounds.filter((r) => r.round < battle.case_count)
  const tieRounds = rounds.filter((r) => r.round >= battle.case_count)
  const isDone = pageStatus === "done"

  // Per-player total RAP (full or visible)
  const playerRaps = Object.fromEntries(
    playerIdList.map((pid) => [
      pid,
      battle.rolls
        .filter((r) => r.user_id === pid && (isDone || revealedRounds.has(r.round)))
        .reduce((s, r) => s + Number(r.rap), 0),
    ])
  )

  const winner = players.find((p) => p?.id === battle.winner_id) ?? null
  const colClass = isFourWay ? "grid-cols-4" : isThreeWay ? "grid-cols-3" : "grid-cols-2"

  const renderRound = (round: number, byPlayer: Record<string, BattleRoll>) => {
    const isSpinning = spinningRound === round
    const isRevealed = isDone || revealedRounds.has(round)

    return (
      <div key={round} className={`grid ${colClass} gap-2`}>
        {playerIdList.map((pid) => {
          const roll = byPlayer[pid]
          return (
            <div key={pid} className="flex justify-center">
              {isSpinning && roll && allItems.length > 0 ? (
                <BattleSpinner
                  items={allItems}
                  targetItem={roll.items as SpinItem}
                  spinning={true}
                  muted={muted}
                  onComplete={() => handleSpinComplete(round)}
                />
              ) : isRevealed && roll ? (
                <RevealedCard roll={roll} />
              ) : (
                <PlaceholderCard />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
      <Confetti active={confettiActive} />

      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <NextLink href="/battles" className="text-muted-foreground hover:text-foreground transition-colors mr-1">
          <ArrowLeft size={15} />
        </NextLink>
        <Swords size={15} className={battle.exclusive ? "text-amber-400" : "text-primary"} />
        <span className="text-sm font-bold">Case Battle</span>
        {maxPlayers > 2 && (
          <span className="text-[0.6rem] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 uppercase">
            {isThreeWay ? "1v1v1" : "1v1v1v1"}
          </span>
        )}
        {battle.exclusive && (
          <span className="flex items-center gap-1 text-[0.6rem] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 uppercase tracking-wide">
            👑 Exclusives
          </span>
        )}
        <span className="text-xs text-muted-foreground font-mono">#{battle.id.slice(0, 8)}</span>
      </div>

      {/* Winner banner */}
      {isDone && winner && (
        <div className="flex items-center justify-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl py-3 px-4 animate-in fade-in duration-500">
          <Trophy size={18} className="text-amber-400" />
          <div className="text-center">
            <p className="text-[0.65rem] text-muted-foreground uppercase tracking-wider font-bold">Winner</p>
            <p className="text-base font-bold">{winner.username}</p>
          </div>
          <Trophy size={18} className="text-amber-400" />
        </div>
      )}

      {/* Player headers */}
      <div className={`grid ${colClass} gap-2`}>
        {players.map((player, idx) => (
          <PlayerHeader
            key={idx}
            player={player}
            isWinner={isDone && player?.id === battle.winner_id}
            rap={playerRaps[playerIdList[idx]] ?? 0}
          />
        ))}
      </div>

      {/* Round rows */}
      <div className="space-y-2">
        {mainRounds.map(({ round, byPlayer }) => renderRound(round, byPlayer))}

        {tieRounds.length > 0 && (
          <>
            <div className="flex items-center gap-3 py-0.5">
              <div className="flex-1 h-px bg-border/40" />
              <span className="text-[0.65rem] font-bold text-primary tracking-wider uppercase px-2">Tiebreaker</span>
              <div className="flex-1 h-px bg-border/40" />
            </div>
            {tieRounds.map(({ round, byPlayer }) => renderRound(round, byPlayer))}
          </>
        )}
      </div>
    </div>
  )
}
