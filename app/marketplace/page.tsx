"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Container, Grid, Box, Typography, Card, CardContent, CardMedia,
  Chip, Slider, TextField, Select, MenuItem, FormControl, InputLabel,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, Drawer, List, ListItemButton, ListItemAvatar,
  Avatar, ListItemText, Divider, Checkbox, FormControlLabel,
} from "@mui/material"
import FilterListIcon from "@mui/icons-material/FilterList"
import AddIcon from "@mui/icons-material/Add"
import ArrowBackIcon from "@mui/icons-material/ArrowBack"
import { useAuth } from "@/lib/auth-context"
import type { Listing, Rarity, InventoryItem } from "@/lib/types"
import { RARITY_COLORS } from "@/lib/types"
import NextLink from "next/link"
import { useRouter } from "next/navigation"

const RARITIES = ["Common", "Uncommon", "Rare", "Legendary", "Omega"]
const MAX_LISTING_PRICE = 800
const STORAGE_KEY = "omegacases_marketplace_filters"

const RARITY_PRICE_CAPS: Record<string, number> = {
  Common: 0.04,
  Uncommon: 0.10,
  Rare: 0.40,
  Legendary: 2.00,
  Omega: MAX_LISTING_PRICE,
}

// --- Persist helpers ---
function loadFilters() {
  if (typeof window === "undefined") return null
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") } catch { return null }
}
function saveFilters(f: object) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(f))
}

