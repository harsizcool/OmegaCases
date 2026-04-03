"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, TrendingUp, ShieldCheck, ArrowLeft, Bomb, Check } from "lucide-react"
import NextLink from "next/link"
import { useAuth } from "@/lib/auth-context"

type Difficulty = "easy" | "normal" | "hard"
type GameStatus = "idle" | "active" | "won" | "lost" | "cashed_out"

interface RowResult {
  row: number
  picked: number
  bombs: number[]
  hit_bomb: boolean
}

interface GameState {
  game_id: string
  bet: number
  difficulty: Difficulty
  num_rows: number
  num_cols: number
  current_row: number
  picks: number[]
  multipliers: number[]
  status: GameStatus
  row_results: RowResult[]
  payout: number
  server_seed_hash: string
  server_seed?: string
  bomb_columns_all?: number[][]
}

const DIFF_LABELS: Record<Difficulty, { label: string; desc: string; color: string }> = {
  easy:   { label: "Easy",   desc: "1 bomb / 3 cols", color: "text-green-400" },
  normal: { label: "Normal", desc: "1 bomb / 2 cols", color: "text-yellow-400" },
  hard:   { label: "Hard",   desc: "2 bombs / 3 cols", color: "text-red-400" },
}

function fmt(n: number) { return `$${n.toFixed(2)}` }

