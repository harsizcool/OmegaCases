"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  Container, Box, Typography, Chip, CircularProgress, Alert,
  Grid, Card, CardContent, Avatar, Divider, Button, Paper,
} from "@mui/material"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import type { Rarity } from "@/lib/types"
import { RARITY_COLORS } from "@/lib/types"
import NextLink from "next/link"
import StorefrontIcon from "@mui/icons-material/Storefront"
import PeopleIcon from "@mui/icons-material/People"
import BarChartIcon from "@mui/icons-material/BarChart"
import InfoIcon from "@mui/icons-material/Info"

const RARITY_ODDS: Record<string, string> = {
  Common: "1 in 2",
  Uncommon: "1 in 5",
  Rare: "1 in 20",
  Legendary: "1 in 100",
  Omega: "1 in 1,000+",
}

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
  const color = RARITY_COLORS[item.rarity as Rarity] || "#888"
  const salesMin = sales.length ? Math.min(...sales.map((s: any) => s.price)) : 0
  const salesMax = sales.length ? Math.max(...sales.map((s: any) => s.price)) : 0
  const salesAvg = sales.length ? (sales.reduce((s: number, x: any) => s + Number(x.price), 0) / sales.length) : 0

  const tabs = ["Stats", "Sales Chart", "Listings", "Owners"]

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
            border: `3px solid ${color}55`, bgcolor: "#f8fbff", p: 1,
          }}
        />
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
            <Typography variant="h4" fontWeight={800}>{item.name}</Typography>
            <Chip label={item.rarity} sx={{ bgcolor: color, color: "#fff", fontWeight: 700 }} />
          </Box>
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            RAP: <strong style={{ color }}>${Number(item.rap).toFixed(2)}</strong>
            &nbsp;&middot;&nbsp;
            In Circulation: <strong>{circulation}</strong>
            &nbsp;&middot;&nbsp;
            Odds: <strong>{RARITY_ODDS[item.rarity] ?? "Unknown"}</strong>
          </Typography>
          {item.first_unboxer && (
            <Typography variant="body2" color="text.secondary">
              First Found By{" "}
              <NextLink href={`/user/${item.first_unboxer.username}`}
                style={{ color, fontWeight: 700, textDecoration: "none" }}>
                {item.first_unboxer.username}
              </NextLink>
            </Typography>
          )}
          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              component={NextLink}
              href={`/search?query=${encodeURIComponent(item.name)}`}
              startIcon={<StorefrontIcon />}
              size="small"
            >
              View Listings
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Tab selector */}
      <Box sx={{ display: "flex", gap: 1, mb: 3, flexWrap: "wrap" }}>
        {[
          { label: "Stats", icon: <InfoIcon fontSize="small" /> },
          { label: "Sales Chart", icon: <BarChartIcon fontSize="small" /> },
          { label: "Active Listings", icon: <StorefrontIcon fontSize="small" /> },
          { label: "Owners", icon: <PeopleIcon fontSize="small" /> },
        ].map(({ label, icon }, i) => (
          <Chip
            key={label}
            label={label}
            icon={icon}
            onClick={() => setTab(i)}
            variant={tab === i ? "filled" : "outlined"}
            sx={{
              cursor: "pointer", fontWeight: 600,
              bgcolor: tab === i ? color : undefined,
              color: tab === i ? "#fff" : color,
              borderColor: color,
            }}
          />
        ))}
      </Box>

      {/* Tab content */}
      {tab === 0 && (
        <Grid container spacing={2}>
          {[
            { label: "Item Name", value: item.name },
            { label: "Rarity", value: item.rarity },
            { label: "RAP", value: `$${Number(item.rap).toFixed(2)}` },
            { label: "Market Price", value: `$${Number(item.market_price).toFixed(2)}` },
            { label: "Total in Circulation", value: circulation },
            { label: "Active Listings", value: listings.length },
            { label: "Total Sales", value: sales.length },
            { label: "Odds", value: RARITY_ODDS[item.rarity] ?? "—" },
          ].map(({ label, value }) => (
            <Grid item xs={6} sm={4} md={3} key={label}>
              <Paper sx={{ p: 2, borderRadius: 2, border: `1px solid ${color}22` }}>
                <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                <Typography variant="h6" fontWeight={700} sx={{ color }}>{value}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {tab === 1 && (
        <Box>
          {sales.length === 0 ? (
            <Typography color="text.secondary">No sales recorded yet.</Typography>
          ) : (
            <>
              <Box sx={{ display: "flex", gap: 3, mb: 2, flexWrap: "wrap" }}>
                <Typography variant="body2">Min: <strong>${salesMin.toFixed(2)}</strong></Typography>
                <Typography variant="body2">Max: <strong>${salesMax.toFixed(2)}</strong></Typography>
                <Typography variant="body2">Avg: <strong>${salesAvg.toFixed(2)}</strong></Typography>
              </Box>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={sales.map((s: any, i: number) => ({
                  sale: i + 1,
                  price: Number(s.price),
                  date: new Date(s.sold_at).toLocaleDateString(),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="sale" label={{ value: "Sale #", position: "insideBottom", offset: -4 }} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v: any) => [`$${Number(v).toFixed(2)}`, "Price"]} labelFormatter={(l) => `Sale #${l}`} />
                  <Line type="monotone" dataKey="price" stroke={color} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </Box>
      )}

      {tab === 2 && (
        <Box>
          {listings.length === 0 ? (
            <Typography color="text.secondary">No active listings for this item.</Typography>
          ) : (
            <Grid container spacing={2}>
              {listings.map((l: any) => (
                <Grid item xs={12} sm={6} md={4} key={l.id}>
                  <Card sx={{ display: "flex", alignItems: "center", gap: 2, p: 2, border: `1px solid ${color}22` }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight={700} color="primary.main">${Number(l.price).toFixed(2)}</Typography>
                      <Typography variant="caption" color="text.secondary">by {l.users?.username || "—"}</Typography>
                    </Box>
                    <Button
                      variant="contained"
                      size="small"
                      component={NextLink}
                      href={`/listing/${l.id}`}
                    >
                      Buy
                    </Button>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {tab === 3 && (
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
                    sx={{ display: "flex", alignItems: "center", gap: 2, p: 2, textDecoration: "none",
                      border: `1px solid ${color}22`,
                      "&:hover": { boxShadow: 3 },
                    }}
                  >
                    <Avatar src={u?.profile_picture} sx={{ bgcolor: color }}>
                      {u?.username?.[0]?.toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography fontWeight={700}>{u?.username}</Typography>
                      <Typography variant="caption" color="text.secondary">Owns {count}x</Typography>
                    </Box>
                    <Chip label={`x${count}`} size="small" sx={{ ml: "auto", bgcolor: color, color: "#fff" }} />
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