// Stable top-level component — never re-created between parent renders
function FilterPanel({
  search, setSearch, rarity, setRarity, priceRange, setPriceRange, sortBy, setSortBy,
  ignoreOwn, setIgnoreOwn, showSold, setShowSold, onApply,
}: {
  search: string; setSearch: (v: string) => void
  rarity: string; setRarity: (v: string) => void
  priceRange: [number, number]; setPriceRange: (v: [number, number]) => void
  sortBy: string; setSortBy: (v: string) => void
  ignoreOwn: boolean; setIgnoreOwn: (v: boolean) => void
  showSold: boolean; setShowSold: (v: boolean) => void
  onApply: () => void
}) {
  return (
    <Box sx={{ width: { xs: "100%", md: 240 }, flexShrink: 0 }}>
      <Card sx={{ p: 2, position: { md: "sticky" }, top: { md: 80 } }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>Filters</Typography>
        <TextField label="Search" value={search} onChange={(e) => setSearch(e.target.value)}
          fullWidth size="small" sx={{ mb: 2 }} autoComplete="off" />
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Rarity</InputLabel>
          <Select value={rarity} onChange={(e) => setRarity(e.target.value)} label="Rarity">
            <MenuItem value="">All</MenuItem>
            {RARITIES.map((r) => (
              <MenuItem key={r} value={r}>
                <Chip label={r} size="small" sx={{ bgcolor: RARITY_COLORS[r as Rarity], color: "#fff", mr: 1 }} />{r}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary">Price: ${priceRange[0]} – ${priceRange[1]}</Typography>
        <Slider value={priceRange} onChange={(_, v) => setPriceRange(v as [number, number])}
          min={0} max={800} step={1} sx={{ mt: 1, mb: 2 }} />
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Sort by</InputLabel>
          <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} label="Sort by">
            <MenuItem value="created_at">Newest</MenuItem>
            <MenuItem value="price">Price</MenuItem>
          </Select>
        </FormControl>
        <FormControlLabel
          control={<Checkbox checked={ignoreOwn} onChange={(e) => setIgnoreOwn(e.target.checked)} size="small" />}
          label={<Typography variant="body2">Ignore Your Listings</Typography>}
          sx={{ mb: 0.5, display: "block" }}
        />
        <FormControlLabel
          control={<Checkbox checked={showSold} onChange={(e) => setShowSold(e.target.checked)} size="small" />}
          label={<Typography variant="body2">Show Sold Items</Typography>}
          sx={{ mb: 1.5, display: "block" }}
        />
        <Button variant="outlined" fullWidth onClick={onApply}>Apply</Button>
      </Card>
    </Box>
  )
}

export default function MarketplacePage() {
  const { user } = useAuth()
  const router = useRouter()
  const saved = loadFilters()

  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(saved?.search ?? "")
  const [rarity, setRarity] = useState(saved?.rarity ?? "")
  const [priceRange, setPriceRange] = useState<[number, number]>(saved?.priceRange ?? [0, 800])
  const [sortBy, setSortBy] = useState(saved?.sortBy ?? "created_at")
  const [ignoreOwn, setIgnoreOwn] = useState(saved?.ignoreOwn ?? false)
  const [showSold, setShowSold] = useState(saved?.showSold ?? false)
  const [filterOpen, setFilterOpen] = useState(false)

  // Persist filters on any change
  useEffect(() => {
    saveFilters({ search, rarity, priceRange, sortBy, ignoreOwn, showSold })
  }, [search, rarity, priceRange, sortBy, ignoreOwn, showSold])

  // Sell dialog
  const [sellOpen, setSellOpen] = useState(false)
  const [myInventory, setMyInventory] = useState<InventoryItem[]>([])
  // Step 1: show unique items; Step 2: show copies of selected unique item
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [sellItem, setSellItem] = useState<InventoryItem | null>(null)
  const [selectedCopies, setSelectedCopies] = useState<InventoryItem[]>([])
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkPriceRange, setBulkPriceRange] = useState<[number, number]>([0.01, 0.04])
  const [sellPrice, setSellPrice] = useState("")
  const [sellLoading, setSellLoading] = useState(false)
  const [sellError, setSellError] = useState("")
  const [sellSuccess, setSellSuccess] = useState(false)

  const fetchListings = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (rarity) params.set("rarity", rarity)
    if (priceRange[0] > 0) params.set("minPrice", String(priceRange[0]))
    if (priceRange[1] < 800) params.set("maxPrice", String(priceRange[1]))
    if (search) params.set("search", search)
    if (ignoreOwn && user?.id) params.set("excludeSeller", user.id)
    if (showSold) params.set("showSold", "true")
    params.set("sortBy", sortBy)
    const res = await fetch(`/api/listings?${params}`)
    const data = await res.json()
    setListings(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [rarity, priceRange, sortBy, search, ignoreOwn, showSold, user?.id])

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(fetchListings, 300)
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [fetchListings])

  const fetchMyInventory = async () => {
    if (!user) return
    const allListingsRes = await fetch("/api/listings")
    const allListings: Listing[] = await allListingsRes.json()
    const listedInvIds = new Set(
      Array.isArray(allListings)
        ? allListings.filter((l) => l.seller_id === user.id).map((l) => l.inventory_id)
        : []
    )
    const invRes = await fetch(`/api/inventory/${user.id}`)
    const data: InventoryItem[] = await invRes.json()
    const available = Array.isArray(data) ? data.filter((inv) => !listedInvIds.has(inv.id)) : []
    setMyInventory(available)
    setSellItem((prev) => prev ? (available.find((i) => i.id === prev.id) ?? null) : null)
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
        // Bulk list: random price in range for each copy
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
      fetchListings()
    } catch (e: any) {
      setSellError(e.message)
    } finally {
      setSellLoading(false)
    }
  }

  // Group inventory by item_id for the two-step picker
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
    search, setSearch, rarity, setRarity, priceRange, setPriceRange,
    sortBy, setSortBy, ignoreOwn, setIgnoreOwn, showSold, setShowSold,
    onApply: fetchListings,
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Marketplace</Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button startIcon={<FilterListIcon />} variant="outlined" onClick={() => setFilterOpen(true)} sx={{ display: { md: "none" } }}>
            Filter
          </Button>
          {user && (
            <Button startIcon={<AddIcon />} variant="contained" onClick={openSellDialog}>List Item</Button>
          )}
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
        <Box sx={{ display: { xs: "none", md: "block" } }}>
          <FilterPanel {...filterProps} />
        </Box>
        <Box sx={{ flex: 1 }}>
          {loading ? (
            <Box textAlign="center" py={8}><CircularProgress /></Box>
          ) : listings.length === 0 ? (
            <Box textAlign="center" py={8}><Typography color="text.secondary">No listings found</Typography></Box>
          ) : (
            <Grid container spacing={2}>
              {listings.map((listing) => {
                const item = listing.items
                if (!item) return null
                const color = RARITY_COLORS[item.rarity as Rarity]
                return (
                  <Grid item key={listing.id} xs={6} sm={4} md={3} lg={2}>
                    <Card
                      component={NextLink}
                      href={`/listing/${listing.id}`}
                      sx={{
                        cursor: "pointer", textDecoration: "none", display: "block",
                        border: `1px solid ${color}33`,
                        "&:hover": { boxShadow: `0 4px 20px ${color}44`, transform: "translateY(-2px)", transition: "all 0.15s" },
                      }}
                    >
                      <CardMedia component="img" image={item.image_url} alt={item.name}
                        sx={{ height: 120, objectFit: "contain", p: 1, bgcolor: "#f8fbff" }} />
                      <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
                        <Chip label={item.rarity} size="small" sx={{ bgcolor: color, color: "#fff", mb: 0.5, fontSize: "0.6rem" }} />
                        <Typography variant="caption" display="block" fontWeight={600}
                          sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "text.primary" }}>
                          {item.name}
                        </Typography>
                        <Typography variant="body2" fontWeight={700} color={listing.status === "sold" ? "text.disabled" : "primary.main"}>
                          ${Number(listing.price).toFixed(2)}
                          {listing.status === "sold" && <Chip label="SOLD" size="small" sx={{ ml: 0.5, fontSize: "0.55rem", height: 16 }} color="default" />}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          by {listing.users?.username || "—"}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )
              })}
            </Grid>
          )}
        </Box>
      </Box>

      {/* Mobile filter drawer */}
      <Drawer anchor="left" open={filterOpen} onClose={() => setFilterOpen(false)}>
        <Box sx={{ p: 2, width: 280 }}><FilterPanel {...filterProps} /></Box>
      </Drawer>

      {/* Sell dialog — two-step */}
      <Dialog open={sellOpen} onClose={() => setSellOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {selectedItemId && !sellSuccess && (
            <Button size="small" startIcon={<ArrowBackIcon />}
              onClick={() => { setSelectedItemId(null); setSellItem(null); setSellPrice(""); setSelectedCopies([]); setBulkMode(false) }}
              sx={{ mr: 1 }}>
              Back
            </Button>
          )}
          {!selectedItemId ? "List Item for Sale" : selectedGroup ? `${selectedGroup.name} — Pick a Copy` : "List Item for Sale"}
        </DialogTitle>
        <DialogContent>
          {sellSuccess ? (
            <Alert severity="success" sx={{ mt: 1 }}>Listed successfully!</Alert>
          ) : myInventory.length === 0 ? (
            <Typography color="text.secondary" sx={{ mt: 1 }}>No items available to list.</Typography>
          ) : !selectedItemId ? (
            // Step 1: unique items
            <List dense disablePadding>
              {groupedInventory.map((group, idx) => {
                const color = RARITY_COLORS[group.rarity as Rarity]
                return (
                  <Box key={group.item_id}>
                    {idx > 0 && <Divider />}
                    <ListItemButton onClick={() => setSelectedItemId(group.item_id)} sx={{ borderRadius: 1 }}>
                      <ListItemAvatar>
                        <Avatar src={group.image_url} alt={group.name} variant="rounded"
                          sx={{ width: 44, height: 44, bgcolor: "#f8fbff", border: `2px solid ${color}44` }} />
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="body2" fontWeight={600}>{group.name}</Typography>
                            <Chip label={group.rarity} size="small" sx={{ bgcolor: color, color: "#fff", fontSize: "0.6rem" }} />
                            {group.copies.length > 1 && (
                              <Chip label={`x${group.copies.length}`} size="small" variant="outlined" sx={{ fontSize: "0.6rem" }} />
                            )}
                          </Box>
                        }
                        secondary={`$${group.market_price.toFixed(2)} market price`}
                      />
                    </ListItemButton>
                  </Box>
                )
              })}
            </List>
          ) : (
            // Step 2: copies + price input
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
              {selectedGroup && selectedGroup.copies.length > 1 && (
                <>
                  <Typography variant="body2" color="text.secondary">
                    You own <strong>{selectedGroup.copies.length}</strong> copies. Select which to list:
                  </Typography>
                  <List dense disablePadding>
                    {selectedGroup.copies.map((inv, idx) => {
                      const checked = selectedCopies.some((c) => c.id === inv.id)
                      return (
                        <Box key={inv.id}>
                          {idx > 0 && <Divider />}
                          <ListItemButton
                            onClick={() => {
                              setSelectedCopies((prev) =>
                                checked ? prev.filter((c) => c.id !== inv.id) : [...prev, inv]
                              )
                              if (!checked && selectedCopies.length === 0) setSellItem(inv)
                            }}
                            sx={{ borderRadius: 1 }}
                          >
                            <Checkbox checked={checked} size="small" sx={{ mr: 1, p: 0 }} />
                            <ListItemText primary={`Copy #${idx + 1}`} secondary={`ID: ${inv.id.slice(0, 8)}…`} />
                          </ListItemButton>
                        </Box>
                      )
                    })}
                  </List>
                  {selectedCopies.length > 0 && (
                    <FormControlLabel
                      control={<Checkbox checked={bulkMode} onChange={(e) => { setBulkMode(e.target.checked); setSellItem(selectedCopies[0] ?? null) }} size="small" />}
                      label={<Typography variant="body2">Bulk list with random prices</Typography>}
                    />
                  )}
                  {bulkMode && selectedCopies.length > 1 && (() => {
                    const rarity = selectedGroup.rarity
                    const cap = RARITY_PRICE_CAPS[rarity] ?? MAX_LISTING_PRICE
                    return (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Random price range: ${bulkPriceRange[0].toFixed(2)} – ${bulkPriceRange[1].toFixed(2)} (max ${cap.toFixed(2)} for {rarity})
                        </Typography>
                        <Slider
                          value={bulkPriceRange}
                          onChange={(_, v) => setBulkPriceRange(v as [number, number])}
                          min={0.01} max={cap} step={0.01}
                          sx={{ mt: 1 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          Will list <strong>{selectedCopies.length}</strong> copies at randomized prices in this range.
                        </Typography>
                      </Box>
                    )
                  })()}
                </>
              )}
              {/* Auto-select if only one copy */}
              {selectedGroup && selectedGroup.copies.length === 1 && !sellItem && (() => {
                const only = selectedGroup.copies[0]
                if (!sellItem) { setSellItem(only); setSellPrice(String(selectedGroup.market_price)) }
                return null
              })()}
              {/* Single item price input */}
              {!bulkMode && (sellItem || (selectedCopies.length === 1)) && (() => {
                const item = sellItem || selectedCopies[0]
                if (!item) return null
                if (!sellItem) setSellItem(item)
                const rarity = item.items?.rarity ?? "Omega"
                const cap = RARITY_PRICE_CAPS[rarity] ?? MAX_LISTING_PRICE
                return (
                  <TextField
                    label={`Your Price (USD, max $${cap.toFixed(2)} for ${rarity})`}
                    type="number"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    inputProps={{ min: 0.01, max: cap, step: 0.01 }}
                    fullWidth
                    autoFocus
                  />
                )
              })()}
              {sellError && <Alert severity="error">{sellError}</Alert>}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSellOpen(false)}>Close</Button>
          {(sellItem || (bulkMode && selectedCopies.length > 1)) && !sellSuccess && (
            <Button
              variant="contained"
              onClick={handleSell}
              disabled={sellLoading || (!bulkMode && !sellPrice)}
            >
              {sellLoading
                ? "Listing..."
                : bulkMode && selectedCopies.length > 1
                  ? `Bulk List ${selectedCopies.length} Items`
                  : "List"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  )
}
