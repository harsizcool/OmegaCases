"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import NextLink from "next/link"
import dynamic from "next/dynamic"
import {
  Container, Box, Typography, Button, Card, CardMedia, CardContent,
  Chip, CircularProgress, Alert, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Divider, Tooltip, Grid, Avatar,
} from "@mui/material"
import { useAuth } from "@/lib/auth-context"
import { RARITY_COLORS } from "@/lib/types"
import type { Listing, Sale, Rarity } from "@/lib/types"
import ArrowBackIcon from "@mui/icons-material/ArrowBack"
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart"

// Single dynamic import for the whole chart — avoids Turbopack multi-chunk split errors
const SalesPriceChart = dynamic(() => import("@/components/sales-price-chart"), { ssr: false })

export default function ListingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
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

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 6, textAlign: "center" }}>
        <CircularProgress />
      </Container>
    )
  }

  if (!listing) {
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Alert severity="error">Listing not found.</Alert>
        <Button startIcon={<ArrowBackIcon />} component={NextLink} href="/marketplace" sx={{ mt: 2 }}>
          Back to Marketplace
        </Button>
      </Container>
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
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Button startIcon={<ArrowBackIcon />} component={NextLink} href="/marketplace" sx={{ mb: 2 }}>
        Back to Marketplace
      </Button>

      <Grid container spacing={3}>
        {/* Left: chart */}
        <Grid item xs={12} md={7}>
          <Card sx={{ p: 3, height: "100%" }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              {item?.name} — Sale History
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Last {sales.length} sales for this item
            </Typography>

            {chartData.length === 0 ? (
              <Box sx={{ py: 6, textAlign: "center" }}>
                <Typography color="text.secondary">No sales history yet.</Typography>
              </Box>
            ) : (
              <SalesPriceChart data={chartData} color="#1976d2" />
            )}

            {sales.length > 0 && (
              <Box sx={{ mt: 2, display: "flex", gap: 3, flexWrap: "wrap" }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Lowest Sale</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    ${Math.min(...sales.map((s) => Number(s.price))).toFixed(2)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Highest Sale</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    ${Math.max(...sales.map((s) => Number(s.price))).toFixed(2)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Avg Sale</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    ${(sales.reduce((a, s) => a + Number(s.price), 0) / sales.length).toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            )}
          </Card>
        </Grid>

        {/* Right: listing card */}
        <Grid item xs={12} md={5}>
          <Card sx={{ p: 3, border: `2px solid ${rarityColor}33` }}>
            <Box sx={{ display: "flex", justifyContent: "center", mb: 2, bgcolor: "#f8fbff", borderRadius: 2, p: 2 }}>
              <Box
                component="img"
                src={item?.image_url}
                alt={item?.name}
                sx={{ width: 180, height: 180, objectFit: "contain" }}
              />
            </Box>

            <Chip
              label={item?.rarity}
              size="small"
              sx={{ bgcolor: rarityColor, color: "#fff", mb: 1 }}
            />
            <Typography
              variant="h5"
              fontWeight={800}
              gutterBottom
              component={NextLink}
              href={`/item/${encodeURIComponent(item?.name ?? "")}`}
              sx={{ color: "text.primary", textDecoration: "none", "&:hover": { textDecoration: "underline", color: "primary.main" } }}
            >
              {item?.name}
            </Typography>

            <Divider sx={{ my: 1.5 }} />

            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography color="text.secondary">Active Supply</Typography>
              <Typography fontWeight={600}>
                {listing.supply_count ?? 0} listing{listing.supply_count !== 1 ? "s" : ""}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography color="text.secondary">Listing Price</Typography>
              <Typography fontWeight={700} color="primary.main" variant="h6">
                ${Number(listing.price).toFixed(2)}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography color="text.secondary">Item RAP</Typography>
              <Typography fontWeight={600}>${Number(item?.rap || 0).toFixed(2)}</Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
              <Typography color="text.secondary">Status</Typography>
              <Chip
                label={listing.status}
                size="small"
                color={listing.status === "active" ? "success" : "default"}
              />
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <Avatar
                src={listing.users?.profile_picture || undefined}
                sx={{ width: 28, height: 28, bgcolor: "primary.main", fontSize: 13 }}
              >
                {listing.users?.username?.[0]?.toUpperCase()}
              </Avatar>
              <Typography variant="body2" color="text.secondary">
                Listed by{" "}
                <Box
                  component={NextLink}
                  href={`/user/${listing.users?.username}`}
                  sx={{ color: "primary.main", fontWeight: 600, textDecoration: "none" }}
                >
                  {listing.users?.username}
                </Box>
              </Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 1 }}>Purchase successful! Check your inventory.</Alert>}

            {listing.status === "active" && !success && (
              <>
                {!user ? (
                  <Button variant="contained" fullWidth component={NextLink} href="/login">
                    Login to Buy
                  </Button>
                ) : user.id === listing.seller_id ? (
                  <Button variant="outlined" fullWidth disabled>
                    Your Listing
                  </Button>
                ) : (
                  <Box>
                    {user && (
                      <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                        Your balance: ${Number(user.balance).toFixed(2)}
                      </Typography>
                    )}
                    <Button
                      variant="contained"
                      fullWidth
                      size="large"
                      startIcon={<ShoppingCartIcon />}
                      onClick={handleBuy}
                      disabled={buying || Number(user?.balance) < listing.price}
                    >
                      {buying ? "Buying..." : `Buy for $${Number(listing.price).toFixed(2)}`}
                    </Button>
                    {Number(user?.balance) < listing.price && (
                      <Typography variant="caption" color="error" display="block" mt={0.5} textAlign="center">
                        Insufficient balance
                      </Typography>
                    )}
                  </Box>
                )}
              </>
            )}
            {listing.status !== "active" && !success && (
              <Button variant="outlined" fullWidth disabled>
                {listing.status === "sold" ? "Sold" : "Unavailable"}
              </Button>
            )}
          </Card>
        </Grid>
      </Grid>
    </Container>
  )
}
