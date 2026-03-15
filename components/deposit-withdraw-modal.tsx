"use client"

import { useState } from "react"
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Tabs, Tab, Box, Typography,
  MenuItem, Select, FormControl, InputLabel, CircularProgress,
  Alert, Divider, Chip,
} from "@mui/material"
import Link from "next/link"
import ContentCopyIcon from "@mui/icons-material/ContentCopy"
import { useAuth } from "@/lib/auth-context"
import { ACCEPTED_CRYPTOS } from "@/lib/types"

const CRYPTO_LOGOS: Record<string, string> = {
  BTC: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/bitcoinbtclogo-gR5sveMSBdogiczfVIttQA0i3st3rw.png",
  LTC: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/litecoin-ltc-logo-QSr9ZvLxuAcx08rGnib7e7qZY0Fhao.png",
  SOL: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/solana-sol-logo-q7oh1kxhGFGclcD4nTk1O1TOTuHGu3.png",
  BCH: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/bitcoin-cash-bch-logo-sF2o6xhMfMM99h9vcF0EKoFRcbBlqI.png",
}

interface Props {
  open: boolean
  onClose: () => void
}

const BULK_DEPOSIT_PRESETS = [5, 10, 25, 50, 100]

export default function DepositWithdrawModal({ open, onClose }: Props) {
  const { user, refreshUser } = useAuth()
  const [tab, setTab] = useState(0)

  // Deposit state
  const [depositAmount, setDepositAmount] = useState("")
  const [depositCrypto, setDepositCrypto] = useState("BTC")
  const [depositLoading, setDepositLoading] = useState(false)
  const [depositResult, setDepositResult] = useState<{
    pay_address: string
    pay_amount: number
    pay_currency: string
  } | null>(null)
  const [depositError, setDepositError] = useState("")

  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [withdrawCrypto, setWithdrawCrypto] = useState("BTC")
  const [withdrawWallet, setWithdrawWallet] = useState("")
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [withdrawSuccess, setWithdrawSuccess] = useState(false)
  const [withdrawError, setWithdrawError] = useState("")

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
        body: JSON.stringify({
          user_id: user!.id,
          amount: Number(depositAmount),
          currency: depositCrypto,
        }),
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
    if (!withdrawAmount || Number(withdrawAmount) < 3) {
      setWithdrawError("Minimum withdrawal is $3.00")
      return
    }
    if (!withdrawWallet.trim()) {
      setWithdrawError("Wallet address is required")
      return
    }
    setWithdrawLoading(true)
    try {
      const res = await fetch("/api/payments/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user!.id,
          amount: Number(withdrawAmount),
          crypto: withdrawCrypto,
          wallet_address: withdrawWallet.trim(),
        }),
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

        {tab === 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {BULK_DEPOSIT_PRESETS.map((p) => (
                <Chip
                  key={p}
                  label={`$${p}`}
                  onClick={() => setDepositAmount(String(p))}
                  color={depositAmount === String(p) ? "primary" : "default"}
                  variant={depositAmount === String(p) ? "filled" : "outlined"}
                  sx={{ cursor: "pointer" }}
                />
              ))}
            </Box>
            <TextField
              label="Amount (USD)"
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              inputProps={{ min: 1, step: 0.01 }}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Cryptocurrency</InputLabel>
              <Select
                value={depositCrypto}
                onChange={(e) => setDepositCrypto(e.target.value)}
                label="Cryptocurrency"
              >
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
                  <Typography
                    variant="body2"
                    sx={{ fontFamily: "monospace", wordBreak: "break-all", flex: 1 }}
                  >
                    {depositResult.pay_address}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => navigator.clipboard.writeText(depositResult.pay_address)}
                    startIcon={<ContentCopyIcon fontSize="small" />}
                  >
                    Copy
                  </Button>
                </Box>
                <Alert severity="info" sx={{ mt: 1 }}>
                  Balance will be credited automatically once confirmed.
                </Alert>
              </Box>
            )}
            <Button
              variant="contained"
              onClick={handleDeposit}
              disabled={depositLoading}
              sx={{ display: "flex", gap: 1, alignItems: "center" }}
            >
              {depositLoading && <CircularProgress size={16} sx={{ color: "inherit" }} />}
              {depositLoading ? "Generating..." : "Generate Wallet Address"}
            </Button>
            <Typography variant="caption" color="text.secondary">
              Accepted: {ACCEPTED_CRYPTOS.join(", ")} — more coming soon
            </Typography>
          </Box>
        )}

        {tab === 1 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="Amount (USD)"
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              inputProps={{ min: 1, step: 0.01 }}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Cryptocurrency</InputLabel>
              <Select
                value={withdrawCrypto}
                onChange={(e) => setWithdrawCrypto(e.target.value)}
                label="Cryptocurrency"
              >
                {ACCEPTED_CRYPTOS.map((c) => (
                  <MenuItem key={c} value={c} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box component="img" src={CRYPTO_LOGOS[c]} alt={c} sx={{ width: 24, height: 24, objectFit: "contain" }} />
                    <Typography variant="body2" fontWeight={600}>{c}</Typography>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Your Wallet Address"
              value={withdrawWallet}
              onChange={(e) => setWithdrawWallet(e.target.value)}
              fullWidth
              placeholder={`Your ${withdrawCrypto} address`}
            />
            {withdrawAmount && (
              <Box sx={{ p: 2, bgcolor: "#f8fbff", borderRadius: 2, border: "1px solid #e3f2fd" }}>
                <Typography variant="body2">Amount: <strong>${Number(withdrawAmount).toFixed(2)}</strong></Typography>
                <Typography variant="body2">Fee (5%): <strong>-${fee}</strong></Typography>
                <Divider sx={{ my: 0.5 }} />
                <Typography variant="body2" color="primary.main" fontWeight={700}>
                  You receive: ${net}
                </Typography>
              </Box>
            )}
            {withdrawError && <Alert severity="error">{withdrawError}</Alert>}
            {withdrawSuccess && (
              <Alert severity="success">
                Withdrawal request submitted! Processing is handled manually, usually within 24h.
              </Alert>
            )}
            {withdrawAmount && Number(withdrawAmount) >= 3 && Number(withdrawAmount) <= 5 && !withdrawSuccess && (
              <Alert
                severity="warning"
                icon={false}
                sx={{ alignItems: "flex-start" }}
              >
                Are you sure you want to cash out such a low amount? You won't be gaining much.
                Why not{" "}
                <Link href="/marketplace" onClick={onClose} style={{ color: "inherit", fontWeight: 700 }}>
                  invest it in items
                </Link>{" "}
                instead?
              </Alert>
            )}
            <Button
              variant="contained"
              onClick={handleWithdraw}
              disabled={withdrawLoading}
              sx={{ display: "flex", gap: 1, alignItems: "center" }}
            >
              {withdrawLoading && <CircularProgress size={16} sx={{ color: "inherit" }} />}
              {withdrawLoading ? "Submitting..." : "Request Withdrawal"}
            </Button>
            <Typography variant="caption" color="text.secondary">
              5% fee on withdrawals. Processed manually by the team.
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
