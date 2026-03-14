"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  Container, Box, Typography, Avatar, Grid, Card, CardContent,
  CardMedia, Chip, CircularProgress, Alert, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField,
} from "@mui/material"
import { useAuth } from "@/lib/auth-context"
import type { InventoryItem, Rarity } from "@/lib/types"
import { RARITY_COLORS } from "@/lib/types"
import NextLink from "next/link"

export default function UserPage() {
  const params = useParams()
  const username = params.username as string
  const { user: me } = useAuth()

  const [profile, setProfile] = useState<any>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // List item dialog
  const [listTarget, setListTarget] = useState<InventoryItem | null>(null)
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

  const handleList = async () => {
    if (!listTarget || !listPrice || !me) return
    setListLoading(true)
    setListError("")
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seller_id: me.id,
          inventory_id: listTarget.id,
          item_id: listTarget.item_id,
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
            {inventory.length} items
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

      {inventory.length === 0 ? (
        <Box textAlign="center" py={6}>
          <Typography color="text.secondary">No items in inventory</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {inventory.map((inv) => {
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
                    {isMe && (
                      <Button
                        variant="outlined"
                        size="small"
                        fullWidth
                        sx={{ mt: 0.5, fontSize: "0.65rem" }}
                        onClick={() => { setListTarget(inv); setListPrice(String(item.market_price)); setListError(""); setListSuccess(false) }}
                      >
                        Sell
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      )}

      {/* List item dialog */}
      <Dialog open={Boolean(listTarget)} onClose={() => setListTarget(null)}>
        <DialogTitle>List "{listTarget?.items?.name}"</DialogTitle>
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
            startIcon={listLoading ? <CircularProgress size={14} /> : null}
          >
            List
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
