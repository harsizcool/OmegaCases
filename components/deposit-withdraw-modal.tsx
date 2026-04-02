"use client"

import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { Lock, Copy, QrCode, Gift, Crown, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
  { id: "apple", label: "Apple Gift Card", image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-4M8hfftlQRiF0D5HbGBpsQXzrUFnAY.png" },
  { id: "googleplay", label: "Google Play Gift Card", image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-T1aUnzr7ks3dgdhlIzVGzqb73TOIaT.png" },
]

const GIFTCARD_AMOUNTS = [10, 20]
const BULK_DEPOSIT_PRESETS = [5, 10, 25, 50, 100]

interface Props {
  open: boolean
  onClose: () => void
}

export default function DepositWithdrawModal({ open, onClose }: Props) {
  const { user, refreshUser } = useAuth()

  // Deposit state
  const [depositAmount, setDepositAmount] = useState("")
  const [depositCrypto, setDepositCrypto] = useState("BTC")
  const [depositLoading, setDepositLoading] = useState(false)
  const [depositResult, setDepositResult] = useState<{ payment_id: string | number; pay_address: string; pay_amount: number; pay_currency: string } | null>(null)
  const [depositError, setDepositError] = useState("")
  const [pollStatus, setPollStatus] = useState<"waiting" | "confirming" | "confirmed" | "failed" | "expired">("waiting")
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Crypto withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [withdrawCrypto, setWithdrawCrypto] = useState("BTC")
  const [withdrawWallet, setWithdrawWallet] = useState("")
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [withdrawSuccess, setWithdrawSuccess] = useState(false)
  const [withdrawError, setWithdrawError] = useState("")

  // Gift card state
  const [gcType, setGcType] = useState<"apple" | "googleplay">("apple")
  const [gcAmount, setGcAmount] = useState<10 | 20>(10)
  const [gcEmail, setGcEmail] = useState("")
  const [gcLoading, setGcLoading] = useState(false)
  const [gcSuccess, setGcSuccess] = useState(false)
  const [gcError, setGcError] = useState("")

  // PayPal state
  const [ppEmail, setPpEmail] = useState("")
  const [ppAmount, setPpAmount] = useState("")
  const [ppLoading, setPpLoading] = useState(false)
  const [ppSuccess, setPpSuccess] = useState(false)
  const [ppError, setPpError] = useState("")

  // Xbox state
  const [xboxEmail, setXboxEmail] = useState("")
  const [xboxAmount, setXboxAmount] = useState<25 | 50>(25)
  const [xboxLoading, setXboxLoading] = useState(false)
  const [xboxSuccess, setXboxSuccess] = useState(false)
  const [xboxError, setXboxError] = useState("")

  // PlayStation state
  const [psEmail, setPsEmail] = useState("")
  const [psAmount, setPsAmount] = useState<25 | 50>(25)
  const [psLoading, setPsLoading] = useState(false)
  const [psSuccess, setPsSuccess] = useState(false)
  const [psError, setPsError] = useState("")

  const [withdrawMode, setWithdrawMode] = useState<"crypto" | "giftcard" | "paypal" | "xbox" | "playstation">("crypto")

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

  const handleDeposit = async () => {
    setDepositError("")
    setDepositResult(null)
    if (!depositAmount || Number(depositAmount) < 1) { setDepositError("Minimum deposit is $1.00"); return }
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
    setWithdrawError(""); setWithdrawSuccess(false)
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
    } catch (e: any) { setWithdrawError(e.message) } finally { setWithdrawLoading(false) }
  }

  const handleGiftCard = async () => {
    setGcError(""); setGcSuccess(false)
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
    } catch (e: any) { setGcError(e.message) } finally { setGcLoading(false) }
  }

  const handlePayPal = async () => {
    setPpError(""); setPpSuccess(false)
    if (!ppEmail.includes("@")) { setPpError("Enter a valid PayPal email"); return }
    if (Number(ppAmount) < 10) { setPpError("Minimum PayPal withdrawal is $10.00"); return }
    if (Number(user?.balance) < Number(ppAmount)) { setPpError("Insufficient balance"); return }
    setPpLoading(true)
    try {
      const res = await fetch("/api/payments/withdraw-plus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: user!.id, method: "paypal", amount: Number(ppAmount), email: ppEmail.trim() }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setPpSuccess(true); await refreshUser()
    } catch (e: any) { setPpError(e.message) } finally { setPpLoading(false) }
  }

  const handleXbox = async () => {
    setXboxError(""); setXboxSuccess(false)
    if (!xboxEmail.includes("@")) { setXboxError("Enter a valid email"); return }
    if (Number(user?.balance) < xboxAmount) { setXboxError("Insufficient balance"); return }
    setXboxLoading(true)
    try {
      const res = await fetch("/api/payments/withdraw-plus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: user!.id, method: "xbox", amount: xboxAmount, email: xboxEmail.trim() }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setXboxSuccess(true); await refreshUser()
    } catch (e: any) { setXboxError(e.message) } finally { setXboxLoading(false) }
  }

  const handlePlayStation = async () => {
    setPsError(""); setPsSuccess(false)
    if (!psEmail.includes("@")) { setPsError("Enter a valid email"); return }
    if (Number(user?.balance) < psAmount) { setPsError("Insufficient balance"); return }
    setPsLoading(true)
    try {
      const res = await fetch("/api/payments/withdraw-plus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: user!.id, method: "playstation", amount: psAmount, email: psEmail.trim() }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setPsSuccess(true); await refreshUser()
    } catch (e: any) { setPsError(e.message) } finally { setPsLoading(false) }
  }

  const fee = withdrawAmount ? (Number(withdrawAmount) * 0.05).toFixed(2) : "0.00"
  const net = withdrawAmount ? (Number(withdrawAmount) * 0.95).toFixed(2) : "0.00"

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Wallet</DialogTitle>
        </DialogHeader>

        {user && (
          <p className="text-sm text-muted-foreground -mt-2">
            Current balance: <strong className="text-foreground">${Number(user.balance).toFixed(2)}</strong>
          </p>
        )}

        <Tabs defaultValue="deposit">
          <TabsList className="w-full">
            <TabsTrigger value="deposit" className="flex-1">Deposit</TabsTrigger>
            <TabsTrigger value="withdraw" className="flex-1">Withdraw</TabsTrigger>
          </TabsList>

          {/* DEPOSIT */}
          <TabsContent value="deposit" className="flex flex-col gap-4 mt-4">
            <div className="flex gap-2 flex-wrap">
              {BULK_DEPOSIT_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setDepositAmount(String(p))}
                  className={`px-3 py-1 rounded-full border text-sm font-semibold transition-colors ${depositAmount === String(p) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"}`}
                >
                  ${p}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Amount (USD)</Label>
              <Input type="number" min={1} step={0.01} value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Cryptocurrency</Label>
              <Select value={depositCrypto} onValueChange={setDepositCrypto}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCEPTED_CRYPTOS.map((c) => (
                    <SelectItem key={c} value={c}>
                      <div className="flex items-center gap-2">
                        <img src={CRYPTO_LOGOS[c]} alt={c} className="w-5 h-5 object-contain" />
                        <span className="font-semibold">{c}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {depositError && <Alert variant="destructive"><AlertDescription>{depositError}</AlertDescription></Alert>}

            {depositResult && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg flex flex-col gap-3">
                <p className="text-sm font-semibold">
                  Send exactly {depositResult.pay_amount} {depositResult.pay_currency.toUpperCase()} to:
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono break-all flex-1 bg-background rounded p-1.5">{depositResult.pay_address}</code>
                  <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(depositResult.pay_address)}>
                    <Copy size={14} />
                  </Button>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <QrCode size={14} className="text-primary" />
                    <span className="text-xs font-semibold text-primary">Scan to pay</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-blue-200">
                    <QRCodeSVG value={depositResult.pay_address} size={140} level="M" includeMargin={false} />
                  </div>
                </div>
                <Alert><AlertDescription>Balance will be credited automatically once confirmed on-chain.</AlertDescription></Alert>
                {pollStatus === "confirmed" ? (
                  <Alert><AlertDescription className="text-green-600 font-semibold">Payment confirmed! Your balance has been updated.</AlertDescription></Alert>
                ) : pollStatus === "failed" || pollStatus === "expired" ? (
                  <Alert variant="destructive"><AlertDescription>Payment {pollStatus}. Please try again or contact support.</AlertDescription></Alert>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 size={12} className="animate-spin" />
                    Checking payment status every 3s... ({pollStatus})
                  </div>
                )}
              </div>
            )}

            <Button onClick={handleDeposit} disabled={depositLoading} className="gap-2">
              {depositLoading && <Loader2 size={14} className="animate-spin" />}
              {depositLoading ? "Generating..." : "Generate Wallet Address"}
            </Button>
            <p className="text-xs text-muted-foreground">Accepted: {ACCEPTED_CRYPTOS.join(", ")} — more coming soon</p>
          </TabsContent>

          {/* WITHDRAW */}
          <TabsContent value="withdraw" className="flex flex-col gap-4 mt-4">
            <TooltipProvider>
              <ToggleGroup
                type="single"
                value={withdrawMode}
                onValueChange={(v) => { if (v) setWithdrawMode(v as any) }}
                className="flex flex-wrap gap-1 justify-start"
              >
                <ToggleGroupItem value="crypto" className="text-xs font-semibold">Crypto</ToggleGroupItem>
                <ToggleGroupItem value="giftcard" className="text-xs font-semibold gap-1">
                  <Gift size={12} /> Gift Card
                </ToggleGroupItem>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <ToggleGroupItem value="paypal" disabled={!user?.plus} className="text-xs font-semibold gap-1">
                        <img src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/paypallogo123-G99SStT7wb4CEZz1gGitslbltQ9F6Q.png" alt="PayPal" className="w-4 h-4 object-contain" />
                        PayPal
                        {!user?.plus && <Lock size={11} className="text-muted-foreground" />}
                      </ToggleGroupItem>
                    </span>
                  </TooltipTrigger>
                  {!user?.plus && <TooltipContent>OmegaCases Plus required</TooltipContent>}
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <ToggleGroupItem value="xbox" disabled={!user?.plus} className="text-xs font-semibold gap-1">
                        <img src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-ZTdgmDAPhELRfnlt6bfEGu3OCH5PwV.png" alt="Xbox" className="w-4 h-4 object-contain" />
                        Xbox
                        {!user?.plus && <Lock size={11} className="text-muted-foreground" />}
                      </ToggleGroupItem>
                    </span>
                  </TooltipTrigger>
                  {!user?.plus && <TooltipContent>OmegaCases Plus required</TooltipContent>}
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <ToggleGroupItem value="playstation" disabled={!user?.plus} className="text-xs font-semibold gap-1">
                        <img src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-2QJy6WkSZDAw1CJ1HDB3fdBaR6IHsR.png" alt="PlayStation" className="w-4 h-4 object-contain" />
                        PS Store
                        {!user?.plus && <Lock size={11} className="text-muted-foreground" />}
                      </ToggleGroupItem>
                    </span>
                  </TooltipTrigger>
                  {!user?.plus && <TooltipContent>OmegaCases Plus required</TooltipContent>}
                </Tooltip>
              </ToggleGroup>
            </TooltipProvider>

            {!user?.plus && (
              <Alert>
                <Crown size={14} className="text-amber-500" />
                <AlertDescription>
                  <Link href="/plus" onClick={onClose} className="font-bold text-primary">Get OmegaCases Plus</Link> to unlock PayPal, Xbox, and PlayStation withdrawals.
                </AlertDescription>
              </Alert>
            )}

            {/* Crypto */}
            {withdrawMode === "crypto" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label>Amount (USD)</Label>
                  <Input type="number" min={1} step={0.01} value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Cryptocurrency</Label>
                  <Select value={withdrawCrypto} onValueChange={setWithdrawCrypto}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACCEPTED_CRYPTOS.map((c) => (
                        <SelectItem key={c} value={c}>
                          <div className="flex items-center gap-2">
                            <img src={CRYPTO_LOGOS[c]} alt={c} className="w-5 h-5 object-contain" />
                            <span className="font-semibold">{c}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Wallet Address</Label>
                  <Input placeholder={`Your ${withdrawCrypto} address`} value={withdrawWallet} onChange={(e) => setWithdrawWallet(e.target.value)} />
                </div>
                {withdrawAmount && (
                  <div className="p-3 bg-muted rounded-lg border border-border text-sm flex flex-col gap-1">
                    <span>Amount: <strong>${Number(withdrawAmount).toFixed(2)}</strong></span>
                    <span>Fee (5%): <strong>-${fee}</strong></span>
                    <Separator className="my-0.5" />
                    <span className="font-bold text-primary">You receive: ${net}</span>
                  </div>
                )}
                {withdrawError && <Alert variant="destructive"><AlertDescription>{withdrawError}</AlertDescription></Alert>}
                {withdrawSuccess && <Alert><AlertDescription className="text-green-600">Withdrawal request submitted! Processing is handled manually, usually within 24h.</AlertDescription></Alert>}
                {withdrawAmount && Number(withdrawAmount) >= 3 && Number(withdrawAmount) <= 5 && !withdrawSuccess && (
                  <Alert><AlertDescription>
                    Are you sure you want to cash out such a low amount? Why not{" "}
                    <Link href="/marketplace" onClick={onClose} className="font-bold text-primary">invest it in items</Link> instead?
                  </AlertDescription></Alert>
                )}
                <Button onClick={handleWithdraw} disabled={withdrawLoading} className="gap-2">
                  {withdrawLoading && <Loader2 size={14} className="animate-spin" />}
                  {withdrawLoading ? "Submitting..." : "Request Withdrawal"}
                </Button>
                <p className="text-xs text-muted-foreground">5% fee on withdrawals. Processed manually by the team.</p>
              </>
            )}

            {/* Gift Card */}
            {withdrawMode === "giftcard" && (
              <>
                <Alert><AlertDescription>Gift cards are delivered to your email within <strong>up to 3 days</strong> after request.</AlertDescription></Alert>
                <p className="text-sm font-semibold">Select Gift Card</p>
                <div className="flex gap-3">
                  {GIFTCARD_OPTIONS.map((gc) => (
                    <button
                      key={gc.id}
                      onClick={() => setGcType(gc.id as any)}
                      className={`flex-1 rounded-xl overflow-hidden border-2 transition-all ${gcType === gc.id ? "border-primary" : "border-border hover:border-primary/50"}`}
                    >
                      <img src={gc.image} alt={gc.label} className="w-full h-[80px] object-cover block" />
                      <p className={`text-xs font-semibold py-1.5 text-center ${gcType === gc.id ? "bg-primary/10" : "bg-muted"}`}>{gc.label}</p>
                    </button>
                  ))}
                </div>
                <p className="text-sm font-semibold">Select Amount</p>
                <div className="flex gap-2">
                  {GIFTCARD_AMOUNTS.map((a) => (
                    <button
                      key={a}
                      onClick={() => setGcAmount(a as any)}
                      className={`px-4 py-1.5 rounded-full border font-bold text-sm transition-colors ${gcAmount === a ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"}`}
                    >
                      ${a}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Email address</Label>
                  <Input type="email" placeholder="you@example.com" value={gcEmail} onChange={(e) => setGcEmail(e.target.value)} />
                  <p className="text-xs text-muted-foreground">The gift card will be sent to this email</p>
                </div>
                <div className="p-3 bg-muted rounded-lg border border-border text-sm flex flex-col gap-1">
                  <span>Card: <strong>{GIFTCARD_OPTIONS.find(g => g.id === gcType)?.label}</strong></span>
                  <span>Amount: <strong>${gcAmount}.00</strong></span>
                  <span className="text-xs text-muted-foreground">No fee on gift cards. Balance deducted immediately.</span>
                </div>
                {gcError && <Alert variant="destructive"><AlertDescription>{gcError}</AlertDescription></Alert>}
                {gcSuccess && <Alert><AlertDescription className="text-green-600">Gift card request submitted! You'll receive it at <strong>{gcEmail}</strong> within up to 3 days.</AlertDescription></Alert>}
                <Button onClick={handleGiftCard} disabled={gcLoading} className="gap-2">
                  {gcLoading && <Loader2 size={14} className="animate-spin" />}
                  {gcLoading ? "Submitting..." : `Request $${gcAmount} Gift Card`}
                </Button>
              </>
            )}

            {/* PayPal */}
            {withdrawMode === "paypal" && user?.plus && (
              <>
                <Alert><AlertDescription>Minimum $10.00. Processed within 24–48 hours.</AlertDescription></Alert>
                <div className="flex flex-col gap-1.5"><Label>PayPal Email</Label><Input type="email" placeholder="you@paypal.com" value={ppEmail} onChange={(e) => setPpEmail(e.target.value)} /></div>
                <div className="flex flex-col gap-1.5"><Label>Amount (USD)</Label><Input type="number" min={10} step={0.01} value={ppAmount} onChange={(e) => setPpAmount(e.target.value)} /></div>
                {ppError && <Alert variant="destructive"><AlertDescription>{ppError}</AlertDescription></Alert>}
                {ppSuccess && <Alert><AlertDescription className="text-green-600">PayPal withdrawal requested! You'll receive it within 24–48h.</AlertDescription></Alert>}
                <Button onClick={handlePayPal} disabled={ppLoading} className="gap-2">
                  {ppLoading && <Loader2 size={14} className="animate-spin" />}
                  {ppLoading ? "Submitting..." : "Request PayPal Withdrawal"}
                </Button>
              </>
            )}

            {/* Xbox */}
            {withdrawMode === "xbox" && user?.plus && (
              <>
                <Alert><AlertDescription>Xbox Gift Card sent to your email within 3 days.</AlertDescription></Alert>
                <div className="flex gap-2">
                  {[25, 50].map((a) => (
                    <button key={a} onClick={() => setXboxAmount(a as any)} className={`px-4 py-1.5 rounded-full border font-bold text-sm transition-colors ${xboxAmount === a ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"}`}>${a}</button>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5"><Label>Email address</Label><Input type="email" placeholder="you@example.com" value={xboxEmail} onChange={(e) => setXboxEmail(e.target.value)} /><p className="text-xs text-muted-foreground">Xbox gift card sent to this email</p></div>
                {xboxError && <Alert variant="destructive"><AlertDescription>{xboxError}</AlertDescription></Alert>}
                {xboxSuccess && <Alert><AlertDescription className="text-green-600">Xbox gift card requested! Check your email within 3 days.</AlertDescription></Alert>}
                <Button onClick={handleXbox} disabled={xboxLoading} className="gap-2">
                  {xboxLoading && <Loader2 size={14} className="animate-spin" />}
                  {xboxLoading ? "Submitting..." : `Request $${xboxAmount} Xbox Gift Card`}
                </Button>
              </>
            )}

            {/* PlayStation */}
            {withdrawMode === "playstation" && user?.plus && (
              <>
                <Alert><AlertDescription>PlayStation Store gift card sent to your email within 3 days.</AlertDescription></Alert>
                <div className="flex gap-2">
                  {[25, 50].map((a) => (
                    <button key={a} onClick={() => setPsAmount(a as any)} className={`px-4 py-1.5 rounded-full border font-bold text-sm transition-colors ${psAmount === a ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"}`}>${a}</button>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5"><Label>Email address</Label><Input type="email" placeholder="you@example.com" value={psEmail} onChange={(e) => setPsEmail(e.target.value)} /><p className="text-xs text-muted-foreground">PlayStation gift card sent to this email</p></div>
                {psError && <Alert variant="destructive"><AlertDescription>{psError}</AlertDescription></Alert>}
                {psSuccess && <Alert><AlertDescription className="text-green-600">PlayStation gift card requested! Check your email within 3 days.</AlertDescription></Alert>}
                <Button onClick={handlePlayStation} disabled={psLoading} className="gap-2">
                  {psLoading && <Loader2 size={14} className="animate-spin" />}
                  {psLoading ? "Submitting..." : `Request $${psAmount} PS Store Gift Card`}
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
