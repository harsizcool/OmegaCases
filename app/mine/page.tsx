"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Monitor, Smartphone, Download, Cpu, Hash, Clock, Coins, TrendingDown, TrendingUp, Zap, ChevronRight, RefreshCw, Copy, Check } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const TARGET_BLOCK_TIME_MS = 6 * 60 * 1000

interface MiningBlock {
  height: number
  hash: string
  nonce: number
  miner_id: string
  previous_hash: string
  target: string
  reward: number
  found_at: string
  users: {
    id: string
    username: string
    profile_picture: string | null
    plus: boolean
  }
}

interface MiningInfo {
  target: string
  height: number
  previous_hash: string
  reward: number
  halving: {
    next_height: number
    blocks_remaining: number
    eta_ms: number
  }
  difficulty_adjustment: {
    next_height: number
    blocks_remaining: number
  }
}

function formatDuration(ms: number) {
  if (ms <= 0) return "soon"
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (d > 0) return `~${d}d ${h}h`
  if (h > 0) return `~${h}h ${m}m`
  return `~${m}m`
}

function formatAge(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

function difficultyLabel(target: string): string {
  // Count leading zero hex chars as rough difficulty indicator
  let zeros = 0
  for (const c of target) {
    if (c === "0") zeros++
    else break
  }
  return `${zeros} leading zeros`
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
    </button>
  )
}

