"use client"

import { useEffect, useState, useRef } from "react"
import {
  Container, Box, Typography, Button, Card, CardContent, CardMedia,
  TextField, Select, MenuItem, FormControl, InputLabel, Grid,
  Alert, CircularProgress, Chip, Tab, Tabs, Slider, Tooltip,
} from "@mui/material"
import AddIcon from "@mui/icons-material/Add"
import UploadIcon from "@mui/icons-material/Upload"
import SaveIcon from "@mui/icons-material/Save"
import { useAuth } from "@/lib/auth-context"
import { createClient as createBrowserClient } from "@/lib/supabase/client"
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

// Convert slider value (0–1000) to percentage
// Slider 0–1000 maps to 0.002%–100% on a log scale
function sliderToPercent(val: number): number {
  if (val === 0) return 0.002
  // Logarithmic: slider 1000 = 100%, slider 0 = 0.002%
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

  // Settings tab state
  const RARITIES_LIST = ["Common", "Uncommon", "Rare", "Legendary", "Omega"]
  const DEFAULT_CAPS: Record<string, number> = { Common: 0.04, Uncommon: 0.10, Rare: 0.40, Legendary: 2.00, Omega: 800 }
  const [caps, setCaps] = useState<Record<string, number>>(DEFAULT_CAPS)
  const [capsLoading, setCapsLoading] = useState(false)
  const [capsSaving, setCapsSaving] = useState(false)
  const [capsError, setCapsError] = useState("")
  const [capsSuccess, setCapsSuccess] = useState(false)

  // Banner state
  const [bannerText, setBannerText] = useState("")
  const [bannerColor, setBannerColor] = useState("#1565c0")
  const [bannerSaving, setBannerSaving] = useState(false)
  const [bannerSuccess, setBannerSuccess] = useState(false)
  const [bannerError, setBannerError] = useState("")

  // Case prices state
  const DEFAULT_CASE_PRICES = [{ qty: 10, price: 0.39 }, { qty: 100, price: 2.99 }, { qty: 1000, price: 9.99 }]
  const [casePrices, setCasePrices] = useState(DEFAULT_CASE_PRICES)
  const [cpSaving, setCpSaving] = useState(false)
  const [cpSuccess, setCpSuccess] = useState(false)
  const [cpError, setCpError] = useState("")

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

  // Load banner in loadCaps

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

  const likelihood = sliderVal <= 0
    ? 0.002
    : customPct !== "" && sliderVal === 0
      ? parseFloat(customPct) || 0.002
      : sliderToPercent(sliderVal)

  // Threshold: show custom text field when slider <= threshold for 0.1% (1 in 1000)
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
    } catch {}
    setCapsLoading(false)
  }

  const saveCaps = async () => {
    setCapsSaving(true)
    setCapsError("")
    setCapsSuccess(false)
    try {
      if (!user?.id) throw new Error("Not authenticated")
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "rarity_price_caps", value: caps, user_id: user.id }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || "Failed to save")
      }
      setCapsSuccess(true)
    } catch (e: any) {
      setCapsError(e.message)
    } finally {
      setCapsSaving(false)
    }
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
    setCreateError("")
    setCreateSuccess(false)
    setCreating(true)
    try {
      const finalUrl = await uploadImage()
      if (!finalUrl) { setCreating(false); return }

      const finalLikelihood = showCustomInput && customPct !== ""
        ? Math.min(Math.max(parseFloat(customPct) || 0.002, 0.002), 100)
        : sliderToPercent(sliderVal)

      const res = await fetch("/api/admin/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user!.id,
          name,
          image_url: finalUrl,
          rarity,
          likelihood: finalLikelihood,
          market_price: parseFloat(marketPrice) || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCreateSuccess(true)
      setName(""); setImageUrl(""); setImageFile(null); setImagePreview(""); setMarketPrice("")
      setSliderVal(percentToSlider(10)); setCustomPct("")
      loadItems()
    } catch (e: any) {
      setCreateError(e.message)
    } finally {
      setCreating(false)
    }
  }

  if (!user) return <Box textAlign="center" py={8}><CircularProgress /></Box>
  if (!user.admin) return null

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>Admin Panel</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Items" />
        <Tab label="Add Item" />
        <Tab label="Settings" />
      </Tabs>

      {tab === 0 && (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {items.length} items in pool
          </Typography>
          {loading ? <CircularProgress /> : (
            <Grid container spacing={2}>
              {items.map((item) => {
                const color = RARITY_COLORS[item.rarity as Rarity]
                const chance = Number(item.likelihood)
                const oneInVal = chance > 0 ? Math.round(100 / chance) : 0
                return (
                  <Grid item key={item.id} xs={6} sm={4} md={3} lg={2}>
                    <Card sx={{ border: `1px solid ${color}44` }}>
                      <CardMedia
                        component="img"
                        image={item.image_url}
                        alt={item.name}
                        sx={{ height: 100, objectFit: "contain", p: 1, bgcolor: "#f8fbff" }}
                      />
                      <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
                        <Chip label={item.rarity} size="small" sx={{ bgcolor: color, color: "#fff", mb: 0.5, fontSize: "0.6rem" }} />
                        <Tooltip title={item.name} placement="top" arrow>
                          <Typography variant="caption" display="block" fontWeight={600}
                            sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.name}
                          </Typography>
                        </Tooltip>
                        <Typography variant="caption" color="text.secondary">
                          {chance < 0.1 ? `1 in ${oneInVal.toLocaleString()}` : `${chance}%`}
                        </Typography>
                        <Typography variant="caption" display="block" color="primary.main">
                          ${Number(item.market_price).toFixed(2)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )
              })}
            </Grid>
          )}
        </>
      )}

      {tab === 1 && (
        <Card sx={{ maxWidth: 560 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} gutterBottom>New Item</Typography>
            <Box component="form" onSubmit={handleCreate} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required fullWidth />

              {/* Image: file upload OR URL */}
              <Box>
                <Typography variant="body2" gutterBottom fontWeight={600}>Item Image</Typography>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<UploadIcon />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload File
                  </Button>
                  <Typography variant="caption" color="text.secondary">or paste URL below</Typography>
                </Box>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                {!imageFile && (
                  <TextField
                    label="Image URL"
                    value={imageUrl}
                    onChange={(e) => { setImageUrl(e.target.value); setImagePreview(e.target.value) }}
                    fullWidth
                    size="small"
                    sx={{ mt: 1 }}
                    helperText="PNG, GIF, or WEBP. Animated GIFs loop automatically."
                  />
                )}
                {imageFile && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                    <Chip label={imageFile.name} size="small" onDelete={() => { setImageFile(null); setImagePreview("") }} />
                  </Box>
                )}
                {imagePreview && (
                  <Box component="img" src={imagePreview} alt="preview"
                    sx={{ mt: 1, width: 100, height: 100, objectFit: "contain", border: "1px solid #e3f2fd", borderRadius: 1 }} />
                )}
              </Box>

              <FormControl fullWidth>
                <InputLabel>Rarity</InputLabel>
                <Select value={rarity} onChange={(e) => setRarity(e.target.value)} label="Rarity">
                  {RARITIES.map((r) => (
                    <MenuItem key={r} value={r}>
                      <Chip label={r} size="small" sx={{ bgcolor: RARITY_COLORS[r as Rarity], color: "#fff", mr: 1, fontSize: "0.65rem" }} />
                      {r}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box>
                <Typography variant="body2" gutterBottom>
                  Likelihood:{" "}
                  <strong>
                    {displayPct < 0.1
                      ? `${displayPct.toFixed(4)}% (1 in ${oneIn.toLocaleString()})`
                      : `${displayPct.toFixed(2)}% (1 in ${oneIn.toLocaleString()})`}
                  </strong>
                </Typography>
                <Slider
                  value={sliderVal}
                  onChange={(_, v) => {
                    setSliderVal(v as number)
                    setCustomPct("")
                  }}
                  min={0}
                  max={1000}
                  step={1}
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                  Drag left for rarer. Max rarity: 1 in 50,000.
                </Typography>
                {showCustomInput && (
                  <TextField
                    label="Custom Likelihood (%)"
                    size="small"
                    type="number"
                    value={customPct}
                    onChange={(e) => setCustomPct(e.target.value)}
                    inputProps={{ min: 0.002, max: 0.1, step: 0.001 }}
                    helperText="Enter a percentage (e.g. 0.05 = 1 in 2,000). Min: 0.002% (1 in 50,000)."
                    fullWidth
                  />
                )}
                <Chip
                  label={`Recommended: ${recommended}`}
                  size="small"
                  sx={{ bgcolor: RARITY_COLORS[recommended as Rarity], color: "#fff", fontSize: "0.65rem", mt: 1 }}
                />
              </Box>

              <TextField
                label="Market Price (USD)"
                type="number"
                value={marketPrice}
                onChange={(e) => setMarketPrice(e.target.value)}
                inputProps={{ min: 0, step: 0.01 }}
                fullWidth
              />
              {createError && <Alert severity="error">{createError}</Alert>}
              {createSuccess && <Alert severity="success">Item created!</Alert>}
              <Button
                type="submit"
                variant="contained"
                startIcon={imageUploading ? <CircularProgress size={16} sx={{ color: "inherit" }} /> : <AddIcon />}
                disabled={creating || imageUploading}
              >
                {creating || imageUploading ? "Creating..." : "Create Item"}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {tab === 2 && (
        <Card sx={{ maxWidth: 480 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} gutterBottom>Game Settings</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Set the maximum listing price allowed per rarity on the marketplace.
            </Typography>
            {capsLoading ? <CircularProgress /> : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {RARITIES_LIST.map((r) => (
                  <Box key={r} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Chip
                      label={r}
                      size="small"
                      sx={{ bgcolor: RARITY_COLORS[r as Rarity], color: "#fff", width: 90, flexShrink: 0 }}
                    />
                    <TextField
                      label="Max Price ($)"
                      type="number"
                      size="small"
                      value={caps[r] ?? ""}
                      onChange={(e) => setCaps((prev) => ({ ...prev, [r]: parseFloat(e.target.value) || 0 }))}
                      inputProps={{ min: 0.01, step: 0.01 }}
                      sx={{ flex: 1 }}
                    />
                  </Box>
                ))}
                {capsError && <Alert severity="error">{capsError}</Alert>}
                {capsSuccess && <Alert severity="success">Settings saved!</Alert>}
                <Button
                  variant="contained"
                  startIcon={capsSaving ? <CircularProgress size={16} sx={{ color: "inherit" }} /> : <SaveIcon />}
                  disabled={capsSaving}
                  onClick={saveCaps}
                >
                  {capsSaving ? "Saving..." : "Save Settings"}
                </Button>
              </Box>
            )}

            {/* Case Prices */}
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>Case Prices</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Set how much each bundle of cases costs. Defaults: 10 for $0.39, 100 for $2.99, 1000 for $9.99.
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {casePrices.map((cp, i) => (
                  <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <TextField
                      label="Qty"
                      type="number"
                      value={cp.qty}
                      onChange={(e) => {
                        const next = [...casePrices]
                        next[i] = { ...next[i], qty: Number(e.target.value) }
                        setCasePrices(next)
                      }}
                      inputProps={{ min: 1, step: 1 }}
                      sx={{ width: 120 }}
                      size="small"
                    />
                    <TextField
                      label="Price ($)"
                      type="number"
                      value={cp.price}
                      onChange={(e) => {
                        const next = [...casePrices]
                        next[i] = { ...next[i], price: Number(e.target.value) }
                        setCasePrices(next)
                      }}
                      inputProps={{ min: 0, step: 0.01 }}
                      sx={{ width: 140 }}
                      size="small"
                      InputProps={{ startAdornment: <Typography variant="body2" sx={{ mr: 0.5 }}>$</Typography> }}
                    />
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      disabled={casePrices.length <= 1}
                      onClick={() => setCasePrices(casePrices.filter((_, j) => j !== i))}
                    >
                      Remove
                    </Button>
                  </Box>
                ))}
                <Box>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setCasePrices([...casePrices, { qty: 0, price: 0 }])}
                  >
                    + Add Tier
                  </Button>
                </Box>
                {cpError && <Alert severity="error">{cpError}</Alert>}
                {cpSuccess && <Alert severity="success">Case prices saved!</Alert>}
                <Button
                  variant="contained"
                  startIcon={cpSaving ? <CircularProgress size={16} sx={{ color: "inherit" }} /> : <SaveIcon />}
                  disabled={cpSaving}
                  onClick={saveCasePrices}
                  sx={{ alignSelf: "flex-start" }}
                >
                  {cpSaving ? "Saving..." : "Save Case Prices"}
                </Button>
              </Box>
            </Box>

            {/* Banner */}            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>Site Banner</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Shown at the top of every page. Leave text empty to hide the banner.
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <TextField
                  label="Banner Text"
                  value={bannerText}
                  onChange={(e) => setBannerText(e.target.value)}
                  fullWidth
                  placeholder="Leave empty to hide banner"
                  helperText="Leave blank to remove the banner entirely"
                />
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ flexShrink: 0 }}>Background Color</Typography>
                  <input
                    type="color"
                    value={bannerColor}
                    onChange={(e) => setBannerColor(e.target.value)}
                    style={{ width: 48, height: 36, border: "none", borderRadius: 6, cursor: "pointer", padding: 2 }}
                  />
                  <Typography variant="body2" color="text.secondary">{bannerColor}</Typography>
                </Box>
                {bannerText && (
                  <Box sx={{ bgcolor: bannerColor, color: "#fff", py: 0.75, px: 2, borderRadius: 1, textAlign: "center" }}>
                    <Typography variant="body2" fontWeight={700} sx={{ fontSize: "0.8rem" }}>{bannerText}</Typography>
                  </Box>
                )}
                {bannerError && <Alert severity="error">{bannerError}</Alert>}
                {bannerSuccess && <Alert severity="success">Banner saved!</Alert>}
                <Button
                  variant="contained"
                  startIcon={bannerSaving ? <CircularProgress size={16} sx={{ color: "inherit" }} /> : <SaveIcon />}
                  disabled={bannerSaving}
                  onClick={saveBanner}
                >
                  {bannerSaving ? "Saving..." : "Save Banner"}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}
    </Container>
  )
}
