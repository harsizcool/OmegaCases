"use client"

import { useEffect, useState } from "react"
import NextLink from "next/link"
import {
  Container, Box, Typography, Button, Grid, Card, CardContent,
  CardMedia, Chip, CircularProgress, Divider, Stack,
} from "@mui/material"
import LockIcon from "@mui/icons-material/Lock"
import InventoryIcon from "@mui/icons-material/Inventory"
import StorefrontIcon from "@mui/icons-material/Storefront"
import { useAuth } from "@/lib/auth-context"
import type { Item, Rarity, Listing } from "@/lib/types"
import { RARITY_COLORS, RARITY_GLOW } from "@/lib/types"

export default function HomePage() {
  const { user } = useAuth()
  const [items, setItems] = useState<Item[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/items").then((r) => r.json()),
      fetch("/api/listings?sortBy=created_at").then((r) => r.json()),
    ]).then(([itemData, listingData]) => {
      setItems(Array.isArray(itemData) ? itemData.slice(0, 8) : [])
      setListings(Array.isArray(listingData) ? listingData.slice(0, 6) : [])
      setLoading(false)
    })
  }, [])

  return (
    <Box>
      {/* Hero */}
      <Box
        sx={{
          background: "linear-gradient(135deg, #e3f2fd 0%, #ffffff 100%)",
          borderBottom: "1px solid #e3f2fd",
          py: { xs: 6, md: 10 },
          textAlign: "center",
          px: 2,
        }}
      >
        <Box
          component="img"
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/omegacrate_logo-tJzRwAfwpZAQEkJOSjQGI93l5hRU06.png"
          alt="OmegaCases"
          sx={{ width: { xs: 80, md: 120 }, height: { xs: 80, md: 120 }, mb: 2 }}
        />
        <Typography variant="h3" fontWeight={800} sx={{ mb: 1, fontSize: { xs: "2rem", md: "3rem" } }}>
          OmegaCases
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 4, maxWidth: 500, mx: "auto" }}>
          Open cases, win rare items, trade on the marketplace.
        </Typography>

        {user ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
            <Button
              variant="contained"
              size="large"
              component={NextLink}
              href="/open"
              startIcon={<InventoryIcon />}
              sx={{ px: 4, py: 1.5, fontSize: "1rem" }}
            >
              Open Cases
            </Button>
            <Button
              variant="outlined"
              size="large"
              component={NextLink}
              href="/marketplace"
              startIcon={<StorefrontIcon />}
              sx={{ px: 4, py: 1.5, fontSize: "1rem" }}
            >
              Marketplace
            </Button>
          </Stack>
        ) : (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
            <Button
              variant="contained"
              size="large"
              component={NextLink}
              href="/login"
              startIcon={<LockIcon />}
              sx={{ px: 4, py: 1.5, fontSize: "1rem" }}
            >
              Login to Play
            </Button>
            <Button
              variant="outlined"
              size="large"
              component={NextLink}
              href="/register"
              sx={{ px: 4, py: 1.5, fontSize: "1rem" }}
            >
              Create Account
            </Button>
          </Stack>
        )}
      </Box>

      <Container maxWidth="xl" sx={{ py: 6 }}>
        {/* Featured items */}
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Featured Items
        </Typography>
        <Divider sx={{ mb: 3 }} />
        {loading ? (
          <Box textAlign="center" py={4}><CircularProgress /></Box>
        ) : (
          <Grid container spacing={2} sx={{ mb: 6 }}>
            {items.map((item) => {
              const color = RARITY_COLORS[item.rarity as Rarity]
              const glow = RARITY_GLOW[item.rarity as Rarity]
              return (
                <Grid item key={item.id} xs={6} sm={4} md={3} lg={2}>
                  <Card
                    sx={{
                      border: `2px solid ${color}44`,
                      boxShadow: glow,
                      "&:hover": { transform: "translateY(-3px)", transition: "0.15s" },
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
                        sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {item.name}
                      </Typography>
                      <Typography variant="caption" color="primary.main" fontWeight={700}>
                        ${Number(item.market_price).toFixed(2)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        )}

        {/* Marketplace preview */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="h5" fontWeight={700}>Marketplace</Typography>
          <Button component={NextLink} href="/marketplace" variant="outlined" size="small">
            View All
          </Button>
        </Box>
        <Divider sx={{ mb: 3 }} />
        {!user && (
          <Box
            sx={{
              position: "relative",
              "&::after": {
                content: '""',
                position: "absolute",
                inset: 0,
                backdropFilter: "blur(4px)",
                bgcolor: "rgba(255,255,255,0.7)",
                zIndex: 2,
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              },
            }}
          >
            <Grid container spacing={2} sx={{ opacity: 0.4, pointerEvents: "none" }}>
              {(loading ? Array(6).fill(null) : listings).map((listing, i) => (
                <Grid item key={i} xs={6} sm={4} md={2}>
                  <Card sx={{ height: 180 }}>
                    {listing && listing.items && (
                      <>
                        <CardMedia
                          component="img"
                          image={listing.items.image_url}
                          alt={listing.items.name}
                          sx={{ height: 120, objectFit: "contain", p: 1, bgcolor: "#f8fbff" }}
                        />
                        <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
                          <Typography variant="caption" fontWeight={700}>${Number(listing.price).toFixed(2)}</Typography>
                        </CardContent>
                      </>
                    )}
                  </Card>
                </Grid>
              ))}
            </Grid>
            <Box
              sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%,-50%)",
                zIndex: 3,
                textAlign: "center",
              }}
            >
              <LockIcon sx={{ fontSize: 48, color: "primary.main", mb: 1 }} />
              <Typography variant="h6" fontWeight={700}>Login to browse the marketplace</Typography>
              <Button variant="contained" component={NextLink} href="/login" sx={{ mt: 2 }}>
                Login
              </Button>
            </Box>
          </Box>
        )}
        {user && (
          <Grid container spacing={2}>
            {listings.map((listing) => {
              if (!listing?.items) return null
              const color = RARITY_COLORS[listing.items.rarity as Rarity]
              return (
                <Grid item key={listing.id} xs={6} sm={4} md={2}>
                  <Card
                    component={NextLink}
                    href="/marketplace"
                    sx={{
                      textDecoration: "none",
                      border: `1px solid ${color}33`,
                      "&:hover": { boxShadow: `0 4px 16px ${color}44`, transform: "translateY(-2px)", transition: "0.15s" },
                    }}
                  >
                    <CardMedia
                      component="img"
                      image={listing.items.image_url}
                      alt={listing.items.name}
                      sx={{ height: 120, objectFit: "contain", p: 1, bgcolor: "#f8fbff" }}
                    />
                    <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
                      <Chip label={listing.items.rarity} size="small" sx={{ bgcolor: color, color: "#fff", mb: 0.5, fontSize: "0.6rem" }} />
                      <Typography variant="caption" display="block" fontWeight={600}
                        sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {listing.items.name}
                      </Typography>
                      <Typography variant="caption" color="primary.main" fontWeight={700}>
                        ${Number(listing.price).toFixed(2)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        )}
      </Container>
    </Box>
  )
}
