"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import NextLink from "next/link"
import { Filter, Plus, ArrowLeft, Clock, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@/lib/auth-context"
import type { Listing, Rarity, InventoryItem } from "@/lib/types"
import { RARITY_COLORS } from "@/lib/types"
import { useRouter } from "next/navigation"
import FilterPanel from "@/components/marketplace-filter-panel"

const RARITIES = ["Common", "Uncommon", "Rare", "Legendary", "Omega"]
const MAX_LISTING_PRICE = 800
const STORAGE_KEY = "omegacases_marketplace_filters"

const RARITY_PRICE_CAPS: Record<string, number> = {
  Common: 0.10,
  Uncommon: 0.50,
  Rare: 1.00,
  Legendary: 10.00,
  Omega: MAX_LISTING_PRICE,
}

function saveFilters(f: object) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(f))
}

export default function MarketplacePage() {
  const { user } = useAuth()
  const router = useRouter()

  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [totalListings, setTotalListings] = useState(0)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState("")
  const [rarities, setRarities] = useState<string[]>([])
  const [minPrice, setMinPrice] = useState<string>("")
  const [maxPrice, setMaxPrice] = useState<string>("")
  const [sellerSearch, setSellerSearch] = useState("")
  const [sortBy, setSortBy] = useState("price")
  const [ignoreOwn, setIgnoreOwn] = useState(false)
  const [showSold, setShowSold] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")
      if (saved) {
        if (saved.search !== undefined) setSearch(saved.search)
        if (Array.isArray(saved.rarities)) setRarities(saved.rarities)
        if (saved.minPrice !== undefined) setMinPrice(saved.minPrice)
        if (saved.maxPrice !== undefined) setMaxPrice(saved.maxPrice)
        if (saved.sellerSearch !== undefined) setSellerSearch(saved.sellerSearch)
        if (saved.sortBy) setSortBy(saved.sortBy)
        if (saved.ignoreOwn != null) setIgnoreOwn(saved.ignoreOwn)
        if (saved.showSold != null) setShowSold(saved.showSold)
      }
    } catch {}
    setHydrated(true)
  }, [])

  useEffect(() => {
    saveFilters({ search, rarities, minPrice, maxPrice, sellerSearch, sortBy, ignoreOwn, showSold })
  }, [search, rarities, minPrice, maxPrice, sellerSearch, sortBy, ignoreOwn, showSold])

  // Sell dialog
  const [sellOpen, setSellOpen] = useState(false)
  const [myInventory, setMyInventory] = useState<InventoryItem[]>([])
  const [myInventoryLoading, setMyInventoryLoading] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [sellItem, setSellItem] = useState<InventoryItem | null>(null)
  const [selectedCopies, setSelectedCopies] = useState<InventoryItem[]>([])
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkPriceRange, setBulkPriceRange] = useState<[number, number]>([0.01, 0.04])
  const [sellPrice, setSellPrice] = useState("")
  const [sellLoading, setSellLoading] = useState(false)
  const [sellError, setSellError] = useState("")
  const [sellSuccess, setSellSuccess] = useState(false)

  const fetchListings = useCallback(async (pageNum: number, replace: boolean) => {
    if (replace) setLoading(true)
    else setLoadingMore(true)
    const params = new URLSearchParams()
    if (rarities.length > 0) params.set("rarity", rarities.join(","))
    if (minPrice) params.set("minPrice", minPrice)
    if (maxPrice) params.set("maxPrice", maxPrice)
    if (search) params.set("search", search)
    if (sellerSearch) params.set("sellerSearch", sellerSearch)
    if (ignoreOwn && user?.id) params.set("excludeSeller", user.id)
    if (showSold) params.set("showSold", "true")
    params.set("sortBy", sortBy)
    params.set("page", String(pageNum))
    const res = await fetch(`/api/listings?${params}`)
    const data = await res.json()
    const newListings: Listing[] = Array.isArray(data.listings) ? data.listings : Array.isArray(data) ? data : []
    const total = data.total ?? newListings.length
    setTotalListings(total)
    setListings((prev) => replace ? newListings : [...prev, ...newListings])
    setHasMore(newListings.length === 24 && (pageNum + 1) * 24 < total)
    if (replace) setLoading(false)
    else setLoadingMore(false)
  }, [rarities, minPrice, maxPrice, sortBy, search, sellerSearch, ignoreOwn, showSold, user?.id])

  const prevFiltersRef = useRef({ rarities, minPrice, maxPrice, search, sellerSearch, sortBy, ignoreOwn, showSold })
  useEffect(() => {
    const prev = prevFiltersRef.current
    if (
      prev.search !== search || prev.rarities !== rarities || prev.minPrice !== minPrice ||
      prev.maxPrice !== maxPrice || prev.sellerSearch !== sellerSearch || prev.sortBy !== sortBy ||
      prev.ignoreOwn !== ignoreOwn || prev.showSold !== showSold
    ) {
      setPage(0)
      setHasMore(true)
      prevFiltersRef.current = { rarities, minPrice, maxPrice, search, sellerSearch, sortBy, ignoreOwn, showSold }
    }
  }, [rarities, minPrice, maxPrice, search, sellerSearch, sortBy, ignoreOwn, showSold])

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!hydrated) return
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => fetchListings(0, true), 300)
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [fetchListings, hydrated])

  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          const nextPage = page + 1
          setPage(nextPage)
          fetchListings(nextPage, false)
        }
      },
      { rootMargin: "200px" }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, page, fetchListings])

  const fetchMyInventory = async () => {
    if (!user) return
    setMyInventoryLoading(true)
    try {
      const allListingsRes = await fetch("/api/listings?limit=10000")
      const allListings: Listing[] = await allListingsRes.json()
      const listedInvIds = new Set(
        Array.isArray(allListings)
          ? allListings.filter((l) => l.seller_id === user.id).map((l) => l.inventory_id)
          : []
      )
      let allInv: InventoryItem[] = []
      let pg = 0
      while (true) {
        const res = await fetch(`/api/inventory/${user.id}?page=${pg}`)
        const data = await res.json()
        const batch: InventoryItem[] = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : []
        allInv = allInv.concat(batch)
        if (batch.length < 1000) break
        pg++
      }
      const available = allInv.filter((inv) => !listedInvIds.has(inv.id))
      setMyInventory(available)
      setSellItem((prev) => prev ? (available.find((i) => i.id === prev.id) ?? null) : null)
    } finally {
      setMyInventoryLoading(false)
    }
  }

  const openSellDialog = () => {
    setSellItem(null)
    setSellPrice("")
    setSellError("")
    setSellSuccess(false)
    setSelectedItemId(null)
    setSelectedCopies([])
    setBulkMode(false)
    fetchMyInventory()
    setSellOpen(true)
  }

  const handleSell = async () => {
    if (!user) return
    setSellLoading(true)
    setSellError("")
    try {
      if (bulkMode && selectedCopies.length > 1) {
        const [minP, maxP] = bulkPriceRange
        const results = await Promise.all(selectedCopies.map((inv) => {
          const randomPrice = Math.round((minP + Math.random() * (maxP - minP)) * 100) / 100
          return fetch("/api/listings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ seller_id: user.id, inventory_id: inv.id, item_id: inv.item_id, price: randomPrice }),
          })
        }))
        const failed = results.filter((r) => !r.ok).length
        if (failed > 0) throw new Error(`${failed} listing(s) failed`)
      } else {
        if (!sellItem || !sellPrice) return
        const price = parseFloat(sellPrice)
        const rarity = sellItem.items?.rarity ?? "Omega"
        const cap = RARITY_PRICE_CAPS[rarity] ?? MAX_LISTING_PRICE
        if (price > cap) { setSellError(`Max price for ${rarity} is $${cap.toFixed(2)}`); setSellLoading(false); return }
        if (price <= 0) { setSellError("Price must be greater than $0"); setSellLoading(false); return }
        const res = await fetch("/api/listings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seller_id: user.id, inventory_id: sellItem.id, item_id: sellItem.item_id, price }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
      }
      setSellSuccess(true)
      fetchListings(0, true)
    } catch (e: any) {
      setSellError(e.message)
    } finally {
      setSellLoading(false)
    }
  }

  // Group inventory by item_id
  const groupedInventory: { item_id: string; name: string; rarity: string; image_url: string; market_price: number; copies: InventoryItem[] }[] = []
  const seenItemIds = new Set<string>()
  for (const inv of myInventory) {
    if (!inv.item_id) continue
    if (!seenItemIds.has(inv.item_id)) {
      seenItemIds.add(inv.item_id)
      groupedInventory.push({
        item_id: inv.item_id,
        name: inv.items?.name ?? "",
        rarity: inv.items?.rarity ?? "Common",
        image_url: inv.items?.image_url ?? "",
        market_price: Number(inv.items?.market_price ?? 0),
        copies: myInventory.filter((i) => i.item_id === inv.item_id),
      })
    }
  }
  const selectedGroup = selectedItemId ? groupedInventory.find((g) => g.item_id === selectedItemId) : null

  const filterProps = {
    search, setSearch,
    rarities, setRarities,
    minPrice, setMinPrice,
    maxPrice, setMaxPrice,
    sellerSearch, setSellerSearch,
    sortBy, setSortBy,
    ignoreOwn, setIgnoreOwn,
    showSold, setShowSold,
    onApply: () => { setPage(0); setHasMore(true); fetchListings(0, true) },
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Marketplace</h1>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 md:hidden" onClick={() => setFilterOpen(true)}>
            <Filter size={15} /> Filter
          </Button>
          {user && (
            <Button className="gap-2" onClick={openSellDialog}>
              <Plus size={15} /> List Item
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-6 items-start">
        <div className="hidden md:block">
          {hydrated && <FilterPanel {...filterProps} />}
        </div>

        <div className="flex-1 relative min-h-[300px]">
          {!user && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 backdrop-blur-sm bg-background/60 rounded-xl min-h-[300px]">
              <p className="text-lg font-bold">Sign in to browse the Marketplace</p>
              <div className="flex gap-2">
                <Button asChild><NextLink href="/login">Log In</NextLink></Button>
                <Button variant="outline" asChild><NextLink href="/register">Register</NextLink></Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-muted-foreground" /></div>
          ) : listings.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">No listings found</div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {listings.map((listing) => {
                  const item = listing.items
                  if (!item) return null
                  const color = RARITY_COLORS[item.rarity as Rarity]
                  return (
                    <NextLink
                      key={listing.id}
                      href={`/listing/${listing.id}`}
                      className="border rounded-xl overflow-hidden hover:-translate-y-0.5 transition-all block"
                      style={{ borderColor: `${color}33` }}
                    >
                      <div className="relative">
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
                      </div>
                      <div className="p-2">
                        <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full text-white mb-1 inline-block" style={{ backgroundColor: color }}>{item.rarity}</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-xs font-semibold truncate text-foreground">{item.name}</p>
                            </TooltipTrigger>
                            <TooltipContent>{item.name}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <p className={`text-sm font-bold ${listing.status === "sold" ? "text-muted-foreground" : "text-primary"}`}>
                          ${Number(listing.price).toFixed(2)}
                          {listing.status === "sold" && <span className="ml-1 text-[0.55rem] font-bold bg-muted text-muted-foreground rounded px-1 py-0.5">SOLD</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">by {listing.users?.username || "—"}</p>
                      </div>
                    </NextLink>
                  )
                })}
              </div>

              <div ref={sentinelRef} className="h-10 flex items-center justify-center mt-4">
                {loadingMore && <Loader2 size={24} className="animate-spin text-muted-foreground" />}
                {!hasMore && listings.length > 0 && (
                  <p className="text-xs text-muted-foreground">All {totalListings} listings loaded</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="left" className="p-4 w-72">
          {hydrated && <FilterPanel {...filterProps} />}
        </SheetContent>
      </Sheet>

      {/* Sell dialog — two-step */}
      <Dialog open={sellOpen} onOpenChange={(v) => !v && setSellOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedItemId && !sellSuccess && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 h-7 px-2"
                  onClick={() => { setSelectedItemId(null); setSellItem(null); setSellPrice(""); setSelectedCopies([]); setBulkMode(false) }}
                >
                  <ArrowLeft size={14} /> Back
                </Button>
              )}
              {!selectedItemId ? "List Item for Sale" : selectedGroup ? `${selectedGroup.name} — Pick a Copy` : "List Item for Sale"}
            </DialogTitle>
          </DialogHeader>

          <div className="py-1">
            {sellSuccess ? (
              <Alert><AlertDescription className="text-green-600">Listed successfully!</AlertDescription></Alert>
            ) : myInventoryLoading ? (
              <div className="flex items-center gap-3 py-8 justify-center">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading your inventory…</p>
              </div>
            ) : myInventory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No items available to list.</p>
            ) : !selectedItemId ? (
              // Step 1: unique items
              <div className="flex flex-col divide-y divide-border">
                {groupedInventory.map((group) => {
                  const color = RARITY_COLORS[group.rarity as Rarity]
                  return (
                    <button
                      key={group.item_id}
                      onClick={() => setSelectedItemId(group.item_id)}
                      className="flex items-center gap-3 py-2.5 hover:bg-muted/50 rounded-lg px-1 transition-colors text-left"
                    >
                      <img
                        src={group.image_url}
                        alt={group.name}
                        className="w-11 h-11 object-contain rounded-lg border-2"
                        style={{ borderColor: `${color}44`, backgroundColor: "#f8fbff" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-semibold truncate">{group.name}</p>
                          <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: color }}>{group.rarity}</span>
                          {group.copies.length > 1 && (
                            <span className="text-[0.6rem] font-bold border border-border rounded-full px-1.5 py-0.5">x{group.copies.length}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">${group.market_price.toFixed(2)} market price</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              // Step 2: copies + price
              <div className="flex flex-col gap-3">
                {selectedGroup && selectedGroup.copies.length > 1 && (
                  <>
                    <p className="text-sm text-muted-foreground">You own <strong>{selectedGroup.copies.length}</strong> copies. Select which to list:</p>
                    <div className="flex flex-col divide-y divide-border">
                      {selectedGroup.copies.map((inv, idx) => {
                        const checked = selectedCopies.some((c) => c.id === inv.id)
                        return (
                          <label key={inv.id} className="flex items-center gap-3 py-2 cursor-pointer">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                setSelectedCopies((prev) =>
                                  v ? [...prev, inv] : prev.filter((c) => c.id !== inv.id)
                                )
                                if (v && selectedCopies.length === 0) setSellItem(inv)
                              }}
                            />
                            <div>
                              <p className="text-sm font-medium">Copy #{idx + 1}</p>
                              <p className="text-xs text-muted-foreground">ID: {inv.id.slice(0, 8)}…</p>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                    {selectedCopies.length > 0 && (
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <Checkbox
                          checked={bulkMode}
                          onCheckedChange={(v) => { setBulkMode(Boolean(v)); setSellItem(selectedCopies[0] ?? null) }}
                        />
                        Bulk list with random prices
                      </label>
                    )}
                    {bulkMode && selectedCopies.length > 1 && (() => {
                      const cap = RARITY_PRICE_CAPS[selectedGroup.rarity] ?? MAX_LISTING_PRICE
                      return (
                        <div className="flex flex-col gap-2">
                          <p className="text-xs text-muted-foreground">
                            Random price range: ${bulkPriceRange[0].toFixed(2)} – ${bulkPriceRange[1].toFixed(2)} (max ${cap.toFixed(2)} for {selectedGroup.rarity})
                          </p>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <Label className="text-xs">Min price</Label>
                              <Input
                                type="number"
                                value={bulkPriceRange[0]}
                                onChange={(e) => setBulkPriceRange([parseFloat(e.target.value) || 0.01, bulkPriceRange[1]])}
                                min={0.01} max={bulkPriceRange[1]} step={0.01}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="flex-1">
                              <Label className="text-xs">Max price</Label>
                              <Input
                                type="number"
                                value={bulkPriceRange[1]}
                                onChange={(e) => setBulkPriceRange([bulkPriceRange[0], parseFloat(e.target.value) || 0.01])}
                                min={bulkPriceRange[0]} max={cap} step={0.01}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">Will list <strong>{selectedCopies.length}</strong> copies at randomized prices in this range.</p>
                        </div>
                      )
                    })()}
                  </>
                )}
                {/* Auto-select single copy */}
                {selectedGroup && selectedGroup.copies.length === 1 && !sellItem && (() => {
                  const only = selectedGroup.copies[0]
                  if (!sellItem) { setSellItem(only); setSellPrice(String(selectedGroup.market_price)) }
                  return null
                })()}
                {/* Single price input */}
                {!bulkMode && (sellItem || selectedCopies.length === 1) && (() => {
                  const item = sellItem || selectedCopies[0]
                  if (!item) return null
                  if (!sellItem) setSellItem(item)
                  const rarity = item.items?.rarity ?? "Omega"
                  const cap = RARITY_PRICE_CAPS[rarity] ?? MAX_LISTING_PRICE
                  return (
                    <div className="flex flex-col gap-1.5">
                      <Label>Your Price (max ${cap.toFixed(2)} for {rarity})</Label>
                      <Input
                        type="number"
                        value={sellPrice}
                        onChange={(e) => setSellPrice(e.target.value)}
                        min={0.01} max={cap} step={0.01}
                        autoFocus
                      />
                    </div>
                  )
                })()}
                {sellError && <Alert variant="destructive"><AlertDescription>{sellError}</AlertDescription></Alert>}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSellOpen(false)}>Close</Button>
            {(sellItem || (bulkMode && selectedCopies.length > 1)) && !sellSuccess && (
              <Button onClick={handleSell} disabled={sellLoading || (!bulkMode && !sellPrice)}>
                {sellLoading
                  ? <><Loader2 size={14} className="animate-spin mr-1" />Listing...</>
                  : bulkMode && selectedCopies.length > 1
                  ? `Bulk List ${selectedCopies.length} Items`
                  : "List"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
