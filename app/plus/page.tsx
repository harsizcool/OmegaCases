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
import CheckCircleIcon from "@mui/icons-material/CheckCircle"
import SpeedIcon from "@mui/icons-material/Speed"
import PaletteIcon from "@mui/icons-material/Palette"
import ApiIcon from "@mui/icons-material/Api"
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet"
import StarIcon from "@mui/icons-material/Star"
import CasinoIcon from "@mui/icons-material/Casino"
import LockOpenIcon from "@mui/icons-material/LockOpen"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"

const PLUS_PRICE = 4.99
const PLUS_COLOR = "#f59e0b"
const PLUS_GLOW = "0 0 24px #f59e0b66"

const BENEFITS = [
  {
    icon: <CasinoIcon />,
    title: "250 Free Spins on purchase",
    desc: "Instantly credited to your account the moment you buy Plus.",
    highlight: true,
  },
  {
    icon: <SpeedIcon />,
    title: "3x Faster Spin Speed",
    desc: "Case animations run at triple speed — open cases faster than ever.",
  },
  {
    icon: <StarIcon />,
    title: "Plus Badge Everywhere",
    desc: "A golden Plus icon appears next to your name on leaderboards, search results, trades, and profile pages.",
  },
  {
    icon: <AccountBalanceWalletIcon />,
    title: "More Withdrawal Options",
    desc: "Unlock PayPal (min $10), Xbox Gift Cards, and PlayStation Gift Cards as withdrawal methods.",
  },
  {
    icon: <PaletteIcon />,
    title: "Dark Mode",
    desc: "Switch the entire site between light and dark themes in Settings.",
  },
  {
    icon: <ApiIcon />,
    title: "API Access",
    desc: "Access developer API documentation to fetch item data, rolls, and more programmatically.",
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
    <Container maxWidth="sm" sx={{ py: 6 }}>
      {/* Header */}
      <Box sx={{ textAlign: "center", mb: 5 }}>
        <Box
          component="img"
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/OmegaCases%20Plus-l4Y0s1RZoFE6qYuGtIWUKCXNP7jTq1.webp"
          alt="OmegaCases Plus"
          sx={{ width: 96, height: 96, mb: 2, filter: `drop-shadow(${PLUS_GLOW})` }}
        />
        <Typography variant="h3" fontWeight={900} sx={{ color: PLUS_COLOR, letterSpacing: -1 }}>
          OmegaCases Plus
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mt: 1 }}>
          One-time upgrade. Permanent perks.
        </Typography>
      </Box>

      {/* Already Plus banner */}
      {alreadyPlus && (
        <Alert
          severity="success"
          icon={<WorkspacePremiumIcon sx={{ color: PLUS_COLOR }} />}
          sx={{
            mb: 4,
            bgcolor: "#fffbeb",
            border: `1px solid ${PLUS_COLOR}`,
            "& .MuiAlert-icon": { color: PLUS_COLOR },
          }}
        >
          <Typography fontWeight={700}>You already have OmegaCases Plus!</Typography>
          <Typography variant="body2">All perks are active on your account. Enjoy the benefits.</Typography>
        </Alert>
      )}

      {/* Success banner */}
      {success && (
        <Alert severity="success" sx={{ mb: 4 }}>
          <Typography fontWeight={700}>Welcome to OmegaCases Plus!</Typography>
          <Typography variant="body2">250 free spins have been added to your account. Enjoy all your new perks!</Typography>
        </Alert>
      )}

      {/* Benefits list */}
      <Paper
        elevation={0}
        sx={{
          border: `2px solid ${PLUS_COLOR}`,
          borderRadius: 3,
          overflow: "hidden",
          boxShadow: PLUS_GLOW,
          mb: 4,
        }}
      >
        <Box sx={{ bgcolor: PLUS_COLOR, px: 3, py: 2 }}>
          <Typography variant="h6" fontWeight={800} color="#fff">
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
                  py: 1.75,
                  bgcolor: b.highlight ? "#fffbeb" : "transparent",
                  ...(b.highlight && { borderLeft: `3px solid ${PLUS_COLOR}` }),
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: PLUS_COLOR,
                    "& svg": {
                      filter: `drop-shadow(0 0 4px ${PLUS_COLOR}88)`,
                    },
                  }}
                >
                  {b.icon}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography fontWeight={700} variant="body2">{b.title}</Typography>
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
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="h4" fontWeight={900} sx={{ color: PLUS_COLOR, mb: 1 }}>
            $4.99
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            One-time payment from your OmegaCases balance. No subscriptions, ever.
          </Typography>
          {!user ? (
            <Button
              variant="contained"
              size="large"
              component={NextLink}
              href="/login"
              startIcon={<WorkspacePremiumIcon />}
              sx={{
                bgcolor: PLUS_COLOR,
                "&:hover": { bgcolor: "#d97706" },
                fontWeight: 800,
                fontSize: "1rem",
                px: 4,
                boxShadow: PLUS_GLOW,
              }}
            >
              Login to Buy Plus
            </Button>
          ) : (
            <Button
              variant="contained"
              size="large"
              onClick={() => { setError(""); setConfirmOpen(true) }}
              startIcon={<WorkspacePremiumIcon />}
              sx={{
                bgcolor: PLUS_COLOR,
                "&:hover": { bgcolor: "#d97706" },
                fontWeight: 800,
                fontSize: "1rem",
                px: 4,
                boxShadow: PLUS_GLOW,
              }}
            >
              Get Plus for $4.99
            </Button>
          )}
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1.5 }}>
            Current balance: <strong>${Number(user?.balance ?? 0).toFixed(2)}</strong>
            {user && Number(user.balance) < PLUS_PRICE && (
              <> — <Typography component="span" variant="caption" color="error.main" fontWeight={700}>Insufficient balance</Typography></>
            )}
          </Typography>
        </Box>
      )}

      {/* API docs link for Plus members */}
      {alreadyPlus && (
        <Box sx={{ textAlign: "center", mt: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ApiIcon />}
            component={NextLink}
            href="/plus/docs"
            sx={{ borderColor: PLUS_COLOR, color: PLUS_COLOR, "&:hover": { borderColor: "#d97706", bgcolor: "#fffbeb" } }}
          >
            View API Documentation
          </Button>
        </Box>
      )}

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onClose={() => !buying && setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
          <WorkspacePremiumIcon sx={{ color: PLUS_COLOR }} />
          Confirm Purchase
        </DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Are you sure you want to buy <strong>OmegaCases Plus</strong> for{" "}
            <strong style={{ color: PLUS_COLOR }}>$4.99</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            This will be deducted from your balance. This is a one-time purchase and cannot be refunded.
          </Typography>
          <Box sx={{ p: 2, bgcolor: "#fffbeb", borderRadius: 2, border: `1px solid ${PLUS_COLOR}44`, mt: 1 }}>
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
