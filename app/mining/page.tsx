"use client"

import { useState, useEffect, useCallback } from "react"
import NextLink from "next/link"
import { Cpu, Server, Plus, Activity, Layers, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth-context"
import { ZitesIcon } from "@/components/zites-icon"
import LiveBlocksFeed from "@/components/mining/live-blocks-feed"
import type { MiningPool } from "@/lib/types"

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-500/15 text-green-400 border-green-500/25",
  testing: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  pending: "bg-muted text-muted-foreground border-border",
  offline: "bg-red-500/15 text-red-400 border-red-500/25",
  banned: "bg-red-900/20 text-red-500 border-red-900/30",
}

export default function MiningHubPage() {
  const { user } = useAuth()
  const [pools, setPools] = useState<MiningPool[]>([])
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const fetchPools = useCallback(async () => {
    setLoading(true)
    try {
      const [poolsRes, mineRes] = await Promise.all([
        fetch("/api/mining/pools"),
        user ? fetch(`/api/mining/pools?mine=1&user_id=${user.id}`) : Promise.resolve(null),
      ])
      if (poolsRes.ok) {
        const data = await poolsRes.json()
        setPools(data.pools ?? [])
      }
      if (mineRes?.ok) {
        const data = await mineRes.json()
        setJoinedIds(new Set((data.pools ?? []).map((p: MiningPool) => p.id)))
      } else {
        setJoinedIds(new Set())
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchPools() }, [fetchPools])

  const handleJoin = async (poolId: string) => {
    if (!user) return
    await fetch(`/api/mining/pools/${poolId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id }),
    })
    fetchPools()
  }

  const handleLeave = async (poolId: string) => {
    if (!user) return
    await fetch(`/api/mining/pools/${poolId}/join`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id }),
    })
    fetchPools()
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Server size={22} className="text-primary" /> Mining Pools
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Combine hashpower with other miners and split OmegaZites rewards. Prefer to mine alone? <NextLink href="/mine" className="text-primary hover:underline">Go to Solo Mining</NextLink>.
          </p>
        </div>
        {user && (
          <Button asChild className="gap-1.5">
            <NextLink href="/mining/pools/create"><Plus size={14} /> Create Pool</NextLink>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 rounded-xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : pools.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Server size={28} className="opacity-40" />
              <p className="text-sm">No pools are listed yet — be the first to create one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pools.map((pool) => (
                <Card key={pool.id} className="bg-card/60">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                        <Cpu size={14} className="text-primary" />
                        <NextLink href={`/mining/pools/${pool.id}`} className="hover:underline">{pool.name}</NextLink>
                      </CardTitle>
                      <Badge variant="outline" className={STATUS_STYLES[pool.status]}>{pool.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 flex flex-col gap-2">
                    {pool.description && <p className="text-xs text-muted-foreground">{pool.description}</p>}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="flex flex-col items-center bg-muted/40 rounded-lg py-1.5">
                        <span className="flex items-center gap-1 text-muted-foreground"><Activity size={10} /> Uptime</span>
                        <span className="font-bold">{pool.uptime_pct_24h.toFixed(1)}%</span>
                      </div>
                      <div className="flex flex-col items-center bg-muted/40 rounded-lg py-1.5">
                        <span className="flex items-center gap-1 text-muted-foreground"><Layers size={10} /> Blocks</span>
                        <span className="font-bold">{pool.blocks_found}</span>
                      </div>
                      <div className="flex flex-col items-center bg-muted/40 rounded-lg py-1.5">
                        <span className="flex items-center gap-1 text-muted-foreground"><Users size={10} /> Members</span>
                        <span className="font-bold">{pool.member_count}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <Button size="sm" variant="outline" className="flex-1" asChild>
                        <NextLink href={`/mining/pools/${pool.id}`}>View</NextLink>
                      </Button>
                      {user && (
                        joinedIds.has(pool.id) ? (
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => handleLeave(pool.id)}>Leave Pool</Button>
                        ) : (
                          <Button size="sm" className="flex-1" onClick={() => handleJoin(pool.id)}>Join Pool</Button>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-6 flex items-center gap-1.5">
            <ZitesIcon size={12} /> Want to run your own pool? See the <NextLink href="/developer/docs/mining-pools" className="text-primary hover:underline mx-1">Mining Pools documentation</NextLink> for the full setup guide.
          </p>
        </div>

        {/* Live blocks sidebar */}
        <div>
          <LiveBlocksFeed compact />
        </div>
      </div>
    </div>
  )
}
