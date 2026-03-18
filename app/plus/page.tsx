"use client"

import { useState } from "react"
import NextLink from "next/link"
import {
  Container, Box, Typography, Button, Paper, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, CircularProgress, Divider, List, ListItem,
  ListItemIcon, ListItemText,
} from "@mui/material"
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium"
import SpeedIcon from "@mui/icons-material/Speed"
import PaletteIcon from "@mui/icons-material/Palette"
import ApiIcon from "@mui/icons-material/Api"
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet"
import StarIcon from "@mui/icons-material/Star"
import CasinoIcon from "@mui/icons-material/Casino"
import LockOpenIcon from "@mui/icons-material/LockOpen"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"

const PLUS_PRICE = 2.99
const PLUS_COLOR = "#f59e0b"

const BENEFITS = [
  {
    icon: <CasinoIcon />,
    title: "250 free spins right away",
    desc: "They land in your account the second you buy. No waiting.",
    highlight: true,
  },
  {
    icon: <SpeedIcon />,
    title: "3x spin speed",
    desc: "Cases animate at triple speed. Opens way faster.",
  },
  {
    icon: <StarIcon />,
    title: "Plus badge on your profile",
    desc: "Shows up next to your name on the leaderboard, search, trades, and your profile page.",
  },
  {
    icon: <AccountBalanceWalletIcon />,
    title: "More ways to cash out",
    desc: "Unlock PayPal (min $10), Xbox Gift Cards, and PlayStation Gift Cards as withdrawal options.",
  },
  {
    icon: <PaletteIcon />,
    title: "Dark mode",
    desc: "Flip the whole site to dark in Settings. Your call.",
  },
  {
    icon: <ApiIcon />,
    title: "API access",
    desc: "Grab item data, roll history, and more via our developer API. Docs at /plus/docs.",
  },
]

