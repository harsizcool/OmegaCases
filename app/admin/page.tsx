"use client"

import { useEffect, useState, useRef } from "react"
import { Plus, Upload, Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@/lib/auth-context"
import type { Item, Rarity } from "@/lib/types"
import { RARITY_COLORS } from "@/lib/types"
import { useRouter } from "next/navigation"

const RARITIES = ["Common", "Uncommon", "Rare", "Legendary", "Omega"]

function getRecommendedRarity(pct: number): string {
  if (pct >= 40) return "Common"
  if (pct >= 15) return "Uncommon"
  if (pct >= 5) return "Rare"
  if (pct >= 1) return "Legendary"
  return "Omega"
}

function sliderToPercent(val: number): number {
  if (val === 0) return 0.002
  const min = Math.log(0.002)
  const max = Math.log(100)
  return parseFloat(Math.exp(min + (val / 1000) * (max - min)).toFixed(6))
}

function percentToSlider(pct: number): number {
  const min = Math.log(0.002)
  const max = Math.log(100)
  const val = ((Math.log(pct) - min) / (max - min)) * 1000
  return Math.round(Math.max(0, Math.min(1000, val)))
}

export default function AdminPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState(0)
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  const RARITIES_LIST = ["Common", "Uncommon", "Rare", "Legendary", "Omega"]
  const DEFAULT_CAPS: Record<string, number> = { Common: 0.04, Uncommon: 0.10, Rare: 0.40, Legendary: 2.00, Omega: 800 }
  const [caps, setCaps] = useState<Record<string, number>>(DEFAULT_CAPS)
  const [capsLoading, setCapsLoading] = useState(false)
  const [capsSaving, setCapsSaving] = useState(false)
  const [capsError, setCapsError] = useState("")
  const [capsSuccess, setCapsSuccess] = useState(false)

  const [bannerText, setBannerText] = useState("")
  const [bannerColor, setBannerColor] = useState("#1565c0")
  const [bannerSaving, setBannerSaving] = useState(false)
  const [bannerSuccess, setBannerSuccess] = useState(false)
  const [bannerError, setBannerError] = useState("")

  const DEFAULT_CASE_PRICES = [{ qty: 10, price: 0.39 }, { qty: 100, price: 2.99 }, { qty: 1000, price: 9.99 }]
  const [casePrices, setCasePrices] = useState(DEFAULT_CASE_PRICES)
  const [cpSaving, setCpSaving] = useState(false)
  const [cpSuccess, setCpSuccess] = useState(false)
  const [cpError, setCpError] = useState("")

  const [paymentsPaused, setPaymentsPaused] = useState(true)
  const [ppSaving, setPpSaving] = useState(false)
  const [ppSuccess, setPpSuccess] = useState(false)
  const [ppError, setPpError] = useState("")

  const savePaymentsPaused = async (val: boolean) => {
    setPpSaving(true); setPpError(""); setPpSuccess(false)
    try {
      if (!user?.id) throw new Error("Not authenticated")
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "payments_paused", value: val, user_id: user.id }),
      })
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || "Failed") }
      setPaymentsPaused(val)
      setPpSuccess(true)
    } catch (e: any) { setPpError(e.message) } finally { setPpSaving(false) }
  }

  const saveCasePrices = async () => {
    setCpSaving(true); setCpError(""); setCpSuccess(false)
    try {
      if (!user?.id) throw new Error("Not authenticated")
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "case_prices", value: casePrices, user_id: user.id }),
      })
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || "Failed") }
      setCpSuccess(true)
    } catch (e: any) { setCpError(e.message) } finally { setCpSaving(false) }
  }

  const saveBanner = async () => {
    setBannerSaving(true); setBannerError(""); setBannerSuccess(false)
    try {
      if (!user?.id) throw new Error("Not authenticated")
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "banner", value: { text: bannerText.trim(), color: bannerColor }, user_id: user.id }),
      })
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || "Failed") }
      setBannerSuccess(true)
    } catch (e: any) { setBannerError(e.message) } finally { setBannerSaving(false) }
  }

  const [name, setName] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [imageUploading, setImageUploading] = useState(false)
  const [rarity, setRarity] = useState("Common")
  const [sliderVal, setSliderVal] = useState(percentToSlider(10))
  const [customPct, setCustomPct] = useState("")
  const [marketPrice, setMarketPrice] = useState("")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState("")
  const [createSuccess, setCreateSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const CUSTOM_THRESHOLD = percentToSlider(0.1)
  const showCustomInput = sliderVal <= CUSTOM_THRESHOLD
  const displayPct = showCustomInput && customPct !== "" ? parseFloat(customPct) || 0 : sliderToPercent(sliderVal)
  const oneIn = displayPct > 0 ? Math.round(100 / displayPct) : 50000
  const recommended = getRecommendedRarity(displayPct)

  const loadItems = async () => {
    const res = await fetch("/api/admin/items")
    const data = await res.json()
    setItems(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const loadCaps = async () => {
    setCapsLoading(true)
    try {
      const res = await fetch("/api/admin/settings")
      const data = await res.json()
      if (data.rarity_price_caps) setCaps(data.rarity_price_caps)
      if (Array.isArray(data.case_prices) && data.case_prices.length > 0) setCasePrices(data.case_prices)
      if (data.banner?.text !== undefined) setBannerText(data.banner.text)
      if (data.banner?.color) setBannerColor(data.banner.color)
      if (typeof data.payments_paused === "boolean") setPaymentsPaused(data.payments_paused)
    } catch {}
    setCapsLoading(false)
  }

  const saveCaps = async () => {
    setCapsSaving(true); setCapsError(""); setCapsSuccess(false)
    try {
      if (!user?.id) throw new Error("Not authenticated")
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "rarity_price_caps", value: caps, user_id: user.id }),
      })
      if (!res.ok) { const body = await res.json(); throw new Error(body.error || "Failed to save") }
      setCapsSuccess(true)
    } catch (e: any) { setCapsError(e.message) } finally { setCapsSaving(false) }
  }

  useEffect(() => {
    if (user && !user.admin) { router.push("/"); return }
    if (user?.admin) { loadItems(); loadCaps() }
  }, [user])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setImageUrl("")
  }

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return imageUrl || null
    setImageUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", imageFile)
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return data.url
    } catch (e: any) {
      setCreateError(`Image upload failed: ${e.message}`)
      return null
    } finally {
      setImageUploading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(""); setCreateSuccess(false); setCreating(true)
    try {
      const finalUrl = await uploadImage()
      if (!finalUrl) { setCreating(false); return }
      const finalLikelihood = showCustomInput && customPct !== ""
        ? Math.min(Math.max(parseFloat(customPct) || 0.002, 0.002), 100)
        : sliderToPercent(sliderVal)
      const res = await fetch("/api/admin/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user!.id, name, image_url: finalUrl, rarity, likelihood: finalLikelihood, market_price: parseFloat(marketPrice) || 0 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCreateSuccess(true)
      setName(""); setImageUrl(""); setImageFile(null); setImagePreview(""); setMarketPrice("")
      setSliderVal(percentToSlider(10)); setCustomPct("")
      loadItems()
    } catch (e: any) { setCreateError(e.message) } finally { setCreating(false) }
  }

  if (!user) return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-muted-foreground" /></div>
  if (!user.admin) return null

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-5">Admin Panel</h1>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        {["Items", "Add Item", "Settings"].map((label, i) => (
          <button
            key={label}
            onClick={() => setTab(i)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === i ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Items tab */}
      {tab === 0 && (
        <>
          <p className="text-sm text-muted-foreground mb-4">{items.length} items in pool</p>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 size={28} className="animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {items.map((item) => {
                const color = RARITY_COLORS[item.rarity as Rarity]
                const chance = Number(item.likelihood)
                const oneInVal = chance > 0 ? Math.round(100 / chance) : 0
                return (
                  <div key={item.id} className="border rounded-xl overflow-hidden" style={{ borderColor: `${color}44` }}>
                    <img src={item.image_url} alt={item.name} className="w-full h-[90px] object-contain p-1.5 bg-muted" />
                    <div className="p-2">
                      <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full text-white mb-1 inline-block" style={{ backgroundColor: color }}>{item.rarity}</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-xs font-semibold truncate">{item.name}</p>
                          </TooltipTrigger>
                          <TooltipContent>{item.name}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <p className="text-xs text-muted-foreground">{chance < 0.1 ? `1 in ${oneInVal.toLocaleString()}` : `${chance}%`}</p>
                      <p className="text-xs font-bold text-primary">${Number(item.market_price).toFixed(2)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Add Item tab */}
      {tab === 1 && (
        <div className="max-w-lg border border-border rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4">New Item</h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            {/* Image */}
            <div className="flex flex-col gap-1.5">
              <Label className="font-semibold">Item Image</Label>
              <div className="flex gap-2 items-center flex-wrap">
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={13} /> Upload File
                </Button>
                <span className="text-xs text-muted-foreground">or paste URL below</span>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              {!imageFile && (
                <Input
                  placeholder="Image URL (PNG, GIF, WEBP)"
                  value={imageUrl}
                  onChange={(e) => { setImageUrl(e.target.value); setImagePreview(e.target.value) }}
                />
              )}
              {imageFile && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium border border-border rounded px-2 py-0.5">{imageFile.name}</span>
                  <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive" onClick={() => { setImageFile(null); setImagePreview("") }}>Remove</Button>
                </div>
              )}
              {imagePreview && (
                <img src={imagePreview} alt="preview" className="w-24 h-24 object-contain border border-border rounded-lg mt-1" />
              )}
            </div>

            {/* Rarity */}
            <div className="flex flex-col gap-1.5">
              <Label>Rarity</Label>
              <Select value={rarity} onValueChange={setRarity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RARITIES.map((r) => (
                    <SelectItem key={r} value={r}>
                      <span className="flex items-center gap-2">
                        <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: RARITY_COLORS[r as Rarity] }}>{r}</span>
                        {r}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Likelihood slider */}
            <div className="flex flex-col gap-1.5">
              <Label>
                Likelihood:{" "}
                <strong>
                  {displayPct < 0.1
                    ? `${displayPct.toFixed(4)}% (1 in ${oneIn.toLocaleString()})`
                    : `${displayPct.toFixed(2)}% (1 in ${oneIn.toLocaleString()})`}
                </strong>
              </Label>
              <input
                type="range"
                value={sliderVal}
                onChange={(e) => { setSliderVal(Number(e.target.value)); setCustomPct("") }}
                min={0} max={1000} step={1}
                className="w-full accent-primary"
              />
              <p className="text-xs text-muted-foreground">Drag left for rarer. Max rarity: 1 in 50,000.</p>
              {showCustomInput && (
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Custom Likelihood (%)</Label>
                  <Input
                    type="number"
                    value={customPct}
                    onChange={(e) => setCustomPct(e.target.value)}
                    min={0.002} max={0.1} step={0.001}
                    placeholder="e.g. 0.05"
                  />
                  <p className="text-xs text-muted-foreground">Min: 0.002% (1 in 50,000).</p>
                </div>
              )}
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white self-start"
                style={{ backgroundColor: RARITY_COLORS[recommended as Rarity] }}
              >
                Recommended: {recommended}
              </span>
            </div>

            {/* Market price */}
            <div className="flex flex-col gap-1.5">
              <Label>Market Price (USD)</Label>
              <Input
                type="number"
                value={marketPrice}
                onChange={(e) => setMarketPrice(e.target.value)}
                min={0} step={0.01}
              />
            </div>

            {createError && <Alert variant="destructive"><AlertDescription>{createError}</AlertDescription></Alert>}
            {createSuccess && <Alert><AlertDescription className="text-green-600">Item created!</AlertDescription></Alert>}

            <Button type="submit" disabled={creating || imageUploading} className="gap-2">
              {(creating || imageUploading) ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {(creating || imageUploading) ? "Creating..." : "Create Item"}
            </Button>
          </form>
        </div>
      )}

      {/* Settings tab */}
      {tab === 2 && (
        <div className="max-w-md flex flex-col gap-6">
          {/* Payments toggle */}
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: paymentsPaused ? "#ef444466" : "#22c55e66", backgroundColor: paymentsPaused ? "rgba(239,68,68,0.05)" : "rgba(34,197,94,0.05)" }}
          >
            <h3 className="text-sm font-bold mb-1">Deposits &amp; Withdrawals</h3>
            <p className="text-xs text-muted-foreground mb-3">When paused, all deposit and withdrawal requests are rejected with a maintenance message.</p>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${paymentsPaused ? "bg-red-100 text-red-700 dark:bg-red-900/20" : "bg-green-100 text-green-700 dark:bg-green-900/20"}`}>
                {paymentsPaused ? "PAUSED" : "ACTIVE"}
              </span>
              <Button
                size="sm"
                variant={paymentsPaused ? "default" : "destructive"}
                className="gap-1.5"
                disabled={ppSaving}
                onClick={() => savePaymentsPaused(!paymentsPaused)}
              >
                {ppSaving && <Loader2 size={12} className="animate-spin" />}
                {ppSaving ? "Saving..." : paymentsPaused ? "Resume Payments" : "Pause Payments"}
              </Button>
            </div>
            {ppError && <Alert variant="destructive" className="mt-2"><AlertDescription>{ppError}</AlertDescription></Alert>}
            {ppSuccess && <Alert className="mt-2"><AlertDescription className="text-green-600">Payments setting saved!</AlertDescription></Alert>}
          </div>

          {/* Rarity price caps */}
          <div>
            <h3 className="text-sm font-bold mb-1">Rarity Price Caps</h3>
            <p className="text-xs text-muted-foreground mb-3">Max listing price per rarity on the marketplace.</p>
            {capsLoading ? (
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            ) : (
              <div className="flex flex-col gap-2">
                {RARITIES_LIST.map((r) => (
                  <div key={r} className="flex items-center gap-3">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full text-white shrink-0 w-24 text-center"
                      style={{ backgroundColor: RARITY_COLORS[r as Rarity] }}
                    >{r}</span>
                    <Input
                      type="number"
                      value={caps[r] ?? ""}
                      onChange={(e) => setCaps((prev) => ({ ...prev, [r]: parseFloat(e.target.value) || 0 }))}
                      min={0.01} step={0.01}
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
                {capsError && <Alert variant="destructive"><AlertDescription>{capsError}</AlertDescription></Alert>}
                {capsSuccess && <Alert><AlertDescription className="text-green-600">Settings saved!</AlertDescription></Alert>}
                <Button className="gap-2 self-start" disabled={capsSaving} onClick={saveCaps}>
                  {capsSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {capsSaving ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Case prices */}
          <div>
            <h3 className="text-sm font-bold mb-1">Case Prices</h3>
            <p className="text-xs text-muted-foreground mb-3">Defaults: 10 for $0.39, 100 for $2.99, 1000 for $9.99.</p>
            <div className="flex flex-col gap-2">
              {casePrices.map((cp, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div>
                    <Label className="text-xs">Qty</Label>
                    <Input
                      type="number"
                      value={cp.qty}
                      onChange={(e) => { const next = [...casePrices]; next[i] = { ...next[i], qty: Number(e.target.value) }; setCasePrices(next) }}
                      min={1} step={1}
                      className="w-24 h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Price ($)</Label>
                    <Input
                      type="number"
                      value={cp.price}
                      onChange={(e) => { const next = [...casePrices]; next[i] = { ...next[i], price: Number(e.target.value) }; setCasePrices(next) }}
                      min={0} step={0.01}
                      className="w-28 h-8 text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive mt-4"
                    disabled={casePrices.length <= 1}
                    onClick={() => setCasePrices(casePrices.filter((_, j) => j !== i))}
                  >Remove</Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setCasePrices([...casePrices, { qty: 0, price: 0 }])}>
                + Add Tier
              </Button>
              {cpError && <Alert variant="destructive"><AlertDescription>{cpError}</AlertDescription></Alert>}
              {cpSuccess && <Alert><AlertDescription className="text-green-600">Case prices saved!</AlertDescription></Alert>}
              <Button className="gap-2 self-start" disabled={cpSaving} onClick={saveCasePrices}>
                {cpSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {cpSaving ? "Saving..." : "Save Case Prices"}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Banner */}
          <div>
            <h3 className="text-sm font-bold mb-1">Site Banner</h3>
            <p className="text-xs text-muted-foreground mb-3">Shown at the top of every page. Leave text empty to hide.</p>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Banner Text</Label>
                <Input value={bannerText} onChange={(e) => setBannerText(e.target.value)} placeholder="Leave empty to hide banner" />
              </div>
              <div className="flex items-center gap-3">
                <Label className="shrink-0">Background Color</Label>
                <input
                  type="color"
                  value={bannerColor}
                  onChange={(e) => setBannerColor(e.target.value)}
                  className="w-10 h-8 border-none rounded cursor-pointer p-0.5"
                />
                <span className="text-sm text-muted-foreground">{bannerColor}</span>
              </div>
              {bannerText && (
                <div className="rounded-lg py-2 px-4 text-center" style={{ backgroundColor: bannerColor }}>
                  <p className="text-sm font-bold text-white">{bannerText}</p>
                </div>
              )}
              {bannerError && <Alert variant="destructive"><AlertDescription>{bannerError}</AlertDescription></Alert>}
              {bannerSuccess && <Alert><AlertDescription className="text-green-600">Banner saved!</AlertDescription></Alert>}
              <Button className="gap-2 self-start" disabled={bannerSaving} onClick={saveBanner}>
                {bannerSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {bannerSaving ? "Saving..." : "Save Banner"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
