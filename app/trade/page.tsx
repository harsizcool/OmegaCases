"use client"

import { useState, useEffect, useCallback } from "react"
import NextLink from "next/link"
import {
  Container, Box, Typography, Card, CardContent, Chip, Button,
  Avatar, Grid, Tabs, Tab, Alert, CircularProgress, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  IconButton, Tooltip, Badge, InputAdornment, Autocomplete,
} from "@mui/material"
import AddIcon from "@mui/icons-material/Add"
import CloseIcon from "@mui/icons-material/Close"
import SwapHorizIcon from "@mui/icons-material/SwapHoriz"
import CheckIcon from "@mui/icons-material/Check"
import BlockIcon from "@mui/icons-material/Block"
import SearchIcon from "@mui/icons-material/Search"
import { useAuth } from "@/lib/auth-context"
import { RARITY_COLORS } from "@/lib/types"
import type { InventoryItem, Rarity } from "@/lib/types"

const MAX_ITEMS = 6
const MAX_BALANCE = 50
const RARITIES_LIST = ["Common", "Uncommon", "Rare", "Legendary", "Omega"]

function ItemSlots({
  items,
  inventory,
  onAdd,
  onRemove,
  label,
}: {
  items: TradeItem[]
  inventory: InventoryItem[]
  onAdd: (inv: InventoryItem) => void
  onRemove: (id: string) => void
  label: string
}) {
  const [search, setSearch] = useState("")
  const [rarityFilter, setRarityFilter] = useState<string>("")

  const available = inventory.filter((inv) => !items.find((i) => i.id === inv.id))
  const filtered = available.filter((inv) => {
    const matchSearch = !search || inv.items?.name.toLowerCase().includes(search.toLowerCase())
    const matchRarity = !rarityFilter || inv.items?.rarity === rarityFilter
    return matchSearch && matchRarity
  })

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Typography variant="subtitle2" fontWeight={700}>{label}</Typography>
        <Typography variant="caption" color="primary.main" fontWeight={600}>
          RAP: ${items.reduce((s, ti) => s + ti.item.rap, 0).toFixed(2)}
        </Typography>
      </Box>

      {/* Selected slots */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1, minHeight: 56 }}>
        {items.map((ti, idx) => (
          <Badge
            key={`${ti.id}-${idx}`}
            badgeContent={
              <IconButton
                size="small"
                onClick={() => onRemove(ti.id)}
                sx={{ bgcolor: "error.main", color: "#fff", width: 16, height: 16, p: 0 }}
              >
                <CloseIcon sx={{ fontSize: 10 }} />
              </IconButton>
            }
            overlap="circular"
            anchorOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <Tooltip title={`${ti.item.name} — RAP: $${ti.item.rap.toFixed(2)}`}>
              <Box
                component="img"
                src={ti.item.image_url}
                alt={ti.item.name}
                sx={{
                  width: 52, height: 52, objectFit: "contain", borderRadius: 1,
                  border: `2px solid ${RARITY_COLORS[ti.item.rarity as Rarity]}66`,
                  bgcolor: "#f8fbff", cursor: "pointer",
                }}
              />
            </Tooltip>
          </Badge>
        ))}
        {items.length < MAX_ITEMS && (
          <Box
            sx={{
              width: 52, height: 52, border: "2px dashed #1976d244", borderRadius: 1,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#1976d266",
            }}
          >
            <AddIcon fontSize="small" />
          </Box>
        )}
      </Box>

      {/* Search + rarity filter + available items */}
      {items.length < MAX_ITEMS && available.length > 0 && (
        <>
          <TextField
            size="small"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            fullWidth
            sx={{ mb: 0.75 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          {/* Rarity filter chips */}
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1 }}>
            <Chip
              label="All"
              size="small"
              onClick={() => setRarityFilter("")}
              variant={rarityFilter === "" ? "filled" : "outlined"}
              sx={{ fontSize: "0.65rem", height: 20, cursor: "pointer" }}
            />
            {RARITIES_LIST.map((r) => (
              <Chip
                key={r}
                label={r}
                size="small"
                onClick={() => setRarityFilter(rarityFilter === r ? "" : r)}
                variant={rarityFilter === r ? "filled" : "outlined"}
                sx={{
                  fontSize: "0.65rem", height: 20, cursor: "pointer",
                  bgcolor: rarityFilter === r ? RARITY_COLORS[r as Rarity] : undefined,
                  color: rarityFilter === r ? "#fff" : RARITY_COLORS[r as Rarity],
                  borderColor: RARITY_COLORS[r as Rarity],
                }}
              />
            ))}
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, maxHeight: 130, overflowY: "auto" }}>
            {filtered.map((inv) => (
              <Tooltip
                key={inv.id}
                title={`${inv.items?.name} — RAP: $${Number(inv.items?.rap || 0).toFixed(2)}`}
              >
                <Box
                  component="img"
                  src={inv.items?.image_url}
                  alt={inv.items?.name}
                  onClick={() => onAdd(inv)}
                  sx={{
                    width: 42, height: 42, objectFit: "contain", borderRadius: 1,
                    border: `2px solid ${RARITY_COLORS[(inv.items?.rarity as Rarity) || "Common"]}44`,
                    bgcolor: "#f8fbff", cursor: "pointer",
                    "&:hover": { opacity: 0.8, transform: "scale(1.06)" },
                    transition: "all 0.1s",
                  }}
                />
              </Tooltip>
            ))}
            {filtered.length === 0 && (
              <Typography variant="caption" color="text.secondary">No items match.</Typography>
            )}
          </Box>
        </>
      )}
      {items.length === MAX_ITEMS && (
        <Typography variant="caption" color="text.secondary">Max {MAX_ITEMS} items reached</Typography>
      )}
    </Box>
  )
}

