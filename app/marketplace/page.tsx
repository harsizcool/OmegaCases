"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Container, Grid, Box, Typography, Card, CardContent, CardMedia,
  Chip, Slider, TextField, Select, MenuItem, FormControl, InputLabel,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, Avatar, Drawer,
} from "@mui/material"
import FilterListIcon from "@mui/icons-material/FilterList"
import AddIcon from "@mui/icons-material/Add"
import OpenInNewIcon from "@mui/icons-material/OpenInNew"
import { useAuth } from "@/lib/auth-context"
import type { Listing, Rarity, InventoryItem } from "@/lib/types"
import { RARITY_COLORS } from "@/lib/types"
import NextLink from "next/link"
import { useRouter } from "next/navigation"

const RARITIES = ["Common", "Uncommon", "Rare", "Legendary", "Omega"]
const MAX_LISTING_PRICE = 800

// Extracted as a stable top-level component to prevent remounting on parent re-render
function FilterPanel({
  search, setSearch, rarity, setRarity, priceRange, setPriceRange, sortBy, setSortBy, onApply,
}: {
  search: string
  setSearch: (v: string) => void
  rarity: string
  setRarity: (v: string) => void
  priceRange: [number, number]
  setPriceRange: (v: [number, number]) => void
  sortBy: string
  setSortBy: (v: string) => void
  onApply: () => void
}) {
  return (
    <Box sx={{ width: { xs: "100%", md: 240 }, flexShrink: 0 }}>
      <Card sx={{ p: 2, position: { md: "sticky" }, top: { md: 80 } }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Filters
        </Typography>
        <TextField
          label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
          autoComplete="off"
        />
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Rarity</InputLabel>
          <Select value={rarity} onChange={(e) => setRarity(e.target.value)} label="Rarity">
            <MenuItem value="">All</MenuItem>
            {RARITIES.map((r) => (
              <MenuItem key={r} value={r}>
                <Chip label={r} size="small" sx={{ bgcolor: RARITY_COLORS[r as Rarity], color: "#fff", mr: 1 }} />
                {r}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary">
          Price range: ${priceRange[0]} – ${priceRange[1]}
        </Typography>
        <Slider
          value={priceRange}
          onChange={(_, v) => setPriceRange(v as [number, number])}
          min={0}
          max={800}
          step={1}
          sx={{ mt: 1, mb: 2 }}
        />
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Sort by</InputLabel>
          <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} label="Sort by">
            <MenuItem value="created_at">Newest</MenuItem>
            <MenuItem value="price">Price</MenuItem>
          </Select>
        </FormControl>
        <Button variant="outlined" fullWidth onClick={onApply}>
          Apply
        </Button>
      </Card>
    </Box>
  )
}

export default function MarketplacePage() {
  const { user, refreshUser } = useAuth()
  const router = useRouter()

  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [rarity, setRarity] = useState("")
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 800])
  const [sortBy, setSortBy] = useState("created_at")
  const [filterOpen, setFilterOpen] = useState(false)

  // Sell dialog
  const [sellOpen, setSellOpen] = useState(false)
  const [myInventory, setMyInventory] = useState<InventoryItem[]>([])
  const [sellItem, setSellItem] = useState<InventoryItem | null>(null)
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
    params.set("sortBy", sortBy)
    const res = await fetch(`/api/listings?${params}`)
    const data = await res.json()
    setListings(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [rarity, priceRange, sortBy, search])

  // Debounce on search; instant on filter changes
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
    // Re-sync sellItem in case the array reference changed; clear if no longer available
    setSellItem((prev) => {
      if (!prev) return null
      return available.find((i) => i.id === prev.id) ?? null
    })
  }

  const handleSell = async () => {
    if (!sellItem || !sellPrice || !user) return
    const price = parseFloat(sellPrice)
    if (price > MAX_LISTING_PRICE) {
      setSellError(`Max listing price is $${MAX_LISTING_PRICE}`)
      return
    }
    setSellLoading(true)
    setSellError("")
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seller_id: user.id,
          inventory_id: sellItem.id,
          item_id: sellItem.item_id,
          price,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSellSuccess(true)
      fetchListings()
    } catch (e: any) {
      setSellError(e.message)
    } finally {
      setSellLoading(false)
    }
  }

  const filterProps = {
    search, setSearch,
    rarity, setRarity,
    priceRange, setPriceRange,
    sortBy, setSortBy,
    onApply: fetchListings,
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Marketplace</Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            startIcon={<FilterListIcon />}
            variant="outlined"
            onClick={() => setFilterOpen(true)}
            sx={{ display: { md: "none" } }}
          >
            Filter
          </Button>
          {user && (
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={() => { setSellItem(null); setSellPrice(""); fetchMyInventory(); setSellOpen(true); setSellSuccess(false) }}
            >
              List Item
            </Button>
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
            <Box textAlign="center" py={8}>
              <Typography color="text.secondary">No listings found</Typography>
            </Box>
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
                        cursor: "pointer",
                        textDecoration: "none",
                        display: "block",
                        border: `1px solid ${color}33`,
                        "&:hover": { boxShadow: `0 4px 20px ${color}44`, transform: "translateY(-2px)", transition: "all 0.15s" },
                      }}
                    >
                      <CardMedia
                        component="img"
                        image={item.image_url}
                        alt={item.name}
                        sx={{ height: 120, objectFit: "contain", p: 1, bgcolor: "#f8fbff" }}
                      />
                      <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
                        <Chip
                          label={item.rarity}
                          size="small"
                          sx={{ bgcolor: color, color: "#fff", mb: 0.5, fontSize: "0.6rem" }}
                        />
                        <Typography
                          variant="caption"
                          display="block"
                          fontWeight={600}
                          sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "text.primary" }}
                        >
                          {item.name}
                        </Typography>
                        <Typography variant="body2" fontWeight={700} color="primary.main">
                          ${Number(listing.price).toFixed(2)}
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
        <Box sx={{ p: 2, width: 280 }}>
          <FilterPanel {...filterProps} />
        </Box>
      </Drawer>

      {/* Sell dialog */}
      <Dialog open={sellOpen} onClose={() => setSellOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>List Item for Sale</DialogTitle>
        <DialogContent>
          {myInventory.length === 0 ? (
            <Typography color="text.secondary" sx={{ mt: 1 }}>No items available to list.</Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
              <FormControl fullWidth>
                <InputLabel>Select Item</InputLabel>
                <Select
                  value={sellItem?.id || ""}
                  onChange={(e) => {
                    const found = myInventory.find((i) => i.id === e.target.value)
                    setSellItem(found || null)
                    setSellPrice(found ? String(Number(found.items?.market_price || 0)) : "")
                  }}
                  label="Select Item"
                >
                  {myInventory.map((inv) => (
                    <MenuItem key={inv.id} value={inv.id}>
                      {inv.items?.name} —{" "}
                      <Chip
                        label={inv.items?.rarity}
                        size="small"
                        sx={{ bgcolor: RARITY_COLORS[(inv.items?.rarity as Rarity) || "Common"], color: "#fff", ml: 0.5, fontSize: "0.6rem" }}
                      />
                      {" "}— ${Number(inv.items?.market_price || 0).toFixed(2)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label={`Your Price (USD, max $${MAX_LISTING_PRICE})`}
                type="number"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                inputProps={{ min: 0.01, max: MAX_LISTING_PRICE, step: 0.01 }}
                fullWidth
              />
              {sellError && <Alert severity="error">{sellError}</Alert>}
              {sellSuccess && <Alert severity="success">Listed successfully!</Alert>}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSellOpen(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={handleSell}
            disabled={sellLoading || !sellItem || !sellPrice || sellSuccess}
          >
            {sellLoading ? "Listing..." : "List"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
