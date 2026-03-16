"use client"
// v2
import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Tabs, Tab, Box, Typography,
  MenuItem, Select, FormControl, InputLabel, CircularProgress,
  Alert, Divider, Chip, ToggleButton, ToggleButtonGroup,
} from "@mui/material"
import Link from "next/link"
import ContentCopyIcon from "@mui/icons-material/ContentCopy"
import QrCode2Icon from "@mui/icons-material/QrCode2"
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard"
import { useAuth } from "@/lib/auth-context"
import { ACCEPTED_CRYPTOS } from "@/lib/types"

const QRCodeSVG = dynamic(() => import("qrcode.react").then((m) => m.QRCodeSVG), { ssr: false })

const CRYPTO_LOGOS: Record<string, string> = {
  BTC: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/bitcoinbtclogo-gR5sveMSBdogiczfVIttQA0i3st3rw.png",
  LTC: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/litecoin-ltc-logo-QSr9ZvLxuAcx08rGnib7e7qZY0Fhao.png",
  SOL: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/solana-sol-logo-q7oh1kxhGFGclcD4nTk1O1TOTuHGu3.png",
  BCH: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/bitcoin-cash-bch-logo-sF2o6xhMfMM99h9vcF0EKoFRcbBlqI.png",
}

const GIFTCARD_OPTIONS = [
  {
    id: "apple",
    label: "Apple Gift Card",
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-4M8hfftlQRiF0D5HbGBpsQXzrUFnAY.png",
  },
  {
    id: "googleplay",
    label: "Google Play Gift Card",
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-T1aUnzr7ks3dgdhlIzVGzqb73TOIaT.png",
  },
]

const GIFTCARD_AMOUNTS = [10, 20]
const BULK_DEPOSIT_PRESETS = [5, 10, 25, 50, 100]

interface Props {
  open: boolean
  onClose: () => void
}

