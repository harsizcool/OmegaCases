"use client"

import { useState, useEffect, useCallback } from "react"
import NextLink from "next/link"
import { Lock, Package, ShoppingCart, Zap, Loader2, Crown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/lib/auth-context"
import CaseSpinner from "@/components/case-spinner"
import Confetti from "@/components/confetti"
import ItemCard from "@/components/item-card"
import type { Item, Rarity, CasePrice } from "@/lib/types"
import { RARITY_COLORS, CASE_PRICES } from "@/lib/types"
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
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Confetti active={confettiActive} />

      <h1 className="text-3xl font-extrabold text-center mb-6">Open Cases</h1>

      {!user && (
        <div className="flex flex-col items-center py-16 gap-4 text-center">
          <Lock size={64} className="text-primary/40" />
          <p className="text-lg font-semibold">Login to open cases</p>
          <Button size="lg" asChild><NextLink href="/login">Login / Register</NextLink></Button>
        </div>
      )}

      {user && (
        <>
          {/* Balance + cases bar */}
          <div className="flex justify-center gap-3 mb-6 flex-wrap">
            <span className="text-sm font-semibold border border-primary text-primary rounded-full px-3 py-1.5">
              Balance: ${Number(user.balance).toFixed(2)}
            </span>
            <span className={`text-sm font-semibold border rounded-full px-3 py-1.5 flex items-center gap-1.5 ${casesRemaining > 0 ? "border-green-500 text-green-600 bg-green-50 dark:bg-green-950/20" : "border-border text-muted-foreground"}`}>
              <Package size={14} />
              {casesRemaining > 0
                ? `${casesRemaining} case${casesRemaining !== 1 ? "s" : ""} ready to open`
                : "No cases — buy some below"}
            </span>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Spinner */}
          {(spinning || showResult) && targetItem && (
            <div className="mb-6">
              <CaseSpinner
                items={items}
                targetItem={targetItem}
                spinning={spinning}
                onComplete={handleSpinComplete}
                speed={doubleSpeed ? (user?.plus ? 3 : 2) : 1}
                muted={muted}
              />
            </div>
          )}

          {/* Result card */}
          {showResult && lastWon && (
            <div
              className="text-center p-6 rounded-2xl mb-6 bg-muted/40"
              style={{
                border: `2px solid ${RARITY_COLORS[lastWon.rarity as Rarity]}`,
                boxShadow: `0 0 24px ${RARITY_COLORS[lastWon.rarity as Rarity]}44`,
              }}
            >
              <p className="text-lg font-bold mb-3">You got:</p>
              <div className="flex justify-center mb-2">
                <ItemCard item={lastWon} size="lg" showPrice />
              </div>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: RARITY_COLORS[lastWon.rarity as Rarity] }}
              >
                {lastWon.rarity}
              </span>
              <div className="flex gap-3 justify-center mt-5">
                <Button variant="outline" asChild>
                  <NextLink href={`/user/${user.username}`}>View Inventory</NextLink>
                </Button>
                <Button onClick={handleSpinAgain} disabled={(user.cases_remaining ?? 0) < 1}>
                  {(user.cases_remaining ?? 0) > 0
                    ? `Spin Again (${user.cases_remaining} left)`
                    : "No cases left"}
                </Button>
              </div>
            </div>
          )}

          {/* Spin button */}
          {!spinning && !showResult && (
            <div className="text-center mb-8">
              <Button
                size="lg"
                onClick={handleSpin}
                disabled={casesRemaining < 1 || spinLoading}
                className="px-10 text-base"
              >
                {spinLoading
                  ? <><Loader2 size={16} className="animate-spin mr-2" />Opening...</>
                  : casesRemaining > 0
                  ? `Open a Case (${casesRemaining} remaining)`
                  : "Buy Cases Below to Spin"}
              </Button>
              <div className="flex justify-center items-center gap-2 mt-3">
                <Switch checked={doubleSpeed} onCheckedChange={toggleDoubleSpeed} />
                <span className={`text-sm font-medium flex items-center gap-1.5 ${doubleSpeed ? "text-amber-400" : "text-muted-foreground"}`}>
                  <Zap size={14} />
                  {user?.plus ? "3x Speed" : "2x Speed"}
                </span>
                {user?.plus && (
                  <span className="inline-flex items-center gap-1 text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">
                    <Crown size={9} /> Plus
                  </span>
                )}
              </div>
            </div>
          )}

          <Separator className="mb-6" />

          {/* Buy cases */}
          <h2 className="text-lg font-bold text-center mb-1">Buy Cases</h2>
          <p className="text-sm text-muted-foreground text-center mb-4">Each spin uses 1 case and wins 1 item.</p>

          <div className="flex justify-center gap-3 mb-4 flex-wrap">
            {casePrices.map((preset) => (
              <button
                key={preset.qty}
                onClick={() => !buyLoading && setSelectedQty(preset.qty)}
                className={`min-w-[100px] rounded-xl border-2 px-4 py-3 text-center transition-all ${selectedQty === preset.qty ? "border-primary shadow-md shadow-primary/20" : "border-border hover:border-primary/50"} ${buyLoading ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
              >
                <p className="text-xl font-extrabold text-primary">x{preset.qty}</p>
                <p className="text-sm font-semibold text-muted-foreground">${preset.price}</p>
                <p className="text-[0.65rem] text-muted-foreground">${(preset.price / preset.qty).toFixed(4)}/case</p>
              </button>
            ))}
          </div>

          <div className="flex justify-center mb-10">
            <Button variant="outline" size="lg" onClick={handleBuyCases} disabled={buyLoading} className="px-8 gap-2">
              {buyLoading ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
              {buyLoading ? "Buying..." : `Buy x${selectedQty} Cases — $${selectedPrice.price}`}
            </Button>
          </div>

          <Separator className="mb-6" />

          {/* Item pool */}
          <h2 className="text-lg font-bold mb-4">Items in Pool</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {items.map((item) => (
              <div key={item.id} className="text-center">
                <ItemCard item={item} size="sm" showPrice />
                <p className="text-[0.65rem] text-muted-foreground mt-1">
                  1 in {Math.round(100 / Number(item.likelihood))}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Insufficient balance modal */}
      <Dialog open={buyModalOpen} onOpenChange={setBuyModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Insufficient Balance</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You need ${selectedPrice.price} to buy x{selectedQty} cases. Deposit more funds to continue.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyModalOpen(false)}>Cancel</Button>
            <Button asChild onClick={() => setBuyModalOpen(false)}>
              <NextLink href="/?deposit=1">Deposit</NextLink>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