interface TradeItem {
  id: string
  item: {
    id: string
    name: string
    image_url: string
    rarity: string
    rap: number
  }
}

interface Trade {
  id: string
  sender_id: string
  receiver_id: string
  sender_balance: number
  receiver_balance: number
  status: string
  created_at: string
  sender?: { id: string; username: string; profile_picture?: string }
  receiver?: { id: string; username: string; profile_picture?: string }
  trade_items: Array<{
    id: string
    side: string
    inventory: {
      id: string
      item_id: string
      items: { id: string; name: string; image_url: string; rarity: string; rap: number }
    }
  }>
}

function tradeValue(items: TradeItem[], balance: number) {
  return items.reduce((sum, ti) => sum + Number(ti.item.rap), 0) + Number(balance)
}

function tradeValueFromSide(
  tradeItems: Trade["trade_items"],
  side: string,
  balance: number
) {
  const items = tradeItems.filter((ti) => ti.side === side)
  return items.reduce((sum, ti) => sum + Number(ti.inventory.items.rap), 0) + Number(balance)
}

export default function TradePage() {
  const { user, refreshUser } = useAuth()
  const [tab, setTab] = useState(0)
  const [trades, setTrades] = useState<{ sent: Trade[]; received: Trade[] }>({ sent: [], received: [] })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [newTradeOpen, setNewTradeOpen] = useState(false)
  const [allUsers, setAllUsers] = useState<{ id: string; username: string }[]>([])
  const [receiver, setReceiver] = useState<{ id: string; username: string } | null>(null)
  const [myInventory, setMyInventory] = useState<InventoryItem[]>([])
  const [theirInventory, setTheirInventory] = useState<InventoryItem[]>([])
  const [offerItems, setOfferItems] = useState<TradeItem[]>([])
  const [requestItems, setRequestItems] = useState<TradeItem[]>([])
  const [offerBalance, setOfferBalance] = useState("")
  const [requestBalance, setRequestBalance] = useState("")
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState("")

  const fetchTrades = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const res = await fetch(`/api/trades?user_id=${user.id}`)
    const data = await res.json()
    setTrades(data)
    setLoading(false)
  }, [user])

  useEffect(() => { fetchTrades() }, [fetchTrades])

  const fetchMyInventory = async () => {
    if (!user) return
    // Paginate through all pages since API now returns { items, total, pageSize }
    let all: InventoryItem[] = []
    let page = 0
    while (true) {
      const res = await fetch(`/api/inventory/${user.id}?page=${page}`)
      const data = await res.json()
      const batch = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : []
      all = all.concat(batch)
      if (batch.length < 1000) break
      page++
    }
    setMyInventory(all)
  }

  const fetchTheirInventory = async (userId: string) => {
    let all: InventoryItem[] = []
    let page = 0
    while (true) {
      const res = await fetch(`/api/inventory/${userId}?page=${page}`)
      const data = await res.json()
      const batch = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : []
      all = all.concat(batch)
      if (batch.length < 1000) break
      page++
    }
    setTheirInventory(all)
  }

  const fetchUsers = async () => {
    const res = await fetch("/api/users")
    const data = await res.json()
    setAllUsers(Array.isArray(data) ? data.filter((u: any) => u.id !== user?.id) : [])
  }

  const openNewTrade = async () => {
    setCreateError("")
    setOfferItems([])
    setRequestItems([])
    setOfferBalance("")
    setRequestBalance("")
    setReceiver(null)
    setTheirInventory([])
    await fetchMyInventory()
    await fetchUsers()
    setNewTradeOpen(true)
  }

  const handleReceiverChange = async (val: { id: string; username: string } | null) => {
    setReceiver(val)
    setRequestItems([])
    if (val) await fetchTheirInventory(val.id)
    else setTheirInventory([])
  }

  const addOfferItem = (inv: InventoryItem) => {
    if (offerItems.length >= MAX_ITEMS) return
    if (offerItems.find((i) => i.id === inv.id)) return
    setOfferItems((prev) => [
      ...prev,
      { id: inv.id, item: { id: inv.item_id, name: inv.items!.name, image_url: inv.items!.image_url, rarity: inv.items!.rarity, rap: Number(inv.items!.rap) } },
    ])
  }

  const addRequestItem = (inv: InventoryItem) => {
    if (requestItems.length >= MAX_ITEMS) return
    if (requestItems.find((i) => i.id === inv.id)) return
    setRequestItems((prev) => [
      ...prev,
      { id: inv.id, item: { id: inv.item_id, name: inv.items!.name, image_url: inv.items!.image_url, rarity: inv.items!.rarity, rap: Number(inv.items!.rap) } },
    ])
  }

  const handleCreateTrade = async () => {
    if (!user || !receiver) return
    const ob = Number(offerBalance) || 0
    const rb = Number(requestBalance) || 0
    if (ob > MAX_BALANCE || rb > MAX_BALANCE) {
      setCreateError(`Max $${MAX_BALANCE} balance per side`)
      return
    }
    setCreateLoading(true)
    setCreateError("")
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_id: user.id,
          receiver_id: receiver.id,
          sender_items: offerItems.map((i) => i.id),
          receiver_items: requestItems.map((i) => i.id),
          sender_balance: ob,
          receiver_balance: rb,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setNewTradeOpen(false)
      setSuccess("Trade sent!")
      fetchTrades()
    } catch (e: any) {
      setCreateError(e.message)
    } finally {
      setCreateLoading(false)
    }
  }

  const handleAction = async (tradeId: string, action: "accept" | "decline" | "cancel") => {
    if (!user) return
    setActionLoading(tradeId + action)
    setError("")
    try {
      const res = await fetch(`/api/trades/${tradeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, user_id: user.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess(`Trade ${action}ed!`)
      await fetchTrades()
      await refreshUser()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActionLoading(null)
    }
  }


  const TradeCard = ({ trade, isSent }: { trade: Trade; isSent: boolean }) => {
    const other = isSent ? trade.receiver : trade.sender

    // For sent trades: left = "You Offer" (sender), right = "You Request" (receiver)
    // For received trades: left = "They Offer" (sender = them), right = "They Request" (receiver = you)
    // So from receiver's perspective: left side shows what THEY (sender) put in, right shows what YOU (receiver) must give
    const leftSide = "sender"
    const rightSide = "receiver"

    const leftItems = trade.trade_items.filter((ti) => ti.side === leftSide)
    const rightItems = trade.trade_items.filter((ti) => ti.side === rightSide)
    const leftBalance = trade.sender_balance
    const rightBalance = trade.receiver_balance

    const leftLabel = isSent ? "You Offer" : "They Offer"
    const rightLabel = isSent ? "You Request" : "They Request"

    const leftValue = tradeValueFromSide(trade.trade_items, leftSide, leftBalance)
    const rightValue = tradeValueFromSide(trade.trade_items, rightSide, rightBalance)
    const isPending = trade.status === "pending"

    const statusColor: Record<string, "default" | "warning" | "success" | "error"> = {
      pending: "warning",
      accepted: "success",
      declined: "error",
      cancelled: "default",
    }

    return (
      <Card sx={{ mb: 2, border: isPending ? "1px solid #1976d233" : "1px solid #e0e0e0" }}>
        <CardContent>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Avatar
                src={other?.profile_picture || undefined}
                sx={{ width: 30, height: 30, bgcolor: "primary.main", fontSize: 13 }}
              >
                {other?.username?.[0]?.toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  {isSent ? "To" : "From"}{" "}
                  <Box
                    component={NextLink}
                    href={`/user/${other?.username}`}
                    sx={{ color: "primary.main", textDecoration: "none" }}
                  >
                    {other?.username}
                  </Box>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(trade.created_at).toLocaleDateString()}
                </Typography>
              </Box>
            </Box>
            <Chip label={trade.status} size="small" color={statusColor[trade.status] || "default"} />
          </Box>

          <Grid container spacing={2}>
            {/* Left side */}
            <Grid item xs={5}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  {leftLabel}
                </Typography>
                <Typography variant="caption" color="primary.main" fontWeight={600}>
                  ${leftValue.toFixed(2)}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, minHeight: 48 }}>
                {leftItems.map((ti, idx) => (
                  <Tooltip key={`${ti.id}-${idx}`} title={`${ti.inventory.items.name} (RAP: $${Number(ti.inventory.items.rap).toFixed(2)})`}>
                    <Box
                      component="img"
                      src={ti.inventory.items.image_url}
                      alt={ti.inventory.items.name}
                      sx={{
                        width: 44, height: 44, objectFit: "contain", borderRadius: 1,
                        border: `2px solid ${RARITY_COLORS[ti.inventory.items.rarity as Rarity]}44`,
                        bgcolor: "#f8fbff",
                      }}
                    />
                  </Tooltip>
                ))}
                {leftItems.length === 0 && (
                  <Typography variant="caption" color="text.secondary">No items</Typography>
                )}
              </Box>
              {Number(leftBalance) > 0 && (
                <Chip label={`+$${Number(leftBalance).toFixed(2)}`} color="success" size="small" sx={{ mt: 0.5 }} />
              )}
            </Grid>

            <Grid item xs={2} sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <SwapHorizIcon sx={{ color: "text.secondary" }} />
            </Grid>

            {/* Right side */}
            <Grid item xs={5}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  {rightLabel}
                </Typography>
                <Typography variant="caption" color="primary.main" fontWeight={600}>
                  ${rightValue.toFixed(2)}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, minHeight: 48 }}>
                {rightItems.map((ti, idx) => (
                  <Tooltip key={`${ti.id}-${idx}`} title={`${ti.inventory.items.name} (RAP: $${Number(ti.inventory.items.rap).toFixed(2)})`}>
                    <Box
                      component="img"
                      src={ti.inventory.items.image_url}
                      alt={ti.inventory.items.name}
                      sx={{
                        width: 44, height: 44, objectFit: "contain", borderRadius: 1,
                        border: `2px solid ${RARITY_COLORS[ti.inventory.items.rarity as Rarity]}44`,
                        bgcolor: "#f8fbff",
                      }}
                    />
                  </Tooltip>
                ))}
                {rightItems.length === 0 && (
                  <Typography variant="caption" color="text.secondary">No items</Typography>
                )}
              </Box>
              {Number(rightBalance) > 0 && (
                <Chip label={`+$${Number(rightBalance).toFixed(2)}`} color="success" size="small" sx={{ mt: 0.5 }} />
              )}
            </Grid>
          </Grid>

          {/* Overall trade value comparison */}
          <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              Trade value:{" "}
              <Box component="span" sx={{ color: "primary.main", fontWeight: 700 }}>
                ${leftValue.toFixed(2)}
              </Box>
              {" "}vs{" "}
              <Box component="span" sx={{ color: "primary.main", fontWeight: 700 }}>
                ${rightValue.toFixed(2)}
              </Box>
            </Typography>
          </Box>

          {isPending && (
            <Box sx={{ display: "flex", gap: 1, mt: 2, justifyContent: "flex-end" }}>
              {isSent ? (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={() => handleAction(trade.id, "cancel")}
                  disabled={actionLoading === trade.id + "cancel"}
                >
                  Cancel
                </Button>
              ) : (
                <>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<BlockIcon />}
                    onClick={() => handleAction(trade.id, "decline")}
                    disabled={!!actionLoading}
                  >
                    Decline
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={<CheckIcon />}
                    onClick={() => handleAction(trade.id, "accept")}
                    disabled={!!actionLoading}
                  >
                    Accept
                  </Button>
                </>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    )
  }

  if (!user) {
    return (
      <Container maxWidth="md" sx={{ py: 6, textAlign: "center" }}>
        <Typography variant="h6" gutterBottom>Sign in to trade</Typography>
        <Button variant="contained" component={NextLink} href="/login">Login</Button>
      </Container>
    )
  }

  const pendingReceived = trades.received.filter((t) => t.status === "pending").length
  const offerVal = tradeValue(offerItems, Number(offerBalance) || 0)
  const requestVal = tradeValue(requestItems, Number(requestBalance) || 0)

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Trades</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNewTrade}>
          New Trade
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab
            label={
              <Badge badgeContent={pendingReceived} color="error">
                <Box sx={{ pr: pendingReceived > 0 ? 1.5 : 0 }}>Received</Box>
              </Badge>
            }
          />
          <Tab label="Sent" />
        </Tabs>
      </Box>

      {loading ? (
        <Box textAlign="center" py={6}><CircularProgress /></Box>
      ) : (
        <>
          {tab === 0 && (
            trades.received.length === 0 ? (
              <Box textAlign="center" py={6}>
                <Typography color="text.secondary">No received trades yet.</Typography>
              </Box>
            ) : (
              trades.received.map((t) => <TradeCard key={t.id} trade={t} isSent={false} />)
            )
          )}
          {tab === 1 && (
            trades.sent.length === 0 ? (
              <Box textAlign="center" py={6}>
                <Typography color="text.secondary">No sent trades yet.</Typography>
              </Box>
            ) : (
              trades.sent.map((t) => <TradeCard key={t.id} trade={t} isSent={true} />)
            )
          )}
        </>
      )}

      {/* New Trade Dialog */}
      <Dialog open={newTradeOpen} onClose={() => setNewTradeOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          New Trade
          <IconButton onClick={() => setNewTradeOpen(false)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Autocomplete
              options={allUsers}
              getOptionLabel={(o) => o.username}
              value={receiver}
              onChange={(_, v) => handleReceiverChange(v)}
              renderInput={(params) => <TextField {...params} label="Trade with (username)" size="small" />}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              sx={{ mb: 2 }}
            />
          </Box>

          {createError && <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>}

          {/* Trade value summary */}
          <Box
            sx={{
              display: "flex", justifyContent: "center", gap: 3, mb: 2,
              p: 1.5, bgcolor: "#f0f7ff", borderRadius: 2,
            }}
          >
            <Box textAlign="center">
              <Typography variant="caption" color="text.secondary">You Offer</Typography>
              <Typography variant="body2" fontWeight={700} color="primary.main">${offerVal.toFixed(2)}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box textAlign="center">
              <Typography variant="caption" color="text.secondary">You Request</Typography>
              <Typography variant="body2" fontWeight={700} color="primary.main">${requestVal.toFixed(2)}</Typography>
            </Box>
          </Box>

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <ItemSlots
                items={offerItems}
                inventory={myInventory}
                onAdd={addOfferItem}
                onRemove={(id) => setOfferItems((p) => p.filter((i) => i.id !== id))}
                label="You Offer"
              />
              <TextField
                label="Your Balance Offer (max $50)"
                type="number"
                value={offerBalance}
                onChange={(e) => setOfferBalance(e.target.value)}
                size="small"
                fullWidth
                sx={{ mt: 2 }}
                inputProps={{ min: 0, max: MAX_BALANCE, step: 0.01 }}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                helperText={`Your balance: $${Number(user.balance).toFixed(2)}`}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <ItemSlots
                items={requestItems}
                inventory={theirInventory}
                onAdd={addRequestItem}
                onRemove={(id) => setRequestItems((p) => p.filter((i) => i.id !== id))}
                label={receiver ? `Request from ${receiver.username}` : "Select a user first"}
              />
              <TextField
                label="Request Balance (max $50)"
                type="number"
                value={requestBalance}
                onChange={(e) => setRequestBalance(e.target.value)}
                size="small"
                fullWidth
                sx={{ mt: 2 }}
                inputProps={{ min: 0, max: MAX_BALANCE, step: 0.01 }}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewTradeOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateTrade}
            disabled={createLoading || !receiver || (offerItems.length === 0 && requestItems.length === 0 && !offerBalance && !requestBalance)}
          >
            {createLoading ? <CircularProgress size={14} sx={{ mr: 1 }} /> : <SwapHorizIcon sx={{ mr: 0.5, fontSize: 18 }} />}
            Send Trade
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
