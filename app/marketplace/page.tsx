"use client"

import { useState, useEffect } from "react"
import {
  Container, Grid, Box, Typography, Card, CardContent, CardMedia,
  Chip, Slider, TextField, Select, MenuItem, FormControl, InputLabel,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, Divider, Avatar, IconButton, Tooltip,
  useMediaQuery, useTheme, Drawer,
} from "@mui/material"
import FilterListIcon from "@mui/icons-material/FilterList"
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart"
import AddIcon from "@mui/icons-material/Add"
import { LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer } from "recharts"
import { useAuth } from "@/lib/auth-context"
import type { Listing, Rarity, Sale, InventoryItem } from "@/lib/types"
import { RARITY_COLORS } from "@/lib/types"
import NextLink from "next/link"

const RARITIES = ["Common", "Uncommon", "Rare", "Legendary", "Omega"]

export default function MarketplacePage() {
  const { user, refreshUser } = useAuth()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("md"))

  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [rarity, setRarity] = useState("")
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500])
  const [sortBy, setSortBy] = useState("created_at")
  const [filterOpen, setFilterOpen] = useState(false)

  // Buy dialog
  const [buyTarget, setBuyTarget] = useState<Listing | null>(null)
  const [buyLoading, setBuyLoading] = useState(false)
  const [buyError, setBuyError] = useState("")
  const [buySuccess, setBuySuccess] = useState(false)

  // Sell dialog
  const [sellOpen, setSellOpen] = useState(false)
  const [myInventory, setMyInventory] = useState<InventoryItem[]>([])
  const [sellItem, setSellItem] = useState<InventoryItem | null>(null)
  const [sellPrice, setSellPrice] = useState("")
  const [sellLoading, setSellLoading] = useState(false)
  const [sellError, setSellError] = useState("")
  const [sellSuccess, setSellSuccess] = useState(false)

  // Price chart
  const [chartItem, setChartItem] = useState<string | null>(null)
  const [chartData, setChartData] = useState<Sale[]>([])

  const fetchListings = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (rarity) params.set("rarity", rarity)
    if (priceRange[0] > 0) params.set("minPrice", String(priceRange[0]))
    if (priceRange[1] < 500) params.set("maxPrice", String(priceRange[1]))
    if (search) params.set("search", search)
    params.set("sortBy", sortBy)
    const res = await fetch(`/api/listings?${params}`)
    const data = await res.json()
    setListings(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { fetchListings() }, [rarity, priceRange, sortBy])
  useEffect(() => {
    const t = setTimeout(fetchListings, 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchChart = async (itemId: string) => {
    const res = await fetch(`/api/sales?item_id=${itemId}`)
    const data = await res.json()
    setChartData(data)
    setChartItem(itemId)
  }

  const fetchMyInventory = async () => {
    if (!user) return
    const res = await fetch(`/api/listings`)
    const allListings: Listing[] = await res.json()
    const listedInvIds = new Set(allListings.filter((l) => l.seller_id === user.id).map((l) => l.inventory_id))

    const invRes = await fetch(`/api/inventory/${user.id}`)
    const data: InventoryItem[] = await invRes.json()
    setMyInventory(data.filter((inv) => !listedInvIds.has(inv.id)))
  }

  const handleBuy = async () => {
    if (!buyTarget || !user) return
    setBuyLoading(true)
    setBuyError("")
    try {
      const res = await fetch(`/api/listings/${buyTarget.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyer_id: user.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setBuySuccess(true)
      fetchListings()
      await refreshUser()
    } catch (e: any) {
      setBuyError(e.message)
    } finally {
      setBuyLoading(false)
    }
  }

  const handleSell = async () => {
    if (!sellItem || !sellPrice || !user) return
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
          price: parseFloat(sellPrice),
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

  const FilterPanel = () => (
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
        />
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Rarity</InputLabel>
          <Select value={rarity} onChange={(e) => setRarity(e.target.value)} label="Rarity">
            <MenuItem value="">All</MenuItem>
            {RARITIES.map((r) => (
              <MenuItem key={r} value={r}>
                <Chip
                  label={r}
                  size="small"
                  sx={{ bgcolor: RARITY_COLORS[r as Rarity], color: "#fff", mr: 1 }}
                />
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
          max={500}
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
        <Button variant="outlined" fullWidth onClick={fetchListings}>
          Apply
        </Button>
      </Card>
    </Box>
  )

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>
          Marketplace
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          {isMobile && (
            <Button startIcon={<FilterListIcon />} variant="outlined" onClick={() => setFilterOpen(true)}>
              Filter
            </Button>
          )}
          {user && (
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={() => { fetchMyInventory(); setSellOpen(true); setSellSuccess(false) }}
            >
              List Item
            </Button>
          )}
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
        {!isMobile && <FilterPanel />}

        {/* Listings grid */}
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
                      sx={{
                        cursor: "pointer",
                        border: `1px solid ${color}33`,
                        "&:hover": { boxShadow: `0 4px 20px ${color}44`, transform: "translateY(-2px)", transition: "all 0.15s" },
                      }}
                      onClick={() => fetchChart(listing.item_id)}
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
                          sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          {item.name}
                        </Typography>
                        <Typography variant="body2" fontWeight={700} color="primary.main">
                          ${Number(listing.price).toFixed(2)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          by {listing.users?.username || "—"}
                        </Typography>
                        {user && listing.seller_id !== user.id && (
                          <Button
                            variant="contained"
                            size="small"
                            fullWidth
                            startIcon={<ShoppingCartIcon fontSize="small" />}
                            sx={{ mt: 0.5, fontSize: "0.7rem" }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setBuyTarget(listing)
                              setBuyError("")
                              setBuySuccess(false)
                            }}
                          >
                            Buy
                          </Button>
                        )}
                        {!user && (
                          <Button
                            variant="outlined"
                            size="small"
                            fullWidth
                            component={NextLink}
                            href="/login"
                            sx={{ mt: 0.5, fontSize: "0.7rem" }}
                          >
                            Login to buy
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                )
              })}
            </Grid>
          )}

          {/* Price chart */}
          {chartItem && chartData.length > 0 && (
            <Card sx={{ mt: 3, p: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Recent Sale Prices
              </Typography>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={[...chartData].reverse()}>
                  <XAxis
                    dataKey="sold_at"
                    tickFormatter={(v) => new Date(v).toLocaleDateString()}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                  <RTooltip
                    formatter={(v: any) => [`$${Number(v).toFixed(2)}`, "Price"]}
                    labelFormatter={(l) => new Date(l).toLocaleString()}
                  />
                  <Line type="monotone" dataKey="price" stroke="#1976d2" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}
        </Box>
      </Box>

      {/* Mobile filter drawer */}
      <Drawer anchor="left" open={filterOpen} onClose={() => setFilterOpen(false)}>
        <Box sx={{ p: 2, width: 280 }}>
          <FilterPanel />
        </Box>
      </Drawer>

      {/* Buy dialog */}
      <Dialog open={Boolean(buyTarget)} onClose={() => setBuyTarget(null)}>
        <DialogTitle>Confirm Purchase</DialogTitle>
        <DialogContent>
          {buyTarget && (
            <Box>
              <Typography gutterBottom>
                Buy <strong>{buyTarget.items?.name}</strong> for{" "}
                <strong>${Number(buyTarget.price).toFixed(2)}</strong>?
              </Typography>
              {user && (
                <Typography variant="body2" color="text.secondary">
                  Your balance: ${Number(user.balance).toFixed(2)}
                </Typography>
              )}
              {buyError && <Alert severity="error" sx={{ mt: 1 }}>{buyError}</Alert>}
              {buySuccess && <Alert severity="success" sx={{ mt: 1 }}>Purchased!</Alert>}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBuyTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleBuy}
            disabled={buyLoading || buySuccess}
            startIcon={buyLoading ? <CircularProgress size={14} /> : null}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sell dialog */}
      <Dialog open={sellOpen} onClose={() => setSellOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>List Item for Sale</DialogTitle>
        <DialogContent>
          {myInventory.length === 0 ? (
            <Typography color="text.secondary">No items available to list.</Typography>
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
                      {inv.items?.name} (
                      <Chip
                        label={inv.items?.rarity}
                        size="small"
                        sx={{
                          bgcolor: RARITY_COLORS[(inv.items?.rarity as Rarity) || "Common"],
                          color: "#fff",
                          ml: 0.5,
                          fontSize: "0.6rem",
                        }}
                      />
                      ) — ${Number(inv.items?.market_price || 0).toFixed(2)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Your Price (USD)"
                type="number"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                inputProps={{ min: 0.01, step: 0.01 }}
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
            disabled={sellLoading || !sellItem || !sellPrice}
            startIcon={sellLoading ? <CircularProgress size={14} /> : null}
          >
            List
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
