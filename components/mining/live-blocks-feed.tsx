"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createClient } from "@supabase/supabase-js"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Cpu, Hash, ChevronRight, Copy, Check, Server } from "lucide-react"
import { ZitesIcon } from "@/components/zites-icon"
import { formatZites } from "@/lib/format"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export interface ShareEntry {
  user_id: string
  shares: number
  zites_credited: number
  users: { id: string; username: string; profile_picture: string | null; plus: boolean } | null
}

export interface MiningBlock {
  id?: string
  height: number
  hash: string
  nonce: number
  miner_id: string
  previous_hash: string
  target: string
  reward_zites: number
  pool_id: string | null
  found_at: string
  users: {
    id: string
    username: string
    profile_picture: string | null
    plus: boolean
  }
  mining_pools?: { id: string; name: string } | null
  shares?: ShareEntry[]
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
  const isPoolBlock = !!block.pool_id
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
        <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
          <ZitesIcon size={11} /> +{formatZites(Number(block.reward_zites))}
        </span>
      </div>
      <p className="text-[0.6rem] font-mono text-muted-foreground truncate mb-2">{block.hash}</p>
      <div className="flex items-center gap-1.5">
        {isPoolBlock ? (
          <>
            <div className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Server size={10} className="text-primary" />
            </div>
            <span className="text-xs font-semibold">Mined in pool</span>
            {block.mining_pools && (
              <Badge variant="outline" className="text-[0.5rem] h-3.5 px-1 py-0">{block.mining_pools.name}</Badge>
            )}
          </>
        ) : (
          <>
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
          </>
        )}
        <ChevronRight size={12} className="ml-auto text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
    </button>
  )
}

export default function LiveBlocksFeed({ compact = false, onBlocksChange }: { compact?: boolean; onBlocksChange?: (blocks: MiningBlock[]) => void }) {
  const [blocks, setBlocks] = useState<MiningBlock[]>([])
  const [loadingBlocks, setLoadingBlocks] = useState(true)
  const [selectedBlock, setSelectedBlock] = useState<MiningBlock | null>(null)
  const [loadingShares, setLoadingShares] = useState(false)
  const onBlocksChangeRef = useRef(onBlocksChange)
  onBlocksChangeRef.current = onBlocksChange

  const fetchBlocks = useCallback(async () => {
    try {
      const res = await fetch("/api/mining/blocks?page=0")
      if (res.ok) {
        const data = await res.json()
        setBlocks(data.blocks ?? [])
        onBlocksChangeRef.current?.(data.blocks ?? [])
      }
    } finally {
      setLoadingBlocks(false)
    }
  }, [])

  useEffect(() => { fetchBlocks() }, [fetchBlocks])

  // Supabase Realtime: listen for new blocks
  useEffect(() => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    const channel = supabase
      .channel(compact ? "mining-blocks-live-pools" : "mining-blocks-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mining_blocks" },
        async (payload) => {
          const raw = payload.new as MiningBlock
          const res = await fetch(`/api/mining/blocks?height=${raw.height}`)
          if (res.ok) {
            const { block } = await res.json()
            setBlocks((prev) => {
              const next = [block, ...prev.slice(0, 99)]
              onBlocksChangeRef.current?.(next)
              return next
            })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [compact])

  const openBlock = async (block: MiningBlock) => {
    setSelectedBlock(block)
    if (block.pool_id && !block.shares) {
      setLoadingShares(true)
      try {
        const res = await fetch(`/api/mining/blocks?height=${block.height}`)
        if (res.ok) {
          const { block: full } = await res.json()
          setSelectedBlock(full)
        }
      } finally {
        setLoadingShares(false)
      }
    }
  }

  const listMaxHeight = compact ? "max-h-[500px]" : "max-h-[600px]"

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Live Block{compact ? "s" : " Explorer"}
        </h2>
        {!compact && <span className="text-xs text-muted-foreground">{blocks.length} blocks loaded</span>}
      </div>

      {loadingBlocks ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: compact ? 3 : 5 }).map((_, i) => (
            <div key={i} className="h-[88px] rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : blocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Cpu size={28} className="opacity-40" />
          <p className="text-sm">No blocks mined yet — be the first!</p>
        </div>
      ) : (
        <div className={`flex flex-col gap-2 ${listMaxHeight} overflow-y-auto pr-1`}>
          {blocks.map((block) => (
            <BlockCard key={block.height} block={block} onClick={() => openBlock(block)} />
          ))}
        </div>
      )}

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
              {selectedBlock.pool_id ? (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <Server size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">
                      Mined in pool{selectedBlock.mining_pools ? `: ${selectedBlock.mining_pools.name}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">Reward split among contributing miners</p>
                  </div>
                  <span className="ml-auto text-sm font-bold text-amber-500 flex items-center gap-1">
                    <ZitesIcon size={13} /> +{formatZites(Number(selectedBlock.reward_zites))}
                  </span>
                </div>
              ) : (
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
                  <span className="ml-auto text-sm font-bold text-amber-500 flex items-center gap-1">
                    <ZitesIcon size={13} /> +{formatZites(Number(selectedBlock.reward_zites))}
                  </span>
                </div>
              )}

              {selectedBlock.pool_id && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold mb-2">Share Split</p>
                    {loadingShares ? (
                      <div className="flex flex-col gap-1.5">
                        {Array.from({ length: 2 }).map((_, i) => (
                          <div key={i} className="h-8 rounded-lg bg-muted/40 animate-pulse" />
                        ))}
                      </div>
                    ) : selectedBlock.shares && selectedBlock.shares.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {selectedBlock.shares.map((s) => (
                          <div key={s.user_id} className="flex items-center gap-2 text-xs bg-muted/40 rounded-lg px-2.5 py-1.5">
                            <Avatar className="w-5 h-5">
                              {s.users?.profile_picture && <AvatarImage src={s.users.profile_picture} />}
                              <AvatarFallback className="bg-primary text-primary-foreground text-[0.55rem] font-bold">
                                {s.users?.username?.[0]?.toUpperCase() ?? "?"}
                              </AvatarFallback>
                            </Avatar>
                            <span className={`font-semibold ${s.users?.plus ? "text-primary" : ""}`}>
                              {s.users?.username ?? "Unknown"}
                            </span>
                            <span className="ml-auto text-amber-500 font-semibold flex items-center gap-1">
                              <ZitesIcon size={11} /> +{formatZites(Number(s.zites_credited))}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No share data available.</p>
                    )}
                  </div>
                </>
              )}

              <Separator />

              {[
                { label: "Block Height", value: `#${selectedBlock.height}` },
                { label: "Found", value: new Date(selectedBlock.found_at).toLocaleString() },
                { label: "Nonce", value: selectedBlock.nonce.toLocaleString() },
                { label: "Source", value: selectedBlock.pool_id ? "Pool" : "Solo" },
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
