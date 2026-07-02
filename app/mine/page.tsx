"use client"

import { useState, useEffect, useCallback } from "react"
import NextLink from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Monitor, Smartphone, Download, Cpu, Hash, Clock, Zap, RefreshCw, Copy, Check } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { ZitesIcon } from "@/components/zites-icon"
import { formatZites } from "@/lib/format"
import LiveBlocksFeed, { type MiningBlock } from "@/components/mining/live-blocks-feed"

interface MiningInfo {
  target: string
  height: number
  previous_hash: string
  reward_zites: number
  zites_halving: {
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

export default function MinePage() {
  const { user } = useAuth()
  const [info, setInfo] = useState<MiningInfo | null>(null)
  const [lastBlock, setLastBlock] = useState<MiningBlock | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent))
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const fetchInfo = useCallback(async () => {
    const res = await fetch("/api/mining")
    if (res.ok) setInfo(await res.json())
  }, [])

  useEffect(() => { fetchInfo() }, [fetchInfo])

  const handleBlocksChange = useCallback((blocks: MiningBlock[]) => {
    setLastBlock(blocks[0] ?? null)
    fetchInfo()
  }, [fetchInfo])

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
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fetchInfo()}>
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
            icon: <ZitesIcon size={14} />,
            label: "Block Reward",
            value: info ? `${formatZites(Number(info.reward_zites))} Zites` : "—",
          },
          {
            icon: <Zap size={14} className="text-yellow-400" />,
            label: "Halving In",
            value: info ? `${info.zites_halving.blocks_remaining.toLocaleString()} blocks` : "—",
            sub: info ? formatDuration(info.zites_halving.eta_ms) : undefined,
          },
          {
            icon: <Clock size={14} className="text-blue-400" />,
            label: "Last Block",
            value: lastBlock ? formatAge(lastBlock.found_at) : "—",
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
          <LiveBlocksFeed onBlocksChange={handleBlocksChange} />
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
                    {info ? `${info.zites_halving.blocks_remaining} blocks` : "—"}
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
                    Mining is only available on desktop (Windows, macOS, or Linux).
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
                      Download the OmegaCases GPU miner to start earning OmegaZites. It supports both <span className="text-foreground font-semibold">Solo Mining</span> (straight against OmegaCases) and <span className="text-foreground font-semibold">Pool Mining</span> (point it at a pool you've joined from <NextLink href="/mining" className="text-primary hover:underline">/mining</NextLink>).
                    </p>
                  </div>

                  {user ? (
                    <>
                      <div className="text-xs bg-muted/50 rounded-lg p-2.5 font-mono break-all">
                        <span className="text-muted-foreground text-[0.6rem] block mb-1">Your miner ID (use this for Solo Mining)</span>
                        <span className="text-foreground">{user.id}</span>
                        <CopyButton text={user.id} />
                      </div>
                      <p className="text-[0.65rem] text-muted-foreground">
                        Enter this as your miner address in Solo Mining mode. Each valid block you find credits <span className="text-amber-500 font-semibold">{formatZites(Number(info?.reward_zites ?? 128))} OmegaZites</span> to your balance.
                      </p>
                      <Alert className="py-2">
                        <AlertDescription className="text-xs">
                          Joining a pool on the site does not change what your miner does by itself. After joining, open the miner, switch to <strong>Pool Mining</strong>, and enter the pool's host/port (shown on the pool's page) plus your OmegaCases user id above. Solo Mining stays selected until you switch it yourself.
                        </AlertDescription>
                      </Alert>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Log in to see your miner ID and start earning.
                    </p>
                  )}

                  <Button className="gap-2 w-full" asChild>
                    <a href="https://github.com/harsiz/oc-miner" target="_blank" rel="noopener noreferrer">
                      <Download size={14} /> Download Miner
                    </a>
                  </Button>

                  <div className="text-[0.62rem] text-muted-foreground space-y-1">
                    <p>• Hash function: <span className="font-mono text-foreground">SHA256(prev_hash + id_no_dashes + nonce)</span></p>
                    <p>• Target block time: <span className="font-semibold text-foreground">6 minutes</span></p>
                    <p>• Difficulty adjusts every <span className="font-semibold text-foreground">10 blocks</span></p>
                    <p>• OmegaZites reward halves every <span className="font-semibold text-foreground">200 blocks</span></p>
                    <p>• Pool mining: <NextLink href="/developer/docs/mining-pools" className="text-primary hover:underline">how pools work</NextLink></p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

const DEFAULT_TARGET = "00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