export default function PlusPage() {
  const { user, refreshUser } = useAuth()
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [buying, setBuying] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleBuy = async () => {
    if (!user) { router.push("/login"); return }
    setBuying(true)
    setError("")
    try {
      const res = await fetch("/api/plus/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || "Something went wrong."); return }
      await refreshUser()
      setSuccess(true)
      setConfirmOpen(false)
    } catch {
      setError("An unexpected error occurred.")
    } finally {
      setBuying(false)
    }
  }

  const alreadyPlus = user?.plus

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
        <Box
          component="img"
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/OmegaCases%20Plus-l4Y0s1RZoFE6qYuGtIWUKCXNP7jTq1.webp"
          alt="OmegaCases Plus"
          sx={{ width: 56, height: 56 }}
        />
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ color: PLUS_COLOR, lineHeight: 1.1 }}>
            OmegaCases Plus
          </Typography>
          <Typography variant="body2" color="text.secondary">
            One-time payment. Keeps forever.
          </Typography>
        </Box>
      </Box>

      {/* Already Plus */}
      {alreadyPlus && (
        <Alert
          severity="success"
          icon={<WorkspacePremiumIcon />}
          sx={{ mb: 3, borderRadius: 1 }}
        >
          <Typography fontWeight={700}>You already have Plus — nice.</Typography>
          <Typography variant="body2">Everything below is already active on your account.</Typography>
        </Alert>
      )}

      {/* Success */}
      {success && (
        <Alert severity="success" sx={{ mb: 3, borderRadius: 1 }}>
          <Typography fontWeight={700}>You're in!</Typography>
          <Typography variant="body2">250 spins added. All Plus perks are now active.</Typography>
        </Alert>
      )}

      {/* Benefits */}
      <Paper
        elevation={0}
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          overflow: "hidden",
          mb: 4,
        }}
      >
        <Box sx={{ bgcolor: PLUS_COLOR, px: 3, py: 1.75 }}>
          <Typography variant="subtitle1" fontWeight={700} color="#fff">
            What you get
          </Typography>
        </Box>
        <List disablePadding>
          {BENEFITS.map((b, i) => (
            <Box key={i}>
              {i > 0 && <Divider />}
              <ListItem
                sx={{
                  px: 3,
                  py: 1.5,
                  bgcolor: b.highlight ? "#fffbeb" : "transparent",
                }}
              >
                <ListItemIcon sx={{ minWidth: 38, color: PLUS_COLOR }}>
                  {b.icon}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography fontWeight={600} variant="body2">{b.title}</Typography>
                      {b.highlight && (
                        <Chip
                          label="Instant"
                          size="small"
                          sx={{ bgcolor: PLUS_COLOR, color: "#fff", height: 18, fontSize: "0.6rem", "& .MuiChip-label": { px: 0.75 } }}
                        />
                      )}
                    </Box>
                  }
                  secondary={b.desc}
                />
              </ListItem>
            </Box>
          ))}
        </List>
      </Paper>

      {/* Price + CTA */}
      {!alreadyPlus && (
        <Box>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, mb: 0.5 }}>
            <Typography variant="h4" fontWeight={800} sx={{ color: PLUS_COLOR }}>
              $4.99
            </Typography>
            <Typography variant="body2" color="text.secondary">one-time, from your balance</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            No subscription. No renewals. Just pay once and it&apos;s yours.
          </Typography>

          {!user ? (
            <Button
              variant="contained"
              component={NextLink}
              href="/login"
              startIcon={<WorkspacePremiumIcon />}
              sx={{ bgcolor: PLUS_COLOR, "&:hover": { bgcolor: "#d97706" }, fontWeight: 700 }}
            >
              Log in to buy Plus
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={() => { setError(""); setConfirmOpen(true) }}
              startIcon={<WorkspacePremiumIcon />}
              sx={{ bgcolor: PLUS_COLOR, "&:hover": { bgcolor: "#d97706" }, fontWeight: 700 }}
            >
              Get Plus — $4.99
            </Button>
          )}

          <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
            Your balance: <strong>${Number(user?.balance ?? 0).toFixed(2)}</strong>
            {user && Number(user.balance) < PLUS_PRICE && (
              <Typography component="span" variant="caption" color="error.main" fontWeight={700}> — not enough balance</Typography>
            )}
          </Typography>
        </Box>
      )}

      {/* API docs link */}
      {alreadyPlus && (
        <Box sx={{ mt: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ApiIcon />}
            component={NextLink}
            href="/plus/docs"
            sx={{ borderColor: PLUS_COLOR, color: PLUS_COLOR, "&:hover": { borderColor: "#d97706", bgcolor: "#fffbeb" }, borderRadius: 1 }}
          >
            API Documentation
          </Button>
        </Box>
      )}

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onClose={() => !buying && setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Buy OmegaCases Plus?
        </DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            <strong>$4.99</strong> will be taken from your balance. This can&apos;t be undone.
          </Typography>
          <Box sx={{ p: 1.5, bgcolor: "#fffbeb", borderRadius: 1, border: "1px solid #f59e0b44", mt: 1 }}>
            <Typography variant="body2">Balance: <strong>${Number(user?.balance ?? 0).toFixed(2)}</strong></Typography>
            <Typography variant="body2">Cost: <strong style={{ color: PLUS_COLOR }}>-$4.99</strong></Typography>
            <Divider sx={{ my: 0.75 }} />
            <Typography variant="body2" fontWeight={700}>
              After: ${Math.max(0, Number(user?.balance ?? 0) - PLUS_PRICE).toFixed(2)}
            </Typography>
          </Box>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} disabled={buying}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleBuy}
            disabled={buying || (user ? Number(user.balance) < PLUS_PRICE : true)}
            startIcon={buying ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : <LockOpenIcon />}
            sx={{ bgcolor: PLUS_COLOR, "&:hover": { bgcolor: "#d97706" }, fontWeight: 700 }}
          >
            {buying ? "Processing..." : "Confirm — $4.99"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
