"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { Loader2, Clock } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@/lib/auth-context"
import type { InventoryItem, Rarity } from "@/lib/types"
import { RARITY_COLORS, VALUE_RARITIES } from "@/lib/types"
import NextLink from "next/link"
import PlusBadge from "@/components/plus-badge"

type SortMode = "rap" | "latest"

interface BundledItem {
  item_id: string
  name: string
  image_url: string
  rarity: Rarity
  rap: number
  market_price: number
  count: number
  inventoryId: string
}

export default function UserPage() {
  const params = useParams()
  const username = params.username as string
  const { user: me } = useAuth()

  const [profile, setProfile] = useState<any>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [sortMode, setSortMode] = useState<SortMode>("rap")
  const [bundle, setBundle] = useState(true)

  const [listTarget, setListTarget] = useState<{ inventoryId: string; item: { name: string; market_price: number } } | null>(null)
  const [listPrice, setListPrice] = useState("")
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState("")
  const [listSuccess, setListSuccess] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const profileRes = await fetch(`/api/users/${username}`)
      if (!profileRes.ok) { setError("User not found"); setLoading(false); return }
      const profileData = await profileRes.json()
      setProfile(profileData)
      const invRes = await fetch(`/api/inventory/${profileData.id}?page=${page}`)
      const invData = await invRes.json()
      setInventory(Array.isArray(invData.items) ? invData.items : [])
      setTotalItems(invData.total ?? 0)
      setLoading(false)
    }
    load()
  }, [username, page])

  const rapValue = inventory
    .filter((inv) => VALUE_RARITIES.includes(inv.items?.rarity as Rarity))
    .reduce((sum, inv) => sum + Number(inv.items?.rap || 0), 0)
  const isMe = me?.username === username

  const bundledItems = useMemo<BundledItem[]>(() => {
    const map = new Map<string, BundledItem>()
    const sorted = [...inventory].sort((a, b) => new Date(a.obtained_at).getTime() - new Date(b.obtained_at).getTime())
    for (const inv of sorted) {
      const item = inv.items
      if (!item) continue
      if (map.has(inv.item_id)) {
        map.get(inv.item_id)!.count++
      } else {
        map.set(inv.item_id, { item_id: inv.item_id, name: item.name, image_url: item.image_url, rarity: item.rarity as Rarity, rap: Number(item.rap), market_price: Number(item.market_price), count: 1, inventoryId: inv.id })
      }
    }
    return Array.from(map.values())
  }, [inventory])

  const sortedInventory = useMemo(() => [...inventory].sort((a, b) => sortMode === "rap" ? Number(b.items?.rap || 0) - Number(a.items?.rap || 0) : new Date(b.obtained_at).getTime() - new Date(a.obtained_at).getTime()), [inventory, sortMode])
  const sortedBundled = useMemo(() => [...bundledItems].sort((a, b) => sortMode === "rap" ? b.rap - a.rap : b.rap - a.rap), [bundledItems, sortMode])

  const openListDialog = (inventoryId: string, item: { name: string; market_price: number }) => {
    setListTarget({ inventoryId, item })
    setListPrice(String(item.market_price))
    setListError("")
    setListSuccess(false)
  }

  const handleList = async () => {
    if (!listTarget || !listPrice || !me) return
    setListLoading(true)
    setListError("")
    try {
      const invRow = inventory.find((inv) => inv.id === listTarget.inventoryId)
      if (!invRow) throw new Error("Item not found in inventory")
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seller_id: me.id, inventory_id: invRow.id, item_id: invRow.item_id, price: parseFloat(listPrice) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setListSuccess(true)
    } catch (e: any) { setListError(e.message) }
    finally { setListLoading(false) }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-muted-foreground" /></div>
  if (error) return <div className="max-w-2xl mx-auto px-4 py-6"><Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert></div>

  const totalPages = Math.ceil(totalItems / 1000)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Profile header */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <Avatar className="w-20 h-20">
          {profile?.profile_picture && <AvatarImage src={profile.profile_picture} />}
          <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-bold">
            {profile?.username?.[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold">{profile?.username}</h1>
            {profile?.plus && <PlusBadge size={22} />}
          </div>
          <p className="text-muted-foreground">
            Inventory Value (RAP): <strong className="text-primary">${rapValue.toFixed(2)}</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            {totalItems} item{totalItems !== 1 ? "s" : ""}
            {bundle && bundledItems.length !== inventory.length && <> · {bundledItems.length} unique this page</>}
            {profile?.cases > 0 && <> · <strong>{Number(profile.cases).toLocaleString()}</strong> cases opened</>}
          </p>
        </div>
        {isMe && (
          <Button variant="outline" asChild><NextLink href="/open">Open Cases</NextLink></Button>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rap">Sort by RAP</SelectItem>
            <SelectItem value="latest">Sort by Latest</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
          <Checkbox checked={bundle} onCheckedChange={(v) => setBundle(Boolean(v))} />
          Bundle Similar Items
        </label>
      </div>

      {inventory.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No items in inventory</p>
      ) : bundle ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {sortedBundled.map((b) => {
            const color = RARITY_COLORS[b.rarity]
            return (
              <div key={b.item_id} className="relative">
                {b.count > 1 && (
                  <span className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground text-[0.6rem] font-bold rounded-full px-1.5 py-0.5">x{b.count}</span>
                )}
                <div className="border rounded-xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all" style={{ borderColor: color + "44" }}>
                  <NextLink href={`/item/${encodeURIComponent(b.name)}`} className="block">
                    <img src={b.image_url} alt={b.name} className="w-full h-[110px] object-contain p-2 bg-muted" />
                    <div className="p-2">
                      <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full text-white mb-1 inline-block" style={{ backgroundColor: color }}>{b.rarity}</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-xs font-semibold truncate">{b.name}</p>
                          </TooltipTrigger>
                          <TooltipContent>{b.name}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <p className="text-xs font-bold text-primary">RAP: ${b.rap.toFixed(2)}</p>
                    </div>
                  </NextLink>
                  {isMe && (
                    <div className="px-2 pb-2">
                      <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => openListDialog(b.inventoryId, { name: b.name, market_price: b.market_price })}>Sell</Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {sortedInventory.map((inv) => {
            const item = inv.items
            if (!item) return null
            const color = RARITY_COLORS[item.rarity as Rarity]
            return (
              <div key={inv.id} className="border rounded-xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all" style={{ borderColor: color + "44" }}>
                <NextLink href={`/item/${encodeURIComponent(item.name)}`} className="block relative">
                  <img src={item.image_url} alt={item.name} className="w-full h-[110px] object-contain p-2 bg-muted" />
                  {item.limited_time && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="absolute top-1.5 right-1.5 bg-black/60 rounded-full w-5 h-5 flex items-center justify-center">
                            <Clock size={11} className="text-yellow-300" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>Limited time — not available in cases</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <div className="p-2">
                    <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full text-white mb-1 inline-block" style={{ backgroundColor: color }}>{item.rarity}</span>
                    <p className="text-xs font-semibold truncate">{item.name}</p>
                    <p className="text-xs font-bold text-primary">RAP: ${Number(item.rap).toFixed(2)}</p>
                  </div>
                </NextLink>
                {isMe && (
                  <div className="px-2 pb-2">
                    <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => openListDialog(inv.id, { name: item.name, market_price: Number(item.market_price) })}>Sell</Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(0)}>«</Button>
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</Button>
          <span className="text-sm text-muted-foreground px-2">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>›</Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»</Button>
        </div>
      )}

      {/* List item dialog */}
      <Dialog open={Boolean(listTarget)} onOpenChange={(v) => !v && setListTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>List "{listTarget?.item?.name}"</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Your Price (USD)</Label>
              <Input type="number" min={0.01} step={0.01} value={listPrice} onChange={(e) => setListPrice(e.target.value)} />
            </div>
            {listError && <Alert variant="destructive"><AlertDescription>{listError}</AlertDescription></Alert>}
            {listSuccess && <Alert><AlertDescription className="text-green-600">Listed on marketplace!</AlertDescription></Alert>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setListTarget(null)}>Cancel</Button>
            <Button onClick={handleList} disabled={listLoading || listSuccess}>
              {listLoading ? "Listing..." : "List"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