export default function TowersPage() {
  const { user, refreshUser } = useAuth()
  const [bet, setBet] = useState("1.00")
  const [difficulty, setDifficulty] = useState<Difficulty>("easy")
  const [game, setGame] = useState<GameState | null>(null)
  const [loading, setLoading] = useState(false)
  const [stepping, setStepping] = useState(false)
  const [error, setError] = useState("")

  const post = useCallback(async (body: object) => {
    const res = await fetch("/api/arcade/towers", {
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
      const data = await post({ action: "new", bet: parseFloat(bet), difficulty })
      if (data.error) { setError(data.error); return }
      setGame({
        game_id: data.game_id,
        bet: parseFloat(bet),
        difficulty,
        num_rows: data.state.num_rows,
        num_cols: data.state.num_cols,
        current_row: 0,
        picks: [],
        multipliers: data.multipliers,
        status: "active",
        row_results: [],
        payout: parseFloat(bet),
        server_seed_hash: data.server_seed_hash,
      })
      refreshUser()
    } finally {
      setLoading(false)
    }
  }

  const pickColumn = async (col: number) => {
    if (!game || game.status !== "active" || stepping) return
    setStepping(true)
    try {
      const data = await post({ action: "step", game_id: game.game_id, column: col })
      if (data.error) { setError(data.error); return }

      const result: RowResult = {
        row: game.current_row,
        picked: col,
        bombs: data.bomb_columns_row,
        hit_bomb: data.hit_bomb,
      }

      setGame(prev => prev ? {
        ...prev,
        current_row: data.current_row ?? prev.current_row + 1,
        picks: [...prev.picks, col],
        row_results: [...prev.row_results, result],
        status: data.status as GameStatus,
        payout: data.payout ?? prev.payout,
        server_seed: data.server_seed,
        bomb_columns_all: data.bomb_columns_all,
      } : null)

      if (data.status === "won" || data.status === "cashed_out") refreshUser()
    } finally {
      setStepping(false)
    }
  }

  const cashOut = async () => {
    if (!game || game.status !== "active" || game.current_row === 0) return
    setStepping(true)
    try {
      const data = await post({ action: "cashout", game_id: game.game_id })
      if (data.error) { setError(data.error); return }
      setGame(prev => prev ? {
        ...prev,
        status: "cashed_out",
        payout: data.payout,
        server_seed: data.server_seed,
        bomb_columns_all: data.bomb_columns_all,
      } : null)
      refreshUser()
    } finally {
      setStepping(false)
    }
  }

  const reset = () => { setGame(null); setError("") }

  const numCols = game?.num_cols ?? (difficulty === "normal" ? 2 : 3)
  const numRows = game?.num_rows ?? 8
  const isOver = game && ["won", "lost", "cashed_out"].includes(game.status)

  // Build display rows top-to-bottom (row numRows-1 at top, row 0 at bottom)
  const displayRows = Array.from({ length: numRows }, (_, i) => numRows - 1 - i)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-5">
        <Button variant="ghost" size="sm" asChild><NextLink href="/arcade"><ArrowLeft size={14} /> Arcade</NextLink></Button>
        <h1 className="text-xl font-bold">Towers</h1>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 text-xs text-green-400 cursor-help">
                <ShieldCheck size={13} /> Provably Fair
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              Outcomes are pre-generated via HMAC-SHA256 before you play. Verify using the server seed revealed after each game.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex gap-5 items-start flex-col lg:flex-row">
        {/* Left panel */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4">
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
            {/* Bet */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Bet Amount</Label>
              <Input
                type="number" value={bet} min={0.01} step={0.01}
                onChange={e => setBet(e.target.value)}
                disabled={!!game && game.status === "active"}
              />
              <div className="flex gap-1.5">
                {["1/2", "2x", "Max"].map(op => (
                  <Button key={op} size="sm" variant="outline" className="flex-1 h-6 text-xs"
                    disabled={!!game && game.status === "active"}
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

            {/* Difficulty */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Difficulty</Label>
              <div className="flex gap-1.5">
                {(["easy", "normal", "hard"] as Difficulty[]).map(d => (
                  <Button key={d} size="sm"
                    variant={difficulty === d ? "default" : "outline"}
                    className="flex-1 h-8 text-xs capitalize"
                    disabled={!!game && game.status === "active"}
                    onClick={() => setDifficulty(d)}>
                    {DIFF_LABELS[d].label}
                  </Button>
                ))}
              </div>
              <p className="text-[0.65rem] text-muted-foreground">{DIFF_LABELS[difficulty].desc}</p>
            </div>

            {/* Action buttons */}
            {!game || isOver ? (
              <Button className="w-full" onClick={startGame} disabled={loading || !user}>
                {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                {game && isOver ? "Play Again" : "Start Game"}
              </Button>
            ) : (
              <Button
                className="w-full bg-green-600 hover:bg-green-500 text-white"
                onClick={cashOut}
                disabled={stepping || game.current_row === 0}>
                {stepping ? <Loader2 size={14} className="animate-spin mr-1" /> : <TrendingUp size={14} className="mr-1" />}
                Cash Out {game.current_row > 0 ? fmt(game.bet * (game.multipliers[game.current_row - 1] ?? 1)) : ""}
              </Button>
            )}

            {error && <Alert variant="destructive"><AlertDescription className="text-xs">{error}</AlertDescription></Alert>}

            {/* Multiplier display */}
            {game && game.status === "active" && game.current_row > 0 && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Current Multiplier</p>
                <p className="text-2xl font-bold text-primary">{(game.multipliers[game.current_row - 1] ?? 1).toFixed(2)}x</p>
                <p className="text-sm font-semibold text-green-400">{fmt(game.bet * (game.multipliers[game.current_row - 1] ?? 1))}</p>
              </div>
            )}

            {/* Result display */}
            {isOver && game && (
              <div className={`rounded-lg p-3 text-center border ${
                game.status === "lost" ? "bg-red-500/10 border-red-500/20" :
                "bg-green-500/10 border-green-500/20"
              }`}>
                <p className="text-xs text-muted-foreground">
                  {game.status === "lost" ? "You hit a bomb!" : game.status === "won" ? "Tower cleared!" : "Cashed out!"}
                </p>
                <p className={`text-xl font-bold ${game.status === "lost" ? "text-red-400" : "text-green-400"}`}>
                  {game.status === "lost" ? `-${fmt(game.bet)}` : `+${fmt(game.payout - game.bet)}`}
                </p>
              </div>
            )}

            {/* Provably fair */}
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

        {/* Tower grid */}
        <div className="flex-1">
          <div className="flex flex-col gap-1.5">
            {displayRows.map(rowIdx => {
              const rowResult = game?.row_results.find(r => r.row === rowIdx)
              const isCurrentRow = game?.status === "active" && game.current_row === rowIdx
              const isFutureRow = !game || (game.status === "active" && rowIdx > game.current_row) || game.status === "idle"
              const multiplier = game?.multipliers[rowIdx] ?? null
              const cols = game ? game.num_cols : numCols

              // bomb columns for this row (only if revealed)
              const revealedBombs: number[] =
                rowResult ? rowResult.bombs :
                (isOver && game?.bomb_columns_all) ? game.bomb_columns_all[rowIdx] : []

              return (
                <div key={rowIdx} className={`flex items-center gap-2 transition-all ${
                  isCurrentRow ? "scale-[1.02]" : ""
                }`}>
                  {/* Row label */}
                  <div className="w-14 text-right">
                    {multiplier !== null ? (
                      <span className="text-xs font-semibold text-muted-foreground">
                        {multiplier.toFixed(2)}x
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Columns */}
                  <div className="flex gap-1.5 flex-1">
                    {Array.from({ length: cols }, (_, col) => {
                      const isBomb = revealedBombs.includes(col)
                      const isPicked = rowResult?.picked === col
                      const wasRevealed = !!rowResult || (isOver && game?.bomb_columns_all)

                      let cellClass = "flex-1 h-12 rounded-lg border text-sm font-bold transition-all "
                      if (!wasRevealed && !isCurrentRow) {
                        // future or past but not revealed — dim
                        cellClass += "bg-muted/20 border-border/30 text-muted-foreground/30 cursor-default"
                      } else if (isCurrentRow) {
                        cellClass += "bg-card border-primary/40 hover:border-primary hover:bg-primary/10 cursor-pointer active:scale-95"
                      } else if (isBomb && isPicked) {
                        // picked the bomb
                        cellClass += "bg-red-500/20 border-red-500/40 text-red-400"
                      } else if (isBomb) {
                        // bomb (not picked)
                        cellClass += "bg-red-500/10 border-red-500/20 text-red-400/60"
                      } else if (isPicked) {
                        // safe pick
                        cellClass += "bg-green-500/20 border-green-500/40 text-green-400"
                      } else {
                        // safe but not picked
                        cellClass += "bg-muted/20 border-border/30 text-muted-foreground/40 cursor-default"
                      }

                      return (
                        <button
                          key={col}
                          className={cellClass}
                          disabled={!isCurrentRow || stepping}
                          onClick={() => pickColumn(col)}
                        >
                          {wasRevealed ? (
                            isBomb ? <Bomb size={16} className="mx-auto" /> : isPicked ? <Check size={16} className="mx-auto" /> : "·"
                          ) : isCurrentRow ? (
                            <span className="text-primary/60">?</span>
                          ) : "·"}
                        </button>
                      )
                    })}
                  </div>

                  {/* Payout label */}
                  <div className="w-20 text-left">
                    {game && multiplier !== null ? (
                      <span className={`text-xs font-semibold ${
                        isCurrentRow ? "text-primary" :
                        rowResult && !rowResult.hit_bomb ? "text-green-400" :
                        rowResult?.hit_bomb ? "text-red-400" :
                        "text-muted-foreground/50"
                      }`}>
                        {fmt(game.bet * multiplier)}
                      </span>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
