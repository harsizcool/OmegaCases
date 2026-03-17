"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Container, Box, Typography, Button, Grid, Card, CardContent,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, Divider, Badge, Switch, FormControlLabel,
} from "@mui/material"
import LockIcon from "@mui/icons-material/Lock"
import InventoryIcon from "@mui/icons-material/Inventory"
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart"
import SpeedIcon from "@mui/icons-material/Speed"
import { useAuth } from "@/lib/auth-context"
import CaseSpinner from "@/components/case-spinner"
import Confetti from "@/components/confetti"
import ItemCard from "@/components/item-card"
import type { Item, Rarity, CasePrice } from "@/lib/types"
import { RARITY_COLORS, CASE_PRICES } from "@/lib/types"
import NextLink from "next/link"
import { useMuteSounds } from "@/lib/use-mute-sounds"

const CONFETTI_RARITIES: Rarity[] = ["Legendary", "Omega"]
const CONFETTI_SRC = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/confetti-pop-sound-fNcAXWXi7MdyVXwS9yqsN7dqp9PhVx.mp3"
const BORING_SRC = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/boring-pop-pVmE2X5VYDLMLvcrduACPs958KNNxL.mp3"

function playSound(src: string) {
  try {
    const a = new Audio(src)
    a.volume = 0.6
    a.play().catch(() => {})
  } catch {}
}

