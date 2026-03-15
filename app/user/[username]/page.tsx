"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import {
  Container, Box, Typography, Avatar, Grid, Card, CardContent,
  CardMedia, Chip, CircularProgress, Alert, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField,
  Select, MenuItem, FormControl, InputLabel, FormControlLabel,
  Checkbox, Badge,
} from "@mui/material"
import { useAuth } from "@/lib/auth-context"
import type { InventoryItem, Rarity } from "@/lib/types"
import { RARITY_COLORS } from "@/lib/types"
import NextLink from "next/link"

type SortMode = "rap" | "latest"

interface BundledItem {
  item_id: string
  name: string
  image_url: string
  rarity: Rarity
  rap: number
  market_price: number
  count: number
  // for listing — the oldest inventory entry
  inventoryId: string
}

export default function UserPage() {
  const params = useParams()
  const username = params.username as string
  const { user: me } = useAuth()

  const [profile, setProfile] = useState<any>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [sortMode, setSortMode] = useState<SortMode>("rap")
  const [bundle, setBundle] = useState(true)

  // List item dialog
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

      const invRes = await fetch(`/api/inventory/${profileData.id}`)
      const invData = await invRes.json()
      setInventory(Array.isArray(invData) ? invData : [])
      setLoading(false)
    }
    load()
  }, [username])

  const rapValue = inventory.reduce((sum, inv) => sum + Number(inv.items?.rap || 0), 0)
  const isMe = me?.username === username

  // Build bundled view
  const bundledItems = useMemo<BundledItem[]>(() => {
    const map = new Map<string, BundledItem>()
    // Sort by obtained_at ascending so the oldest inventoryId is picked per bundle
    const sorted = [...inventory].sort((a, b) =>
      new Date(a.obtained_at).getTime() - new Date(b.obtained_at).getTime()
    )
    for (const inv of sorted) {
      const item = inv.items
      if (!item) continue
      if (map.has(inv.item_id)) {
        map.get(inv.item_id)!.count++
      } else {
        map.set(inv.item_id, {
          item_id: inv.item_id,
          name: item.name,
          image_url: item.image_url,
          rarity: item.rarity as Rarity,
          rap: Number(item.rap),
          market_price: Number(item.market_price),
          count: 1,
          inventoryId: inv.id,
        })
      }
    }
    return Array.from(map.values())
  }, [inventory])

  // Sorted individual items
  const sortedInventory = useMemo(() => {
    return [...inventory].sort((a, b) => {
      if (sortMode === "rap") return Number(b.items?.rap || 0) - Number(a.items?.rap || 0)
      return new Date(b.obtained_at).getTime() - new Date(a.obtained_at).getTime()
    })
  }, [inventory, sortMode])

  // Sorted bundled items
  const sortedBundled = useMemo(() => {
    return [...bundledItems].sort((a, b) => {
      if (sortMode === "rap") return b.rap - a.rap
      // "latest" for bundles: sort by highest count, then by rap
      return b.rap - a.rap
    })
  }, [bundledItems, sortMode])

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
      // Find the actual inventory row for this item owned by me
      const invRow = inventory.find(
        (inv) => inv.id === listTarget.inventoryId
      )
      if (!invRow) throw new Error("Item not found in inventory")
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seller_id: me.id,
          inventory_id: invRow.id,
          item_id: invRow.item_id,
          price: parseFloat(listPrice),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setListSuccess(true)
    } catch (e: any) {
      setListError(e.message)
    } finally {
      setListLoading(false)
    }
  }

  if (loading) return (
    <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
  )
  if (error) return (
    <Container><Alert severity="error" sx={{ mt: 4 }}>{error}</Alert></Container>
  )

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Profile header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 4, flexWrap: "wrap" }}>
        {profile?.profile_picture ? (
          <Avatar src={profile.profile_picture} sx={{ width: 80, height: 80 }} />
        ) : (
          <Avatar sx={{ width: 80, height: 80, bgcolor: "primary.main", fontSize: 32 }}>
            {profile?.username?.[0]?.toUpperCase()}
          </Avatar>
        )}
        <Box>
          <Typography variant="h4" fontWeight={700}>{profile?.username}</Typography>
          <Typography variant="body1" color="text.secondary">
            Inventory Value (RAP):{" "}
            <strong style={{ color: "#1976d2" }}>${rapValue.toFixed(2)}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {inventory.length} item{inventory.length !== 1 ? "s" : ""}
            {bundle && bundledItems.length !== inventory.length && (
              <> &middot; {bundledItems.length} unique</>
            )}
          </Typography>
        </Box>
        {isMe && (
          <Box sx={{ ml: "auto" }}>
            <Button variant="outlined" component={NextLink} href="/open">
              Open Cases
            </Button>
          </Box>
        )}
      </Box>

      {/* Controls */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Sort By</InputLabel>
          <Select
            value={sortMode}
            label="Sort By"
            onChange={(e) => setSortMode(e.target.value as SortMode)}
          >
            <MenuItem value="rap">Sort by RAP</MenuItem>
            <MenuItem value="latest">Sort by Latest</MenuItem>
          </Select>
        </FormControl>
        <FormControlLabel
          control={
            <Checkbox
              checked={bundle}
              onChange={(e) => setBundle(e.target.checked)}
              size="small"
            />
          }
          label="Bundle Similar Items"
        />
      </Box>

      {inventory.length === 0 ? (
        <Box textAlign="center" py={6}>
          <Typography color="text.secondary">No items in inventory</Typography>
        </Box>
      ) : bundle ? (
        // Bundled grid
        <Grid container spacing={2}>
          {sortedBundled.map((b) => {
            const color = RARITY_COLORS[b.rarity]
            return (
              <Grid item key={b.item_id} xs={6} sm={4} md={3} lg={2}>
                <Badge
                  badgeContent={b.count > 1 ? `x${b.count}` : null}
                  color="primary"
                  sx={{ display: "block", "& .MuiBadge-badge": { fontSize: "0.7rem", fontWeight: 700, right: 8, top: 8 } }}
                >
                  <Card
                    sx={{
                      border: `1px solid ${color}44`,
                      "&:hover": { boxShadow: `0 4px 16px ${color}44`, transform: "translateY(-2px)", transition: "all 0.15s" },
                    }}
                  >
                    <Box
                      component={NextLink}
                      href={`/item/${encodeURIComponent(b.name)}`}
                      sx={{ display: "block", textDecoration: "none", color: "inherit" }}
                    >
                      <CardMedia
                        component="img"
                        image={b.image_url}
                        alt={b.name}
                        sx={{ height: 110, objectFit: "contain", p: 1, bgcolor: "#f8fbff" }}
                      />
                      <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
                        <Chip
                          label={b.rarity}
                          size="small"
                          sx={{ bgcolor: color, color: "#fff", mb: 0.5, fontSize: "0.6rem" }}
                        />
                        <Typography
                          variant="caption"
                          display="block"
                          fontWeight={600}
                          sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          {b.name}
                        </Typography>
                        <Typography variant="caption" color="primary.main" fontWeight={700} display="block">
                          RAP: ${b.rap.toFixed(2)}
                        </Typography>
                      </CardContent>
                    </Box>
                    {isMe && (
                      <Box sx={{ px: 1, pb: 1 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          fullWidth
                          sx={{ fontSize: "0.65rem" }}
                          onClick={() => openListDialog(b.inventoryId, { name: b.name, market_price: b.market_price })}
                        >
                          Sell
                        </Button>
                      </Box>
                    )}
                  </Card>
                </Badge>
              </Grid>
            )
          })}
        </Grid>
      ) : (
        // Individual grid
        <Grid container spacing={2}>
          {sortedInventory.map((inv) => {
            const item = inv.items
            if (!item) return null
            const color = RARITY_COLORS[item.rarity as Rarity]
            return (
              <Grid item key={inv.id} xs={6} sm={4} md={3} lg={2}>
                <Card
                  sx={{
                    border: `1px solid ${color}44`,
                    "&:hover": { boxShadow: `0 4px 16px ${color}44`, transform: "translateY(-2px)", transition: "all 0.15s" },
                  }}
                >
                  <Box
                    component={NextLink}
                    href={`/item/${encodeURIComponent(item.name)}`}
                    sx={{ display: "block", textDecoration: "none", color: "inherit" }}
                  >
                    <CardMedia
                      component="img"
                      image={item.image_url}
                      alt={item.name}
                      sx={{ height: 110, objectFit: "contain", p: 1, bgcolor: "#f8fbff" }}
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
                      <Typography variant="caption" color="primary.main" fontWeight={700} display="block">
                        RAP: ${Number(item.rap).toFixed(2)}
                      </Typography>
                    </CardContent>
                  </Box>
                  {isMe && (
                    <Box sx={{ px: 1, pb: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        fullWidth
                        sx={{ fontSize: "0.65rem" }}
                        onClick={() => openListDialog(inv.id, { name: item.name, market_price: Number(item.market_price) })}
                      >
                        Sell
                      </Button>
                    </Box>
                  )}
                </Card>
              </Grid>
            )
          })}
        </Grid>
      )}

      {/* List item dialog */}
      <Dialog open={Boolean(listTarget)} onClose={() => setListTarget(null)}>
        <DialogTitle>List "{listTarget?.item?.name}"</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              label="Your Price (USD)"
              type="number"
              value={listPrice}
              onChange={(e) => setListPrice(e.target.value)}
              inputProps={{ min: 0.01, step: 0.01 }}
              fullWidth
            />
            {listError && <Alert severity="error" sx={{ mt: 1 }}>{listError}</Alert>}
            {listSuccess && <Alert severity="success" sx={{ mt: 1 }}>Listed on marketplace!</Alert>}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setListTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleList}
            disabled={listLoading || listSuccess}
          >
            {listLoading ? "Listing..." : "List"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
