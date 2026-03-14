"use client"

import { useEffect, useState, useRef } from "react"
import {
  Container, Box, Typography, Button, Card, CardContent, CardMedia,
  TextField, Select, MenuItem, FormControl, InputLabel, Grid,
  Alert, CircularProgress, Chip, Tab, Tabs, Dialog, DialogTitle,
  DialogContent, DialogActions, Slider,
} from "@mui/material"
import AddIcon from "@mui/icons-material/Add"
import { useAuth } from "@/lib/auth-context"
import type { Item, Rarity } from "@/lib/types"
import { RARITY_COLORS } from "@/lib/types"
import { useRouter } from "next/navigation"

const RARITIES = ["Common", "Uncommon", "Rare", "Legendary", "Omega"]
const RARITY_RECOMMENDED: Record<string, string> = {
  "40-100": "Common",
  "15-39": "Uncommon",
  "5-14": "Rare",
  "1-4": "Legendary",
  "0-0.99": "Omega",
}

function getRecommendedRarity(likelihood: number): string {
  if (likelihood >= 40) return "Common"
  if (likelihood >= 15) return "Uncommon"
  if (likelihood >= 5) return "Rare"
  if (likelihood >= 1) return "Legendary"
  return "Omega"
}

export default function AdminPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState(0)
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  // New item form
  const [name, setName] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [rarity, setRarity] = useState("Common")
  const [likelihood, setLikelihood] = useState(10)
  const [marketPrice, setMarketPrice] = useState("")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState("")
  const [createSuccess, setCreateSuccess] = useState(false)

  const recommended = getRecommendedRarity(likelihood)

  const loadItems = async () => {
    const res = await fetch("/api/admin/items")
    const data = await res.json()
    setItems(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => {
    if (user && !user.admin) { router.push("/"); return }
    if (user?.admin) loadItems()
  }, [user])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError("")
    setCreateSuccess(false)
    setCreating(true)
    try {
      const res = await fetch("/api/admin/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user!.id,
          name,
          image_url: imageUrl,
          rarity,
          likelihood,
          market_price: parseFloat(marketPrice) || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCreateSuccess(true)
      setName(""); setImageUrl(""); setMarketPrice("")
      loadItems()
    } catch (e: any) {
      setCreateError(e.message)
    } finally {
      setCreating(false)
    }
  }

  if (!user) return <Box textAlign="center" py={8}><CircularProgress /></Box>
  if (!user.admin) return null

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Admin Panel
      </Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Items" />
        <Tab label="Add Item" />
      </Tabs>

      {tab === 0 && (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {items.length} items in pool
          </Typography>
          {loading ? <CircularProgress /> : (
            <Grid container spacing={2}>
              {items.map((item) => {
                const color = RARITY_COLORS[item.rarity as Rarity]
                const chance = Number(item.likelihood)
                const oneIn = Math.round(100 / chance)
                return (
                  <Grid item key={item.id} xs={6} sm={4} md={3} lg={2}>
                    <Card sx={{ border: `1px solid ${color}44` }}>
                      <CardMedia
                        component="img"
                        image={item.image_url}
                        alt={item.name}
                        sx={{ height: 100, objectFit: "contain", p: 1, bgcolor: "#f8fbff" }}
                      />
                      <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
                        <Chip label={item.rarity} size="small" sx={{ bgcolor: color, color: "#fff", mb: 0.5, fontSize: "0.6rem" }} />
                        <Typography variant="caption" display="block" fontWeight={600}
                          sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          1 in {oneIn} ({chance}%)
                        </Typography>
                        <Typography variant="caption" display="block" color="primary.main">
                          ${Number(item.market_price).toFixed(2)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )
              })}
            </Grid>
          )}
        </>
      )}

      {tab === 1 && (
        <Card sx={{ maxWidth: 560 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} gutterBottom>New Item</Typography>
            <Box component="form" onSubmit={handleCreate} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required fullWidth />
              <TextField label="Image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} required fullWidth
                helperText="PNG or GIF. Animated GIFs loop automatically." />
              {imageUrl && (
                <Box component="img" src={imageUrl} alt="preview"
                  sx={{ width: 100, height: 100, objectFit: "contain", border: "1px solid #e3f2fd", borderRadius: 1 }} />
              )}
              <FormControl fullWidth>
                <InputLabel>Rarity</InputLabel>
                <Select value={rarity} onChange={(e) => setRarity(e.target.value)} label="Rarity">
                  {RARITIES.map((r) => (
                    <MenuItem key={r} value={r}>
                      <Chip label={r} size="small" sx={{ bgcolor: RARITY_COLORS[r as Rarity], color: "#fff", mr: 1, fontSize: "0.65rem" }} />
                      {r}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box>
                <Typography variant="body2" gutterBottom>
                  Likelihood: <strong>{likelihood}%</strong> (1 in {Math.round(100 / likelihood)})
                </Typography>
                <Slider
                  value={likelihood}
                  onChange={(_, v) => setLikelihood(v as number)}
                  min={0.1}
                  max={50}
                  step={0.1}
                />
                <Chip
                  label={`Recommended: ${recommended}`}
                  size="small"
                  sx={{ bgcolor: RARITY_COLORS[recommended as Rarity], color: "#fff", fontSize: "0.65rem" }}
                />
              </Box>
              <TextField
                label="Market Price (USD)"
                type="number"
                value={marketPrice}
                onChange={(e) => setMarketPrice(e.target.value)}
                inputProps={{ min: 0, step: 0.01 }}
                fullWidth
              />
              {createError && <Alert severity="error">{createError}</Alert>}
              {createSuccess && <Alert severity="success">Item created!</Alert>}
              <Button type="submit" variant="contained" startIcon={<AddIcon />} disabled={creating}>
                {creating ? "Creating..." : "Create Item"}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Container>
  )
}
