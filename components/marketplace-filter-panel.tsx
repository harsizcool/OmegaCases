"use client"

import {
  Box, Card, Typography, TextField, Chip, FormControl, InputLabel,
  Select, MenuItem, Button, Checkbox, FormControlLabel,
} from "@mui/material"
import type { Rarity } from "@/lib/types"
import { RARITY_COLORS } from "@/lib/types"

const RARITIES = ["Common", "Uncommon", "Rare", "Legendary", "Omega"]

export interface FilterPanelProps {
  search: string; setSearch: (v: string) => void
  rarities: string[]; setRarities: (v: string[]) => void
  minPrice: string; setMinPrice: (v: string) => void
  maxPrice: string; setMaxPrice: (v: string) => void
  sellerSearch: string; setSellerSearch: (v: string) => void
  sortBy: string; setSortBy: (v: string) => void
  ignoreOwn: boolean; setIgnoreOwn: (v: boolean) => void
  showSold: boolean; setShowSold: (v: boolean) => void
  onApply: () => void
}

export default function FilterPanel({
  search, setSearch,
  rarities, setRarities,
  minPrice, setMinPrice,
  maxPrice, setMaxPrice,
  sellerSearch, setSellerSearch,
  sortBy, setSortBy,
  ignoreOwn, setIgnoreOwn,
  showSold, setShowSold,
  onApply,
}: FilterPanelProps) {
  const toggleRarity = (r: string) =>
    setRarities(rarities.includes(r) ? rarities.filter((x) => x !== r) : [...rarities, r])

  return (
    <Box sx={{ width: { xs: "100%", md: 240 }, flexShrink: 0 }}>
      <Card sx={{ p: 2, position: { md: "sticky" }, top: { md: 80 } }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>Filters</Typography>

        <TextField label="Search item name" value={search} onChange={(e) => setSearch(e.target.value)}
          fullWidth size="small" sx={{ mb: 2 }} autoComplete="off" />

        <TextField label="Seller username" value={sellerSearch} onChange={(e) => setSellerSearch(e.target.value)}
          fullWidth size="small" sx={{ mb: 2 }} autoComplete="off" />

        <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
          Rarity
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 2 }}>
          {RARITIES.map((r) => (
            <Chip
              key={r}
              label={r}
              size="small"
              onClick={() => toggleRarity(r)}
              sx={{
                bgcolor: rarities.includes(r) ? RARITY_COLORS[r as Rarity] : "transparent",
                color: rarities.includes(r) ? "#fff" : "text.secondary",
                border: `1px solid ${RARITY_COLORS[r as Rarity]}`,
                cursor: "pointer",
                fontWeight: rarities.includes(r) ? 700 : 400,
              }}
            />
          ))}
        </Box>

        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <TextField
            label="Min $" value={minPrice} onChange={(e) => setMinPrice(e.target.value)}
            size="small" type="number" inputProps={{ min: 0, step: 0.01 }} sx={{ flex: 1 }}
          />
          <TextField
            label="Max $" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}
            size="small" type="number" inputProps={{ min: 0, step: 0.01 }} sx={{ flex: 1 }}
          />
        </Box>

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Sort by</InputLabel>
          <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} label="Sort by">
            <MenuItem value="created_at">Newest</MenuItem>
            <MenuItem value="price">Price</MenuItem>
          </Select>
        </FormControl>

        <FormControlLabel
          control={<Checkbox checked={ignoreOwn} onChange={(e) => setIgnoreOwn(e.target.checked)} size="small" />}
          label={<Typography variant="body2">Ignore Your Listings</Typography>}
          sx={{ mb: 0.5, display: "block" }}
        />
        <FormControlLabel
          control={<Checkbox checked={showSold} onChange={(e) => setShowSold(e.target.checked)} size="small" />}
          label={<Typography variant="body2">Show Sold Items</Typography>}
          sx={{ mb: 1.5, display: "block" }}
        />
        <Button variant="outlined" fullWidth onClick={onApply}>Apply</Button>
      </Card>
    </Box>
  )
}
