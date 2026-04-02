"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import NextLink from "next/link"
import dynamic from "next/dynamic"
import { Loader2, ArrowLeft, ShoppingCart, Clock } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@/lib/auth-context"
import { RARITY_COLORS } from "@/lib/types"
import type { Listing, Sale, Rarity } from "@/lib/types"

const SalesPriceChart = dynamic(() => import("@/components/sales-price-chart"), { ssr: false })

export default function ListingPage() {
  const { id } = useParams<{ id: string }>()
  const { user, refreshUser } = useAuth()

  const [listing, setListing] = useState<Listing & { supply_count?: number } | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const fetchListing = async () => {
      setLoading(true)
      const res = await fetch(`/api/listings?id=${id}`)
      const data = await res.json()
      const found = res.ok ? data : null
      setListing(found)
      if (found?.item_id) {
        const salesRes = await fetch(`/api/sales?item_id=${found.item_id}&limit=30`)
        const salesData = await salesRes.json()
        setSales(Array.isArray(salesData) ? salesData : [])
      }
      setLoading(false)
    }
    fetchListing()
  }, [id])

  const handleBuy = async () => {
    if (!listing || !user) return
    setBuying(true)
    setError("")
    try {
      const res = await fetch(`/api/listings/${listing.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyer_id: user.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess(true)
      await refreshUser()
      setListing((prev) => prev ? { ...prev, status: "sold" } : prev)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBuying(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-muted-foreground" /></div>

  if (!listing) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-4">
        <Alert variant="destructive"><AlertDescription>Listing not found.</AlertDescription></Alert>
        <Button variant="outline" className="gap-1.5 self-start" asChild>
          <NextLink href="/marketplace"><ArrowLeft size={14} /> Back to Marketplace</NextLink>
        </Button>
      </div>
    )
  }

  const item = listing.items
  const rarityColor = RARITY_COLORS[(item?.rarity as Rarity) || "Common"]
  const chartData = [...sales].reverse().map((s, i) => ({
    index: i + 1,
    price: Number(s.price),
    date: new Date(s.sold_at).toLocaleDateString(),
  }))

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Button variant="ghost" size="sm" className="gap-1.5 mb-4" asChild>
        <NextLink href="/marketplace"><ArrowLeft size={14} /> Back to Marketplace</NextLink>
      </Button>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_380px] gap-6">
        {/* Left: chart */}
        <Card className="p-6">
          <h2 className="text-lg font-bold mb-1">{item?.name} — Sale History</h2>
          <p className="text-sm text-muted-foreground mb-4">Last {sales.length} sales for this item</p>
          {chartData.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No sales history yet.</div>
          ) : (
            <SalesPriceChart data={chartData} color="var(--color-primary)" />
          )}
          {sales.length > 0 && (
            <div className="mt-4 flex gap-6 flex-wrap">
              {[
                { label: "Lowest Sale", value: `$${Math.min(...sales.map(s => Number(s.price))).toFixed(2)}` },
                { label: "Highest Sale", value: `$${Math.max(...sales.map(s => Number(s.price))).toFixed(2)}` },
                { label: "Avg Sale", value: `$${(sales.reduce((a, s) => a + Number(s.price), 0) / sales.length).toFixed(2)}` },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-bold">{value}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Right: listing card */}
        <Card className="p-6 flex flex-col gap-3" style={{ borderColor: rarityColor + "44", borderWidth: 2 }}>
          <div className="flex justify-center bg-muted rounded-xl p-4">
            <img src={item?.image_url} alt={item?.name} className="w-44 h-44 object-contain" />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: rarityColor }}>{item?.rarity}</span>
            {item?.limited_time && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1 bg-black/75 text-yellow-300 text-xs font-bold px-2 py-0.5 rounded-full">
                      <Clock size={10} /> Limited Time
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Limited time — not available in cases</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          <NextLink href={`/item/${encodeURIComponent(item?.name ?? "")}`} className="text-xl font-extrabold hover:underline hover:text-primary">
            {item?.name}
          </NextLink>

          <Separator />

          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active Supply</span>
              <span className="font-semibold">{listing.supply_count ?? 0} listing{listing.supply_count !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Listing Price</span>
              <span className="font-bold text-primary text-lg">${Number(listing.price).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Item RAP</span>
              <span className="font-semibold">${Number(item?.rap || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${listing.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                {listing.status}
              </span>
            </div>
          </div>

          <Separator />

          <div className="flex items-center gap-2">
            <Avatar className="w-7 h-7">
              {listing.users?.profile_picture && <AvatarImage src={listing.users.profile_picture} />}
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                {listing.users?.username?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">
              Listed by{" "}
              <NextLink href={`/user/${listing.users?.username}`} className="text-primary font-semibold hover:underline">
                {listing.users?.username}
              </NextLink>
            </span>
          </div>

          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {success && <Alert><AlertDescription className="text-green-600">Purchase successful! Check your inventory.</AlertDescription></Alert>}

          {listing.status === "active" && !success && (
            !user ? (
              <Button className="w-full" asChild><NextLink href="/login">Login to Buy</NextLink></Button>
            ) : user.id === listing.seller_id ? (
              <Button variant="outline" className="w-full" disabled>Your Listing</Button>
            ) : (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">Your balance: ${Number(user.balance).toFixed(2)}</p>
                <Button
                  className="w-full gap-2"
                  size="lg"
                  onClick={handleBuy}
                  disabled={buying || Number(user?.balance) < listing.price}
                >
                  {buying ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
                  {buying ? "Buying..." : `Buy for $${Number(listing.price).toFixed(2)}`}
                </Button>
                {Number(user?.balance) < listing.price && (
                  <p className="text-xs text-destructive text-center">Insufficient balance</p>
                )}
              </div>
            )
          )}
          {listing.status !== "active" && !success && (
            <Button variant="outline" className="w-full" disabled>
              {listing.status === "sold" ? "Sold" : "Unavailable"}
            </Button>
          )}
        </Card>
      </div>
    </div>
  )
}
