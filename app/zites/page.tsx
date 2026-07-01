"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TrendingUp, TrendingDown, RefreshCw, X } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { ZitesIcon } from "@/components/zites-icon"
import { formatZites } from "@/lib/format"
import type { ZitesOrder, ZitesTrade } from "@/lib/types"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

interface ZitesStats {
  average_price: number
  last_price: number
  best_bid: number | null
  best_ask: number | null
  volume_24h: number
}

interface DepthRow {
  price: number
  quantity: number
}

export default function ZitesPage() {
  const { user, refreshUser } = useAuth()
  const [stats, setStats] = useState<ZitesStats | null>(null)
  const [book, setBook] = useState<{ bids: DepthRow[]; asks: DepthRow[] }>({ bids: [], asks: [] })
  const [trades, setTrades] = useState<ZitesTrade[]>([])
  const [myOrders, setMyOrders] = useState<ZitesOrder[]>([])
  const [side, setSide] = useState<"buy" | "sell">("buy")
  const [orderType, setOrderType] = useState<"market" | "limit">("market")
  const [price, setPrice] = useState("")
  const [quantity, setQuantity] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/zites")
    if (res.ok) setStats(await res.json())
  }, [])

  const fetchBook = useCallback(async () => {
    const res = await fetch("/api/zites/book")
    if (res.ok) setBook(await res.json())
  }, [])

  const fetchTrades = useCallback(async () => {
    const res = await fetch("/api/zites/trades?limit=25")
    if (res.ok) {
      const data = await res.json()
      setTrades(data.trades ?? [])
    }
  }, [])

  const fetchMyOrders = useCallback(async () => {
    if (!user) return
    const res = await fetch(`/api/zites/orders?user_id=${user.id}`)
    if (res.ok) {
      const data = await res.json()
      setMyOrders(data.orders ?? [])
    }
  }, [user])

  useEffect(() => {
    fetchStats()
    fetchBook()
    fetchTrades()
    fetchMyOrders()
  }, [fetchStats, fetchBook, fetchTrades, fetchMyOrders])

  useEffect(() => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const channel = supabase
      .channel("zites-trades-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "zites_trades" }, () => {
        fetchStats()
        fetchBook()
        fetchTrades()
        fetchMyOrders()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchStats, fetchBook, fetchTrades, fetchMyOrders])

  const refreshAll = () => { fetchStats(); fetchBook(); fetchTrades(); fetchMyOrders() }

  const handleSubmit = async () => {
    if (!user) return
    setMessage(null)
    const qty = Number(quantity)
    if (!qty || qty < 0.0001) {
      setMessage({ type: "error", text: "Enter a quantity of at least 0.0001 Zites" })
      return
    }
    if (orderType === "limit" && (!price || Number(price) <= 0)) {
      setMessage({ type: "error", text: "Enter a limit price greater than 0" })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/zites/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          side,
          order_type: orderType,
          price: orderType === "limit" ? Number(price) : undefined,
          quantity: qty,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Order failed" })
      } else {
        setMessage({ type: "success", text: data.filled > 0 ? `Filled ${formatZites(Number(data.filled))} Zites` : "Order placed" })
        setQuantity("")
        setPrice("")
        refreshAll()
        refreshUser?.()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async (id: string) => {
    if (!user) return
    await fetch(`/api/zites/orders/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id }),
    })
    fetchMyOrders()
    fetchBook()
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ZitesIcon size={22} /> OmegaZites Exchange
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Buy and sell Zites for $ on the live order book</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={refreshAll}>
          <RefreshCw size={13} /> Refresh
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Your Zites",
            value: user ? formatZites(Number(user.zites_balance)) : "—",
            icon: <ZitesIcon size={14} />,
          },
          {
            label: "Average Price",
            value: stats ? `$${Number(stats.average_price).toFixed(4)}` : "—",
          },
          {
            label: "Best Bid / Ask",
            value: stats ? `$${(stats.best_bid ?? 0).toFixed(4)} / $${(stats.best_ask ?? 0).toFixed(4)}` : "—",
          },
          {
            label: "24h Volume",
            value: stats ? `${formatZites(Number(stats.volume_24h))} Zites` : "—",
          },
        ].map(({ label, value, icon }) => (
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Order book */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-3">
          <Card className="bg-card/60">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-green-400">
                <TrendingUp size={14} /> Bids
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              {book.bids.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No open bids</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {book.bids.slice(0, 15).map((row) => (
                    <div key={row.price} className="flex justify-between text-xs px-2 py-0.5 rounded bg-green-500/5">
                      <span className="text-green-400 font-semibold">${row.price.toFixed(4)}</span>
                      <span className="text-muted-foreground">{formatZites(row.quantity)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/60">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-red-400">
                <TrendingDown size={14} /> Asks
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              {book.asks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No open asks</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {book.asks.slice(0, 15).map((row) => (
                    <div key={row.price} className="flex justify-between text-xs px-2 py-0.5 rounded bg-red-500/5">
                      <span className="text-red-400 font-semibold">${row.price.toFixed(4)}</span>
                      <span className="text-muted-foreground">{formatZites(row.quantity)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent trades */}
          <Card className="bg-card/60 col-span-2">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-bold">Recent Trades</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {trades.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No trades yet</p>
              ) : (
                <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                  {trades.map((t) => (
                    <div key={t.id} className="flex justify-between text-xs">
                      <span className="font-semibold">${Number(t.price).toFixed(4)}</span>
                      <span className="text-muted-foreground">{formatZites(Number(t.quantity))} Zites</span>
                      <span className="text-muted-foreground">{new Date(t.executed_at).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* My open orders */}
          {user && (
            <Card className="bg-card/60 col-span-2">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm font-bold">My Open Orders</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {myOrders.filter((o) => o.status === "open" || o.status === "partial").length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No open orders</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {myOrders.filter((o) => o.status === "open" || o.status === "partial").map((o) => (
                      <div key={o.id} className="flex items-center justify-between text-xs bg-muted/40 rounded-lg px-2.5 py-1.5">
                        <span className={`font-semibold ${o.side === "buy" ? "text-green-400" : "text-red-400"}`}>
                          {o.side.toUpperCase()} {o.order_type}
                        </span>
                        <span>{formatZites(o.remaining_quantity)} @ {o.price ? `$${o.price.toFixed(4)}` : "market"}</span>
                        <button onClick={() => handleCancel(o.id)} className="text-muted-foreground hover:text-destructive">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Order entry */}
        <div>
          <Card className="bg-card/60">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-bold">Place Order</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 flex flex-col gap-3">
              <ToggleGroup type="single" value={side} onValueChange={(v) => v && setSide(v as "buy" | "sell")} className="grid grid-cols-2">
                <ToggleGroupItem value="buy" className="text-xs font-bold data-[state=on]:bg-green-500/20 data-[state=on]:text-green-400">Buy</ToggleGroupItem>
                <ToggleGroupItem value="sell" className="text-xs font-bold data-[state=on]:bg-red-500/20 data-[state=on]:text-red-400">Sell</ToggleGroupItem>
              </ToggleGroup>

              <ToggleGroup type="single" value={orderType} onValueChange={(v) => v && setOrderType(v as "market" | "limit")} className="grid grid-cols-2">
                <ToggleGroupItem value="market" className="text-xs font-semibold">Market</ToggleGroupItem>
                <ToggleGroupItem value="limit" className="text-xs font-semibold">Limit</ToggleGroupItem>
              </ToggleGroup>

              {orderType === "limit" && (
                <div>
                  <Label className="text-xs mb-1 block">Limit price ($ per Zite)</Label>
                  <Input type="number" step="0.0001" min="0.0001" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.0000" />
                </div>
              )}

              <div>
                <Label className="text-xs mb-1 block">Quantity (Zites)</Label>
                <Input type="number" step="0.0001" min="0.0001" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0.0000" />
              </div>

              {message && (
                <Alert variant={message.type === "error" ? "destructive" : "default"} className="py-2">
                  <AlertDescription className="text-xs">{message.text}</AlertDescription>
                </Alert>
              )}

              <Separator />

              {user ? (
                <Button onClick={handleSubmit} disabled={submitting} className={side === "buy" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}>
                  {submitting ? "Placing…" : `${side === "buy" ? "Buy" : "Sell"} Zites`}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground text-center">Log in to trade Zites.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