export default function DepositWithdrawModal({ open, onClose }: Props) {
  const { user, refreshUser } = useAuth()
  const [tab, setTab] = useState(0)
  const [withdrawMode, setWithdrawMode] = useState<"crypto" | "giftcard">("crypto")

  // Deposit state
  const [depositAmount, setDepositAmount] = useState("")
  const [depositCrypto, setDepositCrypto] = useState("BTC")
  const [depositLoading, setDepositLoading] = useState(false)
  const [depositResult, setDepositResult] = useState<{
    payment_id: string | number
    pay_address: string
    pay_amount: number
    pay_currency: string
  } | null>(null)
  const [depositError, setDepositError] = useState("")
  const [pollStatus, setPollStatus] = useState<"waiting" | "confirming" | "confirmed" | "failed" | "expired">("waiting")
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!depositResult?.payment_id) return
    setPollStatus("waiting")
    const poll = async () => {
      try {
        const res = await fetch(`/api/payments/status/${depositResult.payment_id}`)
        const data = await res.json()
        if (data.status) setPollStatus(data.status as any)
        if (data.terminal) {
          clearInterval(pollRef.current!)
          pollRef.current = null
          if (data.status === "confirmed" || data.already_confirmed || data.credited) {
            await refreshUser()
            setTimeout(() => window.location.reload(), 2000)
          }
        }
      } catch {}
    }
    pollRef.current = setInterval(poll, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [depositResult?.payment_id])

  // Crypto withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [withdrawCrypto, setWithdrawCrypto] = useState("BTC")
  const [withdrawWallet, setWithdrawWallet] = useState("")
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [withdrawSuccess, setWithdrawSuccess] = useState(false)
  const [withdrawError, setWithdrawError] = useState("")

  // Gift card withdraw state
  const [gcType, setGcType] = useState<"apple" | "googleplay">("apple")
  const [gcAmount, setGcAmount] = useState<10 | 20>(10)
  const [gcEmail, setGcEmail] = useState("")
  const [gcLoading, setGcLoading] = useState(false)
  const [gcSuccess, setGcSuccess] = useState(false)
  const [gcError, setGcError] = useState("")

  const handleDeposit = async () => {
    setDepositError("")
    setDepositResult(null)
    if (!depositAmount || Number(depositAmount) < 1) {
      setDepositError("Minimum deposit is $1.00")
      return
    }
    setDepositLoading(true)
    try {
      const res = await fetch("/api/payments/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user!.id, amount: Number(depositAmount), currency: depositCrypto }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create payment")
      setDepositResult(data)
    } catch (e: any) {
      setDepositError(e.message)
    } finally {
      setDepositLoading(false)
    }
  }

  const handleWithdraw = async () => {
    setWithdrawError("")
    setWithdrawSuccess(false)
    if (!withdrawAmount || Number(withdrawAmount) < 3) { setWithdrawError("Minimum withdrawal is $3.00"); return }
    if (!withdrawWallet.trim()) { setWithdrawError("Wallet address is required"); return }
    setWithdrawLoading(true)
    try {
      const res = await fetch("/api/payments/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user!.id, amount: Number(withdrawAmount), crypto: withdrawCrypto, wallet_address: withdrawWallet.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setWithdrawSuccess(true)
      await refreshUser()
    } catch (e: any) {
      setWithdrawError(e.message)
    } finally {
      setWithdrawLoading(false)
    }
  }

  const handleGiftCard = async () => {
    setGcError("")
    setGcSuccess(false)
    if (!gcEmail.trim() || !gcEmail.includes("@")) { setGcError("Please enter a valid email address"); return }
    if (Number(user?.balance) < gcAmount) { setGcError("Insufficient balance"); return }
    setGcLoading(true)
    try {
      const res = await fetch("/api/payments/withdraw-giftcard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user!.id, gc_type: gcType, amount: gcAmount, email: gcEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setGcSuccess(true)
      await refreshUser()
    } catch (e: any) {
      setGcError(e.message)
    } finally {
      setGcLoading(false)
    }
  }

  const fee = withdrawAmount ? (Number(withdrawAmount) * 0.05).toFixed(2) : "0.00"
  const net = withdrawAmount ? (Number(withdrawAmount) * 0.95).toFixed(2) : "0.00"

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Wallet</DialogTitle>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 3 }}>
        <Tab label="Deposit" />
        <Tab label="Withdraw" />
      </Tabs>
      <DialogContent>
        {user && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Current balance: <strong>${Number(user.balance).toFixed(2)}</strong>
          </Typography>
        )}

        {/* DEPOSIT TAB */}
        {tab === 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {BULK_DEPOSIT_PRESETS.map((p) => (
                <Chip key={p} label={`$${p}`} onClick={() => setDepositAmount(String(p))}
                  color={depositAmount === String(p) ? "primary" : "default"}
                  variant={depositAmount === String(p) ? "filled" : "outlined"}
                  sx={{ cursor: "pointer" }} />
              ))}
            </Box>
            <TextField label="Amount (USD)" type="number" value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              inputProps={{ min: 1, step: 0.01 }} fullWidth />
            <FormControl fullWidth>
              <InputLabel>Cryptocurrency</InputLabel>
              <Select value={depositCrypto} onChange={(e) => setDepositCrypto(e.target.value)} label="Cryptocurrency">
                {ACCEPTED_CRYPTOS.map((c) => (
                  <MenuItem key={c} value={c} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box component="img" src={CRYPTO_LOGOS[c]} alt={c} sx={{ width: 24, height: 24, objectFit: "contain" }} />
                    <Typography variant="body2" fontWeight={600}>{c}</Typography>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {depositError && <Alert severity="error">{depositError}</Alert>}
            {depositResult && (
              <Box sx={{ p: 2, bgcolor: "#e3f2fd", borderRadius: 2 }}>
                <Typography variant="body2" fontWeight={600} gutterBottom>
                  Send exactly {depositResult.pay_amount} {depositResult.pay_currency.toUpperCase()} to:
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all", flex: 1 }}>
                    {depositResult.pay_address}
                  </Typography>
                  <Button size="small" onClick={() => navigator.clipboard.writeText(depositResult.pay_address)}
                    startIcon={<ContentCopyIcon fontSize="small" />}>Copy</Button>
                </Box>
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mt: 2, mb: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
                    <QrCode2Icon fontSize="small" color="primary" />
                    <Typography variant="caption" fontWeight={600} color="primary.main">Scan to pay</Typography>
                  </Box>
                  <Box sx={{ bgcolor: "#fff", p: 1.5, borderRadius: 2, border: "1px solid #90caf9", display: "inline-block" }}>
                    <QRCodeSVG value={depositResult.pay_address} size={160} level="M" includeMargin={false} />
                  </Box>
                </Box>
                <Alert severity="info" sx={{ mt: 1 }}>Balance will be credited automatically once confirmed on-chain.</Alert>
                {pollStatus === "confirmed" ? (
                  <Alert severity="success" sx={{ mt: 1 }}>Payment confirmed! Your balance has been updated.</Alert>
                ) : pollStatus === "failed" || pollStatus === "expired" ? (
                  <Alert severity="error" sx={{ mt: 1 }}>Payment {pollStatus}. Please try again or contact support.</Alert>
                ) : (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                    <CircularProgress size={14} />
                    <Typography variant="caption" color="text.secondary">
                      Checking payment status every 3s... ({pollStatus})
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
            <Button variant="contained" onClick={handleDeposit} disabled={depositLoading}
              sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              {depositLoading && <CircularProgress size={16} sx={{ color: "inherit" }} />}
              {depositLoading ? "Generating..." : "Generate Wallet Address"}
            </Button>
            <Typography variant="caption" color="text.secondary">
              Accepted: {ACCEPTED_CRYPTOS.join(", ")} — more coming soon
            </Typography>
          </Box>
        )}

        {/* WITHDRAW TAB */}
        {tab === 1 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <ToggleButtonGroup
              value={withdrawMode}
              exclusive
              onChange={(_, v) => { if (v) setWithdrawMode(v) }}
              size="small"
              fullWidth
            >
              <ToggleButton value="crypto" sx={{ fontWeight: 600 }}>
                Cryptocurrency
              </ToggleButton>
              <ToggleButton value="giftcard" sx={{ fontWeight: 600, gap: 1 }}>
                <CardGiftcardIcon fontSize="small" />
                Gift Card
              </ToggleButton>
            </ToggleButtonGroup>

            {/* CRYPTO WITHDRAW */}
            {withdrawMode === "crypto" && (
              <>
                <TextField label="Amount (USD)" type="number" value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  inputProps={{ min: 1, step: 0.01 }} fullWidth />
                <FormControl fullWidth>
                  <InputLabel>Cryptocurrency</InputLabel>
                  <Select value={withdrawCrypto} onChange={(e) => setWithdrawCrypto(e.target.value)} label="Cryptocurrency">
                    {ACCEPTED_CRYPTOS.map((c) => (
                      <MenuItem key={c} value={c} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box component="img" src={CRYPTO_LOGOS[c]} alt={c} sx={{ width: 24, height: 24, objectFit: "contain" }} />
                        <Typography variant="body2" fontWeight={600}>{c}</Typography>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField label="Your Wallet Address" value={withdrawWallet}
                  onChange={(e) => setWithdrawWallet(e.target.value)}
                  fullWidth placeholder={`Your ${withdrawCrypto} address`} />
                {withdrawAmount && (
                  <Box sx={{ p: 2, bgcolor: "#f8fbff", borderRadius: 2, border: "1px solid #e3f2fd" }}>
                    <Typography variant="body2">Amount: <strong>${Number(withdrawAmount).toFixed(2)}</strong></Typography>
                    <Typography variant="body2">Fee (5%): <strong>-${fee}</strong></Typography>
                    <Divider sx={{ my: 0.5 }} />
                    <Typography variant="body2" color="primary.main" fontWeight={700}>You receive: ${net}</Typography>
                  </Box>
                )}
                {withdrawError && <Alert severity="error">{withdrawError}</Alert>}
                {withdrawSuccess && (
                  <Alert severity="success">Withdrawal request submitted! Processing is handled manually, usually within 24h.</Alert>
                )}
                {withdrawAmount && Number(withdrawAmount) >= 3 && Number(withdrawAmount) <= 5 && !withdrawSuccess && (
                  <Alert severity="warning" icon={false} sx={{ alignItems: "flex-start" }}>
                    Are you sure you want to cash out such a low amount? Why not{" "}
                    <Link href="/marketplace" onClick={onClose} style={{ color: "inherit", fontWeight: 700 }}>
                      invest it in items
                    </Link>{" "}instead?
                  </Alert>
                )}
                <Button variant="contained" onClick={handleWithdraw} disabled={withdrawLoading}
                  sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  {withdrawLoading && <CircularProgress size={16} sx={{ color: "inherit" }} />}
                  {withdrawLoading ? "Submitting..." : "Request Withdrawal"}
                </Button>
                <Typography variant="caption" color="text.secondary">
                  5% fee on withdrawals. Processed manually by the team.
                </Typography>
              </>
            )}

            {/* GIFT CARD WITHDRAW */}
            {withdrawMode === "giftcard" && (
              <>
                <Alert severity="info" icon={<CardGiftcardIcon fontSize="small" />}>
                  Gift cards are delivered to your email within <strong>up to 3 days</strong> after request.
                </Alert>

                <Typography variant="body2" fontWeight={600}>Select Gift Card</Typography>
                <Box sx={{ display: "flex", gap: 2 }}>
                  {GIFTCARD_OPTIONS.map((gc) => (
                    <Box
                      key={gc.id}
                      onClick={() => setGcType(gc.id as any)}
                      sx={{
                        flex: 1, cursor: "pointer", borderRadius: 2, overflow: "hidden",
                        border: gcType === gc.id ? "2px solid #1976d2" : "2px solid #e0e0e0",
                        transition: "border-color 0.15s",
                        "&:hover": { borderColor: "#1976d2" },
                      }}
                    >
                      <Box component="img" src={gc.image} alt={gc.label}
                        sx={{ width: "100%", height: 90, objectFit: "cover", display: "block" }} />
                      <Typography variant="caption" fontWeight={600} display="block"
                        textAlign="center" sx={{ py: 0.75, bgcolor: gcType === gc.id ? "#e3f2fd" : "#fafafa" }}>
                        {gc.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                <Typography variant="body2" fontWeight={600}>Select Amount</Typography>
                <Box sx={{ display: "flex", gap: 1 }}>
                  {GIFTCARD_AMOUNTS.map((a) => (
                    <Chip key={a} label={`$${a}`} onClick={() => setGcAmount(a as any)}
                      color={gcAmount === a ? "primary" : "default"}
                      variant={gcAmount === a ? "filled" : "outlined"}
                      sx={{ cursor: "pointer", fontWeight: 700, fontSize: "0.95rem", px: 2, height: 36 }} />
                  ))}
                </Box>

                <TextField label="Email address" type="email" value={gcEmail}
                  onChange={(e) => setGcEmail(e.target.value)}
                  fullWidth placeholder="you@example.com"
                  helperText="The gift card will be sent to this email" />

                <Box sx={{ p: 2, bgcolor: "#f8fbff", borderRadius: 2, border: "1px solid #e3f2fd" }}>
                  <Typography variant="body2">
                    Card: <strong>{GIFTCARD_OPTIONS.find(g => g.id === gcType)?.label}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Amount: <strong>${gcAmount}.00</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: "0.75rem" }}>
                    No fee on gift cards. Balance deducted immediately.
                  </Typography>
                </Box>

                {gcError && <Alert severity="error">{gcError}</Alert>}
                {gcSuccess && (
                  <Alert severity="success">
                    Gift card request submitted! You'll receive it at <strong>{gcEmail}</strong> within up to 3 days.
                  </Alert>
                )}

                <Button variant="contained" onClick={handleGiftCard} disabled={gcLoading}
                  sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  {gcLoading && <CircularProgress size={16} sx={{ color: "inherit" }} />}
                  {gcLoading ? "Submitting..." : `Request $${gcAmount} Gift Card`}
                </Button>
              </>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