function BlockCard({ block, onClick }: { block: MiningBlock; onClick: () => void }) {
  const isNew = Date.now() - new Date(block.found_at).getTime() < 5000
  return (
    <button
      onClick={onClick}
      className={`w-full text-left border rounded-xl p-3 hover:border-primary/40 hover:bg-muted/30 transition-all group ${
        isNew ? "border-primary/50 bg-primary/5 animate-pulse-once" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[0.7rem] font-mono font-bold text-muted-foreground">#{block.height}</span>
          <span className="text-[0.65rem] text-muted-foreground">{formatAge(block.found_at)}</span>
        </div>
        <span className="text-xs font-bold text-green-400">+${Number(block.reward).toFixed(4)}</span>
      </div>
      <p className="text-[0.6rem] font-mono text-muted-foreground truncate mb-2">{block.hash}</p>
      <div className="flex items-center gap-1.5">
        <Avatar className="w-4 h-4">
          {block.users?.profile_picture && <AvatarImage src={block.users.profile_picture} />}
          <AvatarFallback className="bg-primary text-primary-foreground text-[0.5rem] font-bold">
            {block.users?.username?.[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className={`text-xs font-semibold ${block.users?.plus ? "text-primary" : ""}`}>
          {block.users?.username ?? "Unknown"}
        </span>
        {block.users?.plus && <Badge className="text-[0.5rem] h-3.5 px-1 py-0">Plus</Badge>}
        <ChevronRight size={12} className="ml-auto text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
    </button>
  )
}

export default function MinePage() {
  const { user } = useAuth()
  const [info, setInfo] = useState<MiningInfo | null>(null)
  const [blocks, setBlocks] = useState<MiningBlock[]>([])
  const [loadingInfo, setLoadingInfo] = useState(true)
  const [loadingBlocks, setLoadingBlocks] = useState(true)
  const [selectedBlock, setSelectedBlock] = useState<MiningBlock | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [now, setNow] = useState(Date.now())
  const realtimeRef = useRef<ReturnType<typeof createClient> | null>(null)

  // Tick every second for live countdowns
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent))
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const fetchInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/mining")
      if (res.ok) setInfo(await res.json())
    } finally {
      setLoadingInfo(false)
    }
  }, [])

  const fetchBlocks = useCallback(async () => {
    try {
      const res = await fetch("/api/mining/blocks?page=0")
      if (res.ok) {
        const data = await res.json()
        setBlocks(data.blocks ?? [])
      }
    } finally {
      setLoadingBlocks(false)
    }
  }, [])

  useEffect(() => {
    fetchInfo()
    fetchBlocks()
  }, [fetchInfo, fetchBlocks])

  // Supabase Realtime: listen for new blocks
  useEffect(() => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    realtimeRef.current = supabase

    const channel = supabase
      .channel("mining-blocks-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mining_blocks" },
        async (payload) => {
          const raw = payload.new as MiningBlock
          // Fetch full block with user info
          const res = await fetch(`/api/mining/blocks?height=${raw.height}`)
          if (res.ok) {
            const { block } = await res.json()
            setBlocks((prev) => [block, ...prev.slice(0, 99)])
            // Also refresh mining info (new height, new target, etc.)
            fetchInfo()
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchInfo])

  const halvingEtaMs = info
    ? info.halving.eta_ms - (now - Date.now())  // static since we fetched
    : null

  // Estimate time since last block for a "live timer" feel
  const lastBlockAge = blocks[0] ? Date.now() - new Date(blocks[0].found_at).getTime() : null

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cpu size={22} className="text-primary" /> Mining
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            SHA-256 proof-of-work · 6-minute target · real-time block explorer
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { fetchInfo(); fetchBlocks() }}>
          <RefreshCw size={13} /> Refresh
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {
            icon: <Hash size={14} className="text-primary" />,
            label: "Block Height",
            value: info ? `#${info.height.toLocaleString()}` : "—",
          },
          {
            icon: <Coins size={14} className="text-green-400" />,
            label: "Block Reward",
            value: info ? `$${Number(info.reward).toFixed(4)}` : "—",
          },
          {
            icon: <Zap size={14} className="text-yellow-400" />,
            label: "Halving In",
            value: info ? `${info.halving.blocks_remaining.toLocaleString()} blocks` : "—",
            sub: info ? formatDuration(info.halving.eta_ms) : undefined,
          },
          {
            icon: <Clock size={14} className="text-blue-400" />,
            label: "Last Block",
            value: blocks[0] ? formatAge(blocks[0].found_at) : "—",
            live: true,
          },
        ].map(({ icon, label, value, sub, live }) => (
          <Card key={label} className="bg-card/60">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                {icon}
                <span className="text-xs">{label}</span>
                {live && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
              </div>
              <p className="text-base font-bold">{value}</p>
              {sub && <p className="text-[0.65rem] text-muted-foreground">{sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Block explorer */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Live Block Explorer
            </h2>
            <span className="text-xs text-muted-foreground">{blocks.length} blocks loaded</span>
          </div>

          {loadingBlocks ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-[88px] rounded-xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Cpu size={28} className="opacity-40" />
              <p className="text-sm">No blocks mined yet — be the first!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1">
              {blocks.map((block) => (
                <BlockCard key={block.height} block={block} onClick={() => setSelectedBlock(block)} />
              ))}
            </div>
          )}
        </div>

        {/* Right panel: current target + download */}
        <div className="flex flex-col gap-4">
          {/* Current target */}
          <Card className="bg-card/60">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <Hash size={14} className="text-primary" /> Current Target
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 flex flex-col gap-3">
              <p className="text-[0.6rem] font-mono break-all text-muted-foreground leading-relaxed">
                {info?.target ?? DEFAULT_TARGET}
              </p>
              <div className="text-xs text-muted-foreground">
                Difficulty: <span className="font-semibold text-foreground">{info ? difficultyLabel(info.target) : "—"}</span>
              </div>
              <Separator />
              <div className="text-xs text-muted-foreground">
                Previous hash:
                <p className="font-mono text-[0.58rem] break-all text-foreground/60 mt-0.5">
                  {info?.previous_hash ?? "—"}
                </p>
              </div>
              <Separator />
              <div className="text-xs">
                <div className="flex justify-between text-muted-foreground mb-1">
                  <span>Diff adjust in</span>
                  <span className="font-semibold text-foreground">
                    {info ? `${info.difficulty_adjustment.blocks_remaining} blocks` : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Halving in</span>
                  <span className="font-semibold text-foreground">
                    {info ? `${info.halving.blocks_remaining} blocks` : "—"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Download / mining info */}
          <Card className="bg-card/60">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <Download size={14} className="text-primary" /> Mine Blocks
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 flex flex-col gap-3 text-sm">
              {isMobile ? (
                <div className="flex flex-col items-center gap-2 py-3 text-center">
                  <Smartphone size={28} className="text-muted-foreground opacity-50" />
                  <p className="text-xs text-muted-foreground">
                    Mining is only available on desktop (requires Python with <code>tkinter</code>, <code>requests</code>, and <code>hashlib</code>).
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You can still watch the live block explorer here.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-2">
                    <Monitor size={15} className="text-primary mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Download the OmegaCases miner (Python app) to start earning blocks. Requires Python 3 with <code className="text-xs bg-muted px-1 rounded">tkinter</code>, <code className="text-xs bg-muted px-1 rounded">requests</code>, and <code className="text-xs bg-muted px-1 rounded">hashlib</code>.
                    </p>
                  </div>

                  {user ? (
                    <>
                      <div className="text-xs bg-muted/50 rounded-lg p-2.5 font-mono break-all">
                        <span className="text-muted-foreground text-[0.6rem] block mb-1">Your miner ID</span>
                        <span className="text-foreground">{user.id}</span>
                        <CopyButton text={user.id} />
                      </div>
                      <p className="text-[0.65rem] text-muted-foreground">
                        Your ID is pre-configured in the miner. Each valid block you find credits <span className="text-green-400 font-semibold">${Number(info?.reward ?? 0.12).toFixed(4)}</span> to your balance.
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Log in to see your miner ID and start earning.
                    </p>
                  )}

                  <Button className="gap-2 w-full" asChild>
                    <a href="https://github.com/harsiz/OC-Miner/" target="_blank" rel="noopener noreferrer">
                      <Download size={14} /> Download Miner
                    </a>
                  </Button>

                  <div className="text-[0.62rem] text-muted-foreground space-y-1">
                    <p>• Hash function: <span className="font-mono text-foreground">SHA256(prev_hash + user_id + nonce)</span></p>
                    <p>• Target block time: <span className="font-semibold text-foreground">6 minutes</span></p>
                    <p>• Difficulty adjusts every <span className="font-semibold text-foreground">32 blocks</span></p>
                    <p>• Reward halves every <span className="font-semibold text-foreground">64 blocks</span></p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Block detail modal */}
      <Dialog open={!!selectedBlock} onOpenChange={(v) => !v && setSelectedBlock(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash size={16} className="text-primary" />
              Block #{selectedBlock?.height}
            </DialogTitle>
          </DialogHeader>
          {selectedBlock && (
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  {selectedBlock.users?.profile_picture && <AvatarImage src={selectedBlock.users.profile_picture} />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                    {selectedBlock.users?.username?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className={`font-semibold text-sm ${selectedBlock.users?.plus ? "text-primary" : ""}`}>
                    {selectedBlock.users?.username ?? "Unknown"}
                    {selectedBlock.users?.plus && <Badge className="ml-1.5 text-[0.5rem] h-3.5 px-1">Plus</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">Miner</p>
                </div>
                <span className="ml-auto text-sm font-bold text-green-400">+${Number(selectedBlock.reward).toFixed(4)}</span>
              </div>

              <Separator />

              {[
                { label: "Block Height", value: `#${selectedBlock.height}` },
                { label: "Found", value: new Date(selectedBlock.found_at).toLocaleString() },
                { label: "Nonce", value: selectedBlock.nonce.toLocaleString() },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))}

              <Separator />

              {[
                { label: "Hash", value: selectedBlock.hash },
                { label: "Previous Hash", value: selectedBlock.previous_hash },
                { label: "Target", value: selectedBlock.target },
              ].map(({ label, value }) => (
                <div key={label} className="text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <div className="flex items-start mt-0.5">
                    <p className="font-mono text-[0.6rem] break-all text-foreground/80 leading-relaxed">{value}</p>
                    <CopyButton text={value} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

const DEFAULT_TARGET = "00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
