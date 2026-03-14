"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Container, Box, Typography, Button, Grid, Card, CardContent,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, ButtonGroup, Divider,
} from "@mui/material"
import LockIcon from "@mui/icons-material/Lock"
import { useAuth } from "@/lib/auth-context"
import CaseSpinner from "@/components/case-spinner"
import Confetti from "@/components/confetti"
import ItemCard from "@/components/item-card"
import type { Item, Rarity } from "@/lib/types"
import { RARITY_COLORS, CASE_PRICES } from "@/lib/types"
import NextLink from "next/link"

const CONFETTI_RARITIES: Rarity[] = ["Rare", "Legendary", "Omega"]
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
  const [items, setItems] = useState<Item[]>([])
  const [selectedQty, setSelectedQty] = useState<number>(10)
  const [spinning, setSpinning] = useState(false)
  const [wonItems, setWonItems] = useState<Item[]>([])
  const [currentTarget, setCurrentTarget] = useState<Item | null>(null)
  const [spinIndex, setSpinIndex] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [lastWon, setLastWon] = useState<Item | null>(null)
  const [confettiActive, setConfettiActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [buyModalOpen, setBuyModalOpen] = useState(false)

  useEffect(() => {
    fetch("/api/admin/items").then((r) => r.json()).then(setItems)
  }, [])

  const selectedPrice = CASE_PRICES.find((p) => p.qty === selectedQty)!

  const startOpenSession = async () => {
    if (!user) return
    if (Number(user.balance) < selectedPrice.price) {
      setBuyModalOpen(true)
      return
    }
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/cases/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, qty: selectedQty }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 402) { setBuyModalOpen(true); return }
        throw new Error(data.error || "Failed")
      }
      await refreshUser()
      setWonItems(data.wonItems)
      setSpinIndex(0)
      setCurrentTarget(data.wonItems[0])
      setSpinning(true)
      setShowResult(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSpinComplete = useCallback(() => {
    const item = wonItems[spinIndex]
    setLastWon(item)
    setShowResult(true)
    setSpinning(false)

    if (CONFETTI_RARITIES.includes(item.rarity as Rarity)) {
      setConfettiActive(true)
      playSound(CONFETTI_SRC)
      playSound(BORING_SRC)
      setTimeout(() => setConfettiActive(false), 6000)
    } else {
      playSound(BORING_SRC)
    }
  }, [wonItems, spinIndex])

  const handleSpinAgain = () => {
    const next = spinIndex + 1
    if (next >= wonItems.length) return
    setSpinIndex(next)
    setCurrentTarget(wonItems[next])
    setShowResult(false)
    setSpinning(true)
  }

  const cost = selectedPrice.price
  const canSpinAgain = spinIndex < wonItems.length - 1

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
          {/* Quantity selector */}
          <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mb: 4, flexWrap: "wrap" }}>
            {CASE_PRICES.map((preset) => (
              <Card
                key={preset.qty}
                onClick={() => !spinning && setSelectedQty(preset.qty)}
                sx={{
                  cursor: spinning ? "not-allowed" : "pointer",
                  border: selectedQty === preset.qty ? "2px solid #1976d2" : "2px solid transparent",
                  boxShadow: selectedQty === preset.qty ? "0 0 12px #1976d244" : undefined,
                  transition: "all 0.15s",
                  minWidth: 110,
                }}
              >
                <CardContent sx={{ textAlign: "center", py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Typography variant="h5" fontWeight={700} color="primary.main">
                    x{preset.qty}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ${preset.price}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          {/* Balance check */}
          <Box textAlign="center" sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Balance: <strong>${Number(user.balance).toFixed(2)}</strong> &nbsp;|&nbsp; Cost:{" "}
              <strong>${cost}</strong>
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* Spinner */}
          {(spinning || showResult) && currentTarget && (
            <Box sx={{ mb: 4 }}>
              <CaseSpinner
                items={items}
                targetItem={currentTarget}
                spinning={spinning}
                onComplete={handleSpinComplete}
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
                  disabled={!canSpinAgain}
                >
                  {canSpinAgain ? `Spin Again (${wonItems.length - spinIndex - 1} left)` : "No cases left"}
                </Button>
              </Box>
            </Box>
          )}

          {/* Open button */}
          {!spinning && !showResult && (
            <Box textAlign="center">
              <Button
                variant="contained"
                size="large"
                onClick={startOpenSession}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={18} /> : null}
                sx={{ px: 6, py: 1.5, fontSize: "1.1rem" }}
              >
                {loading ? "Opening..." : `Open x${selectedQty} Cases — $${cost}`}
              </Button>
            </Box>
          )}

          {/* Item pool preview */}
          <Divider sx={{ my: 4 }} />
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

      {/* Buy more modal */}
      <Dialog open={buyModalOpen} onClose={() => setBuyModalOpen(false)}>
        <DialogTitle>Insufficient Balance</DialogTitle>
        <DialogContent>
          <Typography>
            You need ${cost} to open x{selectedQty} cases. Deposit more funds to continue.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBuyModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => { setBuyModalOpen(false); }}
            component={NextLink}
            href="/?deposit=1"
          >
            Deposit
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
