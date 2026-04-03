"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, TrendingUp, ShieldCheck, ArrowLeft, Bomb, Gem } from "lucide-react"
import NextLink from "next/link"
import { useAuth } from "@/lib/auth-context"

const GRID_SIZE = 25

type GameStatus = "idle" | "active" | "won" | "lost" | "cashed_out"

interface GameState {
  game_id: string
  bet: number
  num_mines: number
  revealed: number[]
  mine_positions?: number[]
  multiplier: number
  payout: number
  status: GameStatus
  server_seed_hash: string
  server_seed?: string
}

function fmt(n: number) { return `$${n.toFixed(2)}` }

export default function MinesPage() {
  const { user, refreshUser } = useAuth()
  const [bet, setBet] = useState("1.00")
  const [numMines, setNumMines] = useState(3)
  const [game, setGame] = useState<GameState | null>(null)
  const [loading, setLoading] = useState(false)
  const [revealing, setRevealing] = useState<number | null>(null)
  const [error, setError] = useState("")

  const post = useCallback(async (body: object) => {
    const res = await fetch("/api/arcade/mines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user?.id, ...body }),
    })
    return res.json()
  }, [user?.id])

  const startGame = async () => {
    if (!user) return
    setError("")
    setLoading(true)
    try {
      const data = await post({ action: "new", bet: parseFloat(bet), num_mines: numMines })
      if (data.error) { setError(data.error); return }
      setGame({
        game_id: data.game_id,
        bet: parseFloat(bet),
        num_mines: numMines,
        revealed: [],
        multiplier: 1,
        payout: parseFloat(bet),
        status: "active",
        server_seed_hash: data.server_seed_hash,
      })
      refreshUser()
    } finally {
      setLoading(false)
    }
  }

  const revealTile = async (tile: number) => {
    if (!game || game.status !== "active" || revealing !== null) return
    if (game.revealed.includes(tile)) return
    setRevealing(tile)
    try {
      const data = await post({ action: "reveal", game_id: game.game_id, tile })
      if (data.error) { setError(data.error); return }
      setGame(prev => prev ? {
        ...prev,
        revealed: data.revealed ?? [...prev.revealed, tile],
        multiplier: data.multiplier ?? prev.multiplier,
        payout: data.payout ?? prev.payout,
        status: data.status as GameStatus,
        mine_positions: data.mine_positions ?? prev.mine_positions,
        server_seed: data.server_seed,
      } : null)
      if (data.status === "won") refreshUser()
    } finally {
      setRevealing(null)
    }
  }

  const cashOut = async () => {
    if (!game || game.status !== "active" || game.revealed.length === 0) return
    setLoading(true)
    try {
      const data = await post({ action: "cashout", game_id: game.game_id })
      if (data.error) { setError(data.error); return }
      setGame(prev => prev ? {
        ...prev,
        status: "cashed_out",
        payout: data.payout,
        multiplier: data.multiplier,
        mine_positions: data.mine_positions,
        server_seed: data.server_seed,
      } : null)
      refreshUser()
    } finally {
      setLoading(false)
    }
  }

  const reset = () => { setGame(null); setError("") }
  const isOver = game && ["won", "lost", "cashed_out"].includes(game.status)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-5">
        <Button variant="ghost" size="sm" asChild><NextLink href="/arcade"><ArrowLeft size={14} /> Arcade</NextLink></Button>
        <h1 className="text-xl font-bold">Mines</h1>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 text-xs text-green-400 cursor-help">
                <ShieldCheck size={13} /> Provably Fair
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              Mine positions are pre-generated via HMAC-SHA256. Server seed is revealed after each game for verification.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex gap-5 items-start flex-col lg:flex-row">
        {/* Left panel */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4">
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Bet Amount</Label>
              <Input
                type="number" value={bet} min={0.01} step={0.01}
                onChange={e => setBet(e.target.value)}
                disabled={game?.status === "active"}
              />
              <div className="flex gap-1.5">
                {["1/2", "2x", "Max"].map(op => (
                  <Button key={op} size="sm" variant="outline" className="flex-1 h-6 text-xs"
                    disabled={game?.status === "active"}
                    onClick={() => {
                      const v = parseFloat(bet) || 1
                      if (op === "1/2") setBet((v / 2).toFixed(2))
                      else if (op === "2x") setBet((v * 2).toFixed(2))
                      else setBet(String(Math.floor(user?.balance ?? 0)))
                    }}>
                    {op}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs">Mines</Label>
                <span className="text-sm font-bold text-primary">{numMines}</span>
              </div>
              <Slider
                value={[numMines]} min={1} max={24} step={1}
                disabled={game?.status === "active"}
                onValueChange={([v]) => setNumMines(v)}
              />
              <p className="text-[0.65rem] text-muted-foreground">{GRID_SIZE - numMines} safe tiles</p>
            </div>

            {!game || isOver ? (
              <Button className="w-full" onClick={startGame} disabled={loading || !user}>
                {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                {game && isOver ? "Play Again" : "Start Game"}
              </Button>
            ) : (
              <Button
                className="w-full bg-green-600 hover:bg-green-500 text-white"
                onClick={cashOut}
                disabled={loading || game.revealed.length === 0}>
                {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <TrendingUp size={14} className="mr-1" />}
                Cash Out {game.revealed.length > 0 ? fmt(game.payout) : ""}
              </Button>
            )}

            {error && <Alert variant="destructive"><AlertDescription className="text-xs">{error}</AlertDescription></Alert>}

            {/* Live multiplier */}
            {game && game.status === "active" && game.revealed.length > 0 && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Multiplier</p>
                <p className="text-2xl font-bold text-primary">{game.multiplier.toFixed(2)}x</p>
                <p className="text-sm font-semibold text-green-400">{fmt(game.payout)}</p>
              </div>
            )}

            {/* Result */}
            {isOver && game && (
              <div className={`rounded-lg p-3 text-center border ${
                game.status === "lost" ? "bg-red-500/10 border-red-500/20" :
                "bg-green-500/10 border-green-500/20"
              }`}>
                <p className="text-xs text-muted-foreground">
                  {game.status === "lost" ? "You hit a mine!" : game.status === "won" ? "All safe tiles cleared!" : "Cashed out!"}
                </p>
                <p className={`text-xl font-bold ${game.status === "lost" ? "text-red-400" : "text-green-400"}`}>
                  {game.status === "lost" ? `-${fmt(game.bet)}` : `+${fmt(game.payout - game.bet)}`}
                </p>
                {game.status !== "lost" && (
                  <p className="text-xs text-muted-foreground">{game.multiplier.toFixed(2)}x</p>
                )}
              </div>
            )}

            {/* Provably fair reveal */}
            {game?.server_seed && (
              <div className="text-[0.6rem] text-muted-foreground break-all">
                <p className="font-semibold mb-0.5">Server Seed (verify):</p>
                <p className="font-mono">{game.server_seed}</p>
              </div>
            )}
            {game?.server_seed_hash && !game.server_seed && (
              <div className="text-[0.6rem] text-muted-foreground break-all">
                <p className="font-semibold mb-0.5">Server Seed Hash:</p>
                <p className="font-mono">{game.server_seed_hash}</p>
              </div>
            )}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1">
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: GRID_SIZE }, (_, tile) => {
              const isRevealed = game?.revealed.includes(tile)
              const isMine = game?.mine_positions?.includes(tile)
              const isRevealing = revealing === tile
              const active = game?.status === "active"

              let cellClass = "aspect-square rounded-xl border flex items-center justify-center text-xl font-bold transition-all select-none "
              if (!game || isOver && !isRevealed && !isMine) {
                cellClass += "bg-muted/20 border-border/30 cursor-default"
              } else if (isRevealing) {
                cellClass += "bg-primary/20 border-primary/40 animate-pulse cursor-wait"
              } else if (isRevealed && !isMine) {
                cellClass += "bg-green-500/20 border-green-500/40"
              } else if (isMine && isRevealed) {
                cellClass += "bg-red-500/30 border-red-500/50 animate-pulse"
              } else if (isMine) {
                cellClass += "bg-red-500/15 border-red-500/25"
              } else if (active) {
                cellClass += "bg-card border-border hover:border-primary/60 hover:bg-primary/10 cursor-pointer active:scale-95"
              } else {
                cellClass += "bg-muted/20 border-border/30 cursor-default"
              }

              return (
                <button
                  key={tile}
                  className={cellClass}
                  disabled={!active || isRevealed || revealing !== null}
                  onClick={() => revealTile(tile)}
                >
                  {isRevealed && !isMine && <Gem size={20} className="text-green-400" />}
                  {isMine && (isRevealed || isOver) && <Bomb size={20} className={isRevealed ? "text-red-400" : "text-red-400/50"} />}
                  {!isRevealed && !isMine && active && (
                    <span className="text-muted-foreground/30 text-sm">?</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Stats bar */}
          {game && (
            <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
              <span>Revealed: <b className="text-foreground">{game.revealed.length}</b></span>
              <span>Mines: <b className="text-red-400">{game.num_mines}</b></span>
              <span>Safe left: <b className="text-green-400">{GRID_SIZE - game.num_mines - game.revealed.length}</b></span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
