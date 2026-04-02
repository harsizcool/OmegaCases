"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import dynamic from "next/dynamic"
import { Loader2, Store, Users, Trophy, Clock } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Rarity } from "@/lib/types"
import { RARITY_COLORS } from "@/lib/types"
import NextLink from "next/link"

const SalesPriceChart = dynamic(() => import("@/components/sales-price-chart"), { ssr: false })

const RARITY_ODDS: Record<string, string> = {
  Common: "1 in 2",
  Uncommon: "1 in 5",
  Rare: "1 in 20",
  Legendary: "1 in 100",
  Omega: "1 in 1,000+",
}

const TABS = ["Overview", "Listings", "Owners"]

export default function ItemPage() {
  const params = useParams()
  const name = decodeURIComponent(params.name as string)

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [tab, setTab] = useState(0)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const res = await fetch(`/api/items/${encodeURIComponent(name)}`)
      if (!res.ok) { setError("Item not found"); setLoading(false); return }
      setData(await res.json())
      setLoading(false)
    }
    load()
  }, [name])

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-muted-foreground" /></div>
  if (error || !data) return <div className="max-w-2xl mx-auto px-4 py-6"><Alert variant="destructive"><AlertDescription>{error || "Not found"}</AlertDescription></Alert></div>

  const { item, circulation, owners, listings, sales } = data
  const rarityColor = RARITY_COLORS[item.rarity as Rarity] || "#888"
  const salesMin = sales.length ? Math.min(...sales.map((s: any) => s.price)) : 0
  const salesMax = sales.length ? Math.max(...sales.map((s: any) => s.price)) : 0
  const salesAvg = sales.length ? (sales.reduce((s: number, x: any) => s + Number(x.price), 0) / sales.length) : 0

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex gap-6 items-start flex-wrap mb-8">
        <img
          src={item.image_url}
          alt={item.name}
          className="w-32 sm:w-44 h-32 sm:h-44 object-contain rounded-2xl border-2 bg-blue-50 dark:bg-slate-800 p-2"
          style={{ borderColor: rarityColor + "44" }}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h1 className="text-3xl font-extrabold">{item.name}</h1>
            <span className="text-white text-sm font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: rarityColor }}>
              {item.rarity}
            </span>
            {item.limited_time && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1 bg-black/75 text-yellow-300 text-xs font-bold px-2 py-0.5 rounded-full">
                      <Clock size={11} /> Limited Time
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Limited time — not available in cases</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <p className="text-muted-foreground mb-2">
            RAP: <strong className="text-primary">${Number(item.rap).toFixed(2)}</strong>
            &nbsp;·&nbsp; In Circulation: <strong>{circulation}</strong>
            &nbsp;·&nbsp; Odds: <strong>{RARITY_ODDS[item.rarity] ?? "Unknown"}</strong>
          </p>
          {item.first_unboxer && (
            <div className="flex items-center gap-1.5 mb-2">
              <Trophy size={14} className="text-amber-500" />
              <span className="text-sm text-muted-foreground">
                First Discovered by{" "}
                <NextLink href={`/user/${item.first_unboxer.username}`} className="text-primary font-bold hover:underline">
                  {item.first_unboxer.username}
                </NextLink>
              </span>
            </div>
          )}
          <Button size="sm" className="gap-1.5 mt-1" asChild>
            <NextLink href="/marketplace"><Store size={14} /> View on Marketplace</NextLink>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((label, i) => (
          <button
            key={label}
            onClick={() => setTab(i)}
            className={`px-3 py-1 rounded-full border text-sm font-semibold transition-colors ${tab === i ? "text-white" : "text-primary bg-transparent hover:bg-primary/10"}`}
            style={{ backgroundColor: tab === i ? rarityColor : undefined, borderColor: rarityColor }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 0 && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[
              { label: "RAP", value: `$${Number(item.rap).toFixed(2)}` },
              { label: "Market Price", value: `$${Number(item.market_price).toFixed(2)}` },
              { label: "Rarity", value: item.rarity },
              { label: "Odds", value: RARITY_ODDS[item.rarity] ?? "—" },
              { label: "Total in Circulation", value: circulation },
              { label: "Active Listings", value: listings.length },
              { label: "Total Sales Recorded", value: sales.length },
              ...(salesAvg > 0 ? [
                { label: "Sale Price Min", value: `$${salesMin.toFixed(2)}` },
                { label: "Sale Price Max", value: `$${salesMax.toFixed(2)}` },
                { label: "Sale Price Avg", value: `$${salesAvg.toFixed(2)}` },
              ] : []),
            ].map(({ label, value }) => (
              <div key={label} className="p-3 border border-border rounded-xl">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-bold" style={{ color: label === "Rarity" ? rarityColor : "var(--color-primary)" }}>{value}</p>
              </div>
            ))}
          </div>
          {sales.length > 0 ? (
            <div>
              <p className="font-bold mb-3 text-primary">Recent Sales (last {sales.length})</p>
              <SalesPriceChart data={sales.map((s: any, i: number) => ({ date: `#${i + 1}`, price: Number(s.price) }))} color="var(--color-primary)" />
            </div>
          ) : (
            <p className="text-muted-foreground">No sales recorded yet.</p>
          )}
        </div>
      )}

      {/* Listings */}
      {tab === 1 && (
        listings.length === 0 ? (
          <p className="text-muted-foreground">No active listings for this item.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {listings.map((l: any) => (
              <Card key={l.id} className="flex items-center gap-3 p-3" style={{ borderColor: rarityColor + "33" }}>
                <div className="flex-1">
                  <p className="font-bold text-primary">${Number(l.price).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">by {l.users?.username || "—"}</p>
                </div>
                <Button size="sm" asChild><NextLink href={`/listing/${l.id}`}>Buy</NextLink></Button>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Owners */}
      {tab === 2 && (
        owners.length === 0 ? (
          <p className="text-muted-foreground">Nobody owns this item yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {owners.map(({ user: u, count }: any) => (
              <NextLink
                key={u?.id || Math.random()}
                href={`/user/${u?.username}`}
                className="flex items-center gap-3 p-3 border border-border rounded-xl hover:shadow-md transition-shadow no-underline text-foreground"
              >
                <Avatar className="w-9 h-9">
                  {u?.profile_picture && <AvatarImage src={u.profile_picture} />}
                  <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">
                    {u?.username?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-bold">{u?.username}</p>
                  <p className="text-xs text-muted-foreground">Owns {count}x</p>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: rarityColor }}>x{count}</span>
              </NextLink>
            ))}
          </div>
        )
      )}
    </div>
  )
}
