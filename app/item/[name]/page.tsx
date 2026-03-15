"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import dynamic from "next/dynamic"
import {
  Container, Box, Typography, Chip, CircularProgress, Alert,
  Grid, Card, Avatar, Button, Paper,
} from "@mui/material"
import type { Rarity } from "@/lib/types"
import { RARITY_COLORS } from "@/lib/types"
import NextLink from "next/link"
import StorefrontIcon from "@mui/icons-material/Storefront"
import PeopleIcon from "@mui/icons-material/People"
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents"

// Single dynamic import — avoids Turbopack multi-chunk split errors
const SalesPriceChart = dynamic(() => import("@/components/sales-price-chart"), { ssr: false })

const RARITY_ODDS: Record<string, string> = {
  Common: "1 in 2",
  Uncommon: "1 in 5",
  Rare: "1 in 20",
  Legendary: "1 in 100",
  Omega: "1 in 1,000+",
}

const BLUE = "#1976d2"

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

  if (loading) return <Box display="flex" justifyContent="center" py={10}><CircularProgress /></Box>
  if (error || !data) return <Container><Alert severity="error" sx={{ mt: 4 }}>{error || "Not found"}</Alert></Container>

  const { item, circulation, owners, listings, sales } = data
  const rarityColor = RARITY_COLORS[item.rarity as Rarity] || "#888"
  const salesMin = sales.length ? Math.min(...sales.map((s: any) => s.price)) : 0
  const salesMax = sales.length ? Math.max(...sales.map((s: any) => s.price)) : 0
  const salesAvg = sales.length ? (sales.reduce((s: number, x: any) => s + Number(x.price), 0) / sales.length) : 0

  const tabs = [
    { label: "Overview", icon: null },
    { label: "Listings", icon: <StorefrontIcon fontSize="small" /> },
    { label: "Owners", icon: <PeopleIcon fontSize="small" /> },
  ]

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: "flex", gap: 4, alignItems: "flex-start", flexWrap: "wrap", mb: 4 }}>
        <Box
          component="img"
          src={item.image_url}
          alt={item.name}
          sx={{
            width: { xs: 120, sm: 180 }, height: { xs: 120, sm: 180 },
            objectFit: "contain", borderRadius: 3,
            border: `3px solid ${BLUE}33`, bgcolor: "#f0f7ff", p: 1,
          }}
        />
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
            <Typography variant="h4" fontWeight={800} color="text.primary">{item.name}</Typography>
            {/* Only the rarity tag keeps its rarity color */}
            <Chip label={item.rarity} sx={{ bgcolor: rarityColor, color: "#fff", fontWeight: 700 }} />
          </Box>
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            RAP: <strong style={{ color: BLUE }}>${Number(item.rap).toFixed(2)}</strong>
            &nbsp;&middot;&nbsp;
            In Circulation: <strong>{circulation}</strong>
            &nbsp;&middot;&nbsp;
            Odds: <strong>{RARITY_ODDS[item.rarity] ?? "Unknown"}</strong>
          </Typography>
          {item.first_unboxer && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
              <EmojiEventsIcon sx={{ fontSize: 16, color: "#f59e0b" }} />
              <Typography variant="body2" color="text.secondary">
                First Discovered by{" "}
                <NextLink
                  href={`/user/${item.first_unboxer.username}`}
                  style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}
                >
                  {item.first_unboxer.username}
                </NextLink>
              </Typography>
            </Box>
          )}
          <Button
            variant="contained"
            component={NextLink}
            href={`/marketplace`}
            startIcon={<StorefrontIcon />}
            size="small"
            sx={{ mt: 1 }}
          >
            View on Marketplace
          </Button>
        </Box>
      </Box>

      {/* Tab selector */}
      <Box sx={{ display: "flex", gap: 1, mb: 3, flexWrap: "wrap" }}>
        {tabs.map(({ label }, i) => (
          <Chip
            key={label}
            label={label}
            onClick={() => setTab(i)}
            variant={tab === i ? "filled" : "outlined"}
            sx={{
              cursor: "pointer", fontWeight: 600,
              bgcolor: tab === i ? BLUE : undefined,
              color: tab === i ? "#fff" : BLUE,
              borderColor: BLUE,
            }}
          />
        ))}
      </Box>

      {/* Tab 0: Overview = Stats + Chart combined */}
      {tab === 0 && (
        <Box>
          {/* Stats grid */}
          <Grid container spacing={2} sx={{ mb: 4 }}>
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
              <Grid item xs={6} sm={4} md={3} key={label}>
                <Paper sx={{ p: 2, borderRadius: 2, border: `1px solid ${BLUE}22` }}>
                  <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                  <Typography variant="h6" fontWeight={700} color={label === "Rarity" ? rarityColor : BLUE}>{value}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          {/* Sales chart */}
          {sales.length > 0 ? (
            <Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, color: BLUE }}>
                Recent Sales (last {sales.length})
              </Typography>
              <SalesPriceChart
                data={sales.map((s: any, i: number) => ({
                  date: `#${i + 1}`,
                  price: Number(s.price),
                }))}
                color={BLUE}
              />
            </Box>
          ) : (
            <Typography color="text.secondary">No sales recorded yet.</Typography>
          )}
        </Box>
      )}

      {/* Tab 1: Active Listings */}
      {tab === 1 && (
        <Box>
          {listings.length === 0 ? (
            <Typography color="text.secondary">No active listings for this item.</Typography>
          ) : (
            <Grid container spacing={2}>
              {listings.map((l: any) => (
                <Grid item xs={12} sm={6} md={4} key={l.id}>
                  <Card sx={{ display: "flex", alignItems: "center", gap: 2, p: 2, border: `1px solid ${BLUE}22` }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight={700} color="primary.main">${Number(l.price).toFixed(2)}</Typography>
                      <Typography variant="caption" color="text.secondary">by {l.users?.username || "—"}</Typography>
                    </Box>
                    <Button variant="contained" size="small" component={NextLink} href={`/listing/${l.id}`}>
                      Buy
                    </Button>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* Tab 2: Owners */}
      {tab === 2 && (
        <Box>
          {owners.length === 0 ? (
            <Typography color="text.secondary">Nobody owns this item yet.</Typography>
          ) : (
            <Grid container spacing={2}>
              {owners.map(({ user: u, count }: any) => (
                <Grid item xs={12} sm={6} md={4} key={u?.id || Math.random()}>
                  <Card
                    component={NextLink}
                    href={`/user/${u?.username}`}
                    sx={{
                      display: "flex", alignItems: "center", gap: 2, p: 2,
                      textDecoration: "none", border: `1px solid ${BLUE}22`,
                      "&:hover": { boxShadow: 3 },
                    }}
                  >
                    <Avatar src={u?.profile_picture} sx={{ bgcolor: BLUE }}>
                      {u?.username?.[0]?.toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography fontWeight={700}>{u?.username}</Typography>
                      <Typography variant="caption" color="text.secondary">Owns {count}x</Typography>
                    </Box>
                    <Chip label={`x${count}`} size="small" sx={{ ml: "auto", bgcolor: BLUE, color: "#fff" }} />
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}
    </Container>
  )
}