export default function OpenPage() {
  const { user, refreshUser } = useAuth()
  const { muted } = useMuteSounds()
  const [items, setItems] = useState<Item[]>([])
  const [casePrices, setCasePrices] = useState<CasePrice[]>(CASE_PRICES)
  const [selectedQty, setSelectedQty] = useState<number>(10)
  const [spinning, setSpinning] = useState(false)
  const [targetItem, setTargetItem] = useState<Item | null>(null)
  const [wonItemId, setWonItemId] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [lastWon, setLastWon] = useState<Item | null>(null)
  const [confettiActive, setConfettiActive] = useState(false)
  const [spinLoading, setSpinLoading] = useState(false)
  const [buyLoading, setBuyLoading] = useState(false)
  const [error, setError] = useState("")
  const [buyModalOpen, setBuyModalOpen] = useState(false)

  // 2x speed toggle — persisted to localStorage
  const [doubleSpeed, setDoubleSpeed] = useState(false)
  useEffect(() => {
    try {
      setDoubleSpeed(localStorage.getItem("omegacases_2x_speed") === "true")
    } catch {}
  }, [])
  const toggleDoubleSpeed = () => {
    setDoubleSpeed((prev) => {
      const next = !prev
      try { localStorage.setItem("omegacases_2x_speed", String(next)) } catch {}
      return next
    })
  }

  useEffect(() => {
    fetch("/api/admin/items").then((r) => r.json()).then(setItems)
    fetch("/api/cases/prices").then((r) => r.json()).then((prices) => {
      if (Array.isArray(prices) && prices.length > 0) setCasePrices(prices)
    })
  }, [])

  const selectedPrice = casePrices.find((p) => p.qty === selectedQty) ?? casePrices[0]
  const casesRemaining = user?.cases_remaining ?? 0

  // Buy cases: deduct balance, add to cases_remaining only
  const handleBuyCases = async () => {
    if (!user) return
    if (Number(user.balance) < selectedPrice.price) {
      setBuyModalOpen(true)
      return
    }
    setError("")
    setBuyLoading(true)
    try {
      const res = await fetch("/api/cases/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, qty: selectedQty }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 402) { setBuyModalOpen(true); return }
        throw new Error(data.error || "Failed to buy cases")
      }
      await refreshUser()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBuyLoading(false)
    }
  }

  // Spin: consume 1 case_remaining, get 1 item
  const handleSpin = async () => {
    if (!user || casesRemaining < 1 || spinning) return
    setError("")
    setShowResult(false)
    setSpinLoading(true)
    try {
      const res = await fetch("/api/cases/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to open case")
      setTargetItem(data.wonItem)
      setWonItemId(data.wonItem.id)
      await refreshUser()
      setSpinning(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSpinLoading(false)
    }
  }

  const handleSpinComplete = useCallback(() => {
    if (!targetItem) return
    setLastWon(targetItem)
    setShowResult(true)
    setSpinning(false)

    // Record roll AFTER animation — this triggers Realtime so live feed shows
    // the result only after the roller has already seen it
    if (user?.id && wonItemId) {
      fetch("/api/rolls/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, item_id: wonItemId }),
      }).catch(() => {})
    }

    if (CONFETTI_RARITIES.includes(targetItem.rarity as Rarity)) {
      setConfettiActive(true)
      if (!muted) {
        playSound(CONFETTI_SRC)
        playSound(BORING_SRC)
      }
      setTimeout(() => setConfettiActive(false), 6000)
    } else {
      if (!muted) playSound(BORING_SRC)
    }
  }, [targetItem, wonItemId, user?.id, muted])

  const handleSpinAgain = () => {
    setShowResult(false)
    setLastWon(null)
    setTargetItem(null)
    handleSpin()
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Confetti active={confettiActive} />

      <Typography variant="h4" fontWeight={700} textAlign="center" gutterBottom>
        Open Cases
      </Typography>

      {!user && (
        <Box textAlign="center" sx={{ py: 6 }}>
          <LockIcon sx={{ fontSize: 64, color: "primary.light", mb: 2 }} />
          <Typography variant="h6" gutterBottom>Login to open cases</Typography>
          <Button variant="contained" size="large" component={NextLink} href="/login" sx={{ mt: 1 }}>
            Login / Register
          </Button>
        </Box>
      )}

      {user && (
        <>
          {/* Balance + cases remaining bar */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              gap: 3,
              mb: 4,
              flexWrap: "wrap",
            }}
          >
            <Chip
              label={`Balance: $${Number(user.balance).toFixed(2)}`}
              color="primary"
              variant="outlined"
              sx={{ fontSize: "1rem", px: 1, py: 2.5 }}
            />
            <Badge
              badgeContent={casesRemaining > 0 ? casesRemaining : null}
              color="error"
              max={9999}
            >
              <Chip
                icon={<InventoryIcon />}
                label={casesRemaining > 0 ? `${casesRemaining} case${casesRemaining !== 1 ? "s" : ""} ready to open` : "No cases — buy some below"}
                color={casesRemaining > 0 ? "success" : "default"}
                variant={casesRemaining > 0 ? "filled" : "outlined"}
                sx={{ fontSize: "1rem", px: 1, py: 2.5 }}
              />
            </Badge>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* Spinner */}
          {(spinning || showResult) && targetItem && (
            <Box sx={{ mb: 4 }}>
              <CaseSpinner
                items={items}
                targetItem={targetItem}
                spinning={spinning}
                onComplete={handleSpinComplete}
                speed={doubleSpeed ? 2 : 1}
                muted={muted}
              />
            </Box>
          )}

          {/* Result card */}
          {showResult && lastWon && (
            <Box
              sx={{
                textAlign: "center",
                p: 3,
                borderRadius: 3,
                border: `2px solid ${RARITY_COLORS[lastWon.rarity as Rarity]}`,
                boxShadow: `0 0 24px ${RARITY_COLORS[lastWon.rarity as Rarity]}44`,
                mb: 4,
                bgcolor: "#f8fbff",
              }}
            >
              <Typography variant="h6" fontWeight={700} gutterBottom>
                You got:
              </Typography>
              <ItemCard item={lastWon} size="lg" showPrice />
              <Chip
                label={lastWon.rarity}
                sx={{
                  mt: 1,
                  bgcolor: RARITY_COLORS[lastWon.rarity as Rarity],
                  color: "#fff",
                  fontWeight: 700,
                }}
              />
              <Box sx={{ display: "flex", gap: 2, justifyContent: "center", mt: 3 }}>
                <Button
                  variant="outlined"
                  component={NextLink}
                  href={`/user/${user.username}`}
                >
                  View Inventory
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSpinAgain}
                  disabled={(user.cases_remaining ?? 0) < 1}
                >
                  {(user.cases_remaining ?? 0) > 0
                    ? `Spin Again (${user.cases_remaining} left)`
                    : "No cases left"}
                </Button>
              </Box>
            </Box>
          )}

          {/* Spin button — shown when not spinning and no result showing */}
          {!spinning && !showResult && (
            <Box textAlign="center" sx={{ mb: 5 }}>
              <Button
                variant="contained"
                size="large"
                onClick={handleSpin}
                disabled={casesRemaining < 1 || spinLoading}
                sx={{ px: 6, py: 1.5, fontSize: "1.1rem" }}
              >
                {spinLoading
                  ? "Opening..."
                  : casesRemaining > 0
                  ? `Open a Case (${casesRemaining} remaining)`
                  : "Buy Cases Below to Spin"}
              </Button>
              <Box sx={{ mt: 1.5, display: "flex", justifyContent: "center" }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={doubleSpeed}
                      onChange={toggleDoubleSpeed}
                      size="small"
                      color="warning"
                    />
                  }
                  label={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <SpeedIcon fontSize="small" sx={{ color: doubleSpeed ? "warning.main" : "text.secondary" }} />
                      <Typography variant="body2" color={doubleSpeed ? "warning.main" : "text.secondary"} fontWeight={doubleSpeed ? 700 : 400}>
                        2x Speed
                      </Typography>
                    </Box>
                  }
                />
              </Box>
            </Box>
          )}

          <Divider sx={{ mb: 4 }} />

          {/* Buy cases section */}
          <Typography variant="h6" fontWeight={700} gutterBottom textAlign="center">
            Buy Cases
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
            Cases are added to your account. Each spin uses 1 case and wins 1 item.
          </Typography>

          <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mb: 3, flexWrap: "wrap" }}>
            {casePrices.map((preset) => (
              <Card
                key={preset.qty}
                onClick={() => !buyLoading && setSelectedQty(preset.qty)}
                sx={{
                  cursor: buyLoading ? "not-allowed" : "pointer",
                  border: selectedQty === preset.qty ? "2px solid #1976d2" : "2px solid transparent",
                  boxShadow: selectedQty === preset.qty ? "0 0 12px #1976d244" : undefined,
                  transition: "all 0.15s",
                  minWidth: 120,
                }}
              >
                <CardContent sx={{ textAlign: "center", py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Typography variant="h5" fontWeight={700} color="primary.main">
                    x{preset.qty}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    ${preset.price}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ${(preset.price / preset.qty).toFixed(4)}/case
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          <Box textAlign="center" sx={{ mb: 6 }}>
            <Button
              variant="outlined"
              size="large"
              startIcon={<ShoppingCartIcon />}
              onClick={handleBuyCases}
              disabled={buyLoading}
              sx={{ px: 5, py: 1.5 }}
            >
              {buyLoading
                ? "Buying..."
                : `Buy x${selectedQty} Cases — $${selectedPrice.price}`}
            </Button>
          </Box>

          {/* Item pool preview */}
          <Divider sx={{ mb: 4 }} />
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Items in Pool
          </Typography>
          <Grid container spacing={2}>
            {items.map((item) => (
              <Grid item key={item.id} xs={6} sm={4} md={3} lg={2}>
                <Box sx={{ textAlign: "center" }}>
                  <ItemCard item={item} size="sm" showPrice />
                  <Typography variant="caption" color="text.secondary">
                    1 in {Math.round(100 / Number(item.likelihood))}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* Insufficient balance modal */}
      <Dialog open={buyModalOpen} onClose={() => setBuyModalOpen(false)}>
        <DialogTitle>Insufficient Balance</DialogTitle>
        <DialogContent>
          <Typography>
            You need ${selectedPrice.price} to buy x{selectedQty} cases. Deposit more funds to continue.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBuyModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            component={NextLink}
            href="/?deposit=1"
            onClick={() => setBuyModalOpen(false)}
          >
            Deposit
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
