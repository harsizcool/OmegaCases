"use client"

import { useState } from "react"
import NextLink from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Crown, Zap, Star, Wallet, Code2, Dice6, LockOpen, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/lib/auth-context"

const PLUS_PRICE = 2.99
const PLUS_COLOR = "#f59e0b"

const BENEFITS = [
  { icon: <Dice6 size={20} />, title: "250 free spins right away", desc: "They land in your account the second you buy. No waiting.", highlight: true },
  { icon: <Zap size={20} />, title: "3x spin speed", desc: "Cases animate at triple speed. Opens way faster." },
  { icon: <Star size={20} />, title: "Plus badge on your profile", desc: "Shows up next to your name on the leaderboard, search, trades, and your profile page." },
  { icon: <Wallet size={20} />, title: "More ways to cash out", desc: "Unlock PayPal (min $10), Xbox Gift Cards, and PlayStation Gift Cards as withdrawal options." },
  { icon: <Code2 size={20} />, title: "API access", desc: "Grab item data, roll history, and more via our developer API. Docs at /plus/docs." },
  { icon: <Users size={20} />, title: "Referral Codes", desc: "Earn 25% of all case + Plus purchases from users you refer. Passive income forever.", soon: true },
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
    <div className="max-w-lg mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <img
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/OmegaCases%20Plus-l4Y0s1RZoFE6qYuGtIWUKCXNP7jTq1.webp"
          alt="OmegaCases Plus"
          className="w-14 h-14"
        />
        <div>
          <h1 className="text-3xl font-extrabold leading-tight" style={{ color: PLUS_COLOR }}>OmegaCases Plus</h1>
          <p className="text-sm text-muted-foreground">One-time payment. Keeps forever.</p>
        </div>
      </div>

      {alreadyPlus && (
        <Alert className="mb-4">
          <Crown size={14} className="text-amber-500" />
          <AlertDescription>
            <p className="font-bold">You already have Plus — nice.</p>
            <p className="text-sm">Everything below is already active on your account.</p>
          </AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="mb-4">
          <AlertDescription>
            <p className="font-bold text-green-600">You're in!</p>
            <p className="text-sm">250 spins added. All Plus perks are now active.</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Benefits */}
      <div className="border border-border rounded-2xl overflow-hidden mb-6">
        <div className="px-4 py-3" style={{ backgroundColor: PLUS_COLOR }}>
          <p className="font-bold text-white">What you get</p>
        </div>
        {BENEFITS.map((b, i) => (
          <div key={i}>
            {i > 0 && <Separator />}
            <div className={`flex items-start gap-3 px-4 py-3 ${b.highlight ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
              <span style={{ color: PLUS_COLOR }} className="shrink-0 mt-0.5">{b.icon}</span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm font-semibold ${(b as any).soon ? "text-muted-foreground" : ""}`}>{b.title}</p>
                  {b.highlight && (
                    <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: PLUS_COLOR }}>Instant</span>
                  )}
                  {(b as any).soon && (
                    <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">Soon</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{b.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Price + CTA */}
      {!alreadyPlus && (
        <div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-4xl font-extrabold" style={{ color: PLUS_COLOR }}>$2.99</span>
            <span className="text-sm text-muted-foreground">one-time, from your balance</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">No subscription. No renewals. Just pay once and it&apos;s yours.</p>
          {!user ? (
            <Button className="gap-2 font-bold" style={{ backgroundColor: PLUS_COLOR }} asChild>
              <NextLink href="/login"><Crown size={16} /> Log in to buy Plus</NextLink>
            </Button>
          ) : (
            <Button className="gap-2 font-bold" style={{ backgroundColor: PLUS_COLOR }} onClick={() => { setError(""); setConfirmOpen(true) }}>
              <Crown size={16} /> Get Plus — $2.99
            </Button>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Your balance: <strong>${Number(user?.balance ?? 0).toFixed(2)}</strong>
            {user && Number(user.balance) < PLUS_PRICE && (
              <span className="text-destructive font-bold"> — not enough balance</span>
            )}
          </p>
        </div>
      )}

      {alreadyPlus && (
        <div className="mt-4">
          <Button variant="outline" className="gap-2" style={{ borderColor: PLUS_COLOR, color: PLUS_COLOR }} asChild>
            <NextLink href="/plus/docs"><Code2 size={16} /> API Documentation</NextLink>
          </Button>
        </div>
      )}

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={(v) => !buying && setConfirmOpen(v)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-bold">Buy OmegaCases Plus?</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <p className="text-sm"><strong>$2.99</strong> will be taken from your balance. This can&apos;t be undone.</p>
            <div className="p-3 rounded-lg border text-sm flex flex-col gap-1" style={{ backgroundColor: "#fffbeb", borderColor: PLUS_COLOR + "44" }}>
              <span>Balance: <strong>${Number(user?.balance ?? 0).toFixed(2)}</strong></span>
              <span>Cost: <strong style={{ color: PLUS_COLOR }}>-$2.99</strong></span>
              <Separator className="my-0.5" />
              <span className="font-bold">After: ${Math.max(0, Number(user?.balance ?? 0) - PLUS_PRICE).toFixed(2)}</span>
            </div>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={buying}>Cancel</Button>
            <Button
              className="gap-2 font-bold"
              style={{ backgroundColor: PLUS_COLOR }}
              onClick={handleBuy}
              disabled={buying || (user ? Number(user.balance) < PLUS_PRICE : true)}
            >
              {buying ? <Loader2 size={14} className="animate-spin" /> : <LockOpen size={14} />}
              {buying ? "Processing..." : "Confirm — $2.99"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
