"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import NextLink from "next/link"
import { ArrowLeft, Cpu, Activity, Layers, Users, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/lib/auth-context"
import { ZitesIcon } from "@/components/zites-icon"
import { formatZites } from "@/lib/format"
import type { MiningPool } from "@/lib/types"

interface RecentBlock {
  height: number
  hash: string
  reward_zites: number
  found_at: string
}

export default function PoolDetailPage() {
  const params = useParams()
  const poolId = params.id as string
  const { user } = useAuth()
  const [pool, setPool] = useState<MiningPool & { owner?: { id: string; username: string } } | null>(null)
  const [blocks, setBlocks] = useState<RecentBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [isMember, setIsMember] = useState(false)

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/mining/pools/${poolId}`)
      if (res.ok) {
        const data = await res.json()
        setPool(data.pool)
        setBlocks(data.recent_blocks ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [poolId])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  useEffect(() => {
    if (!user) return
    fetch(`/api/mining/pools?mine=1&user_id=${user.id}`)
      .then((r) => r.json())
      .then((data) => setIsMember((data.pools ?? []).some((p: any) => p.id === poolId)))
  }, [user, poolId])

  const handleJoinLeave = async () => {
    if (!user) return
    await fetch(`/api/mining/pools/${poolId}/join`, {
      method: isMember ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id }),
    })
    setIsMember(!isMember)
    fetchDetail()
  }

  if (loading || !pool) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="h-40 rounded-xl bg-muted/40 animate-pulse" />
      </div>
    )
  }

  const isOwner = user && pool.owner_id === user.id

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <NextLink href="/mining" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft size={14} /> Back to pools
      </NextLink>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cpu size={22} className="text-primary" /> {pool.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Owned by {pool.owner?.username ?? "Unknown"} · {pool.status}
          </p>
        </div>
        {user && (
          <Button variant={isMember ? "outline" : "default"} onClick={handleJoinLeave}>
            {isMember ? "Leave Pool" : "Join Pool"}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { icon: <Activity size={14} className="text-primary" />, label: "Uptime (24h)", value: `${pool.uptime_pct_24h.toFixed(1)}%` },
          { icon: <Layers size={14} className="text-primary" />, label: "Blocks Found", value: pool.blocks_found },
          { icon: <Users size={14} className="text-primary" />, label: "Members", value: pool.member_count },
          { icon: <ZitesIcon size={14} />, label: "Shares Reported", value: pool.total_shares_reported },
        ].map(({ icon, label, value }) => (
          <Card key={label} className="bg-card/60">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                {icon}
                <span className="text-xs">{label}</span>
              </div>
              <p className="text-base font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {pool.description && <p className="text-sm text-muted-foreground mb-6">{pool.description}</p>}

      <Card className="bg-card/60 mb-6">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm font-bold">Last Blocks Found</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {blocks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">This pool hasn't found a block yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {blocks.map((b) => (
                <div key={b.height} className="flex items-center justify-between text-xs border-b border-border/40 pb-2 last:border-0">
                  <span className="font-mono font-bold text-muted-foreground">#{b.height}</span>
                  <span className="font-mono text-[0.6rem] truncate max-w-[200px]">{b.hash}</span>
                  <span className="text-amber-500 font-semibold flex items-center gap-1"><ZitesIcon size={11} /> +{formatZites(Number(b.reward_zites))}</span>
                  <span className="text-muted-foreground">{new Date(b.found_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isOwner && (
        <Card className="bg-card/60">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
              <KeyRound size={14} className="text-primary" /> Owner Panel
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex flex-col gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">API key prefix</span>
              <span className="font-mono">{pool.api_key_prefix}…</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Host : Port</span>
              <span className="font-mono">{pool.host}:{pool.port}</span>
            </div>
            <p className="text-[0.65rem] text-muted-foreground mt-1">
              Your API key was shown once at registration and cannot be retrieved again. See the{" "}
              <NextLink href="/developer/docs/mining-pools" className="text-primary hover:underline">Mining Pools documentation</NextLink> for the full API contract.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
