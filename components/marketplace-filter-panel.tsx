"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
    <div className="w-full md:w-60 shrink-0">
      <Card className="md:sticky md:top-20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold">Item name</Label>
            <Input
              placeholder="Search item name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold">Seller</Label>
            <Input
              placeholder="Seller username"
              value={sellerSearch}
              onChange={(e) => setSellerSearch(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rarity</Label>
            <div className="flex flex-wrap gap-1">
              {RARITIES.map((r) => (
                <button
                  key={r}
                  onClick={() => toggleRarity(r)}
                  className="text-xs px-2 py-0.5 rounded-full border font-medium transition-all"
                  style={{
                    backgroundColor: rarities.includes(r) ? RARITY_COLORS[r as Rarity] : "transparent",
                    borderColor: RARITY_COLORS[r as Rarity],
                    color: rarities.includes(r) ? "#fff" : RARITY_COLORS[r as Rarity],
                    fontWeight: rarities.includes(r) ? 700 : 400,
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex flex-col gap-1.5 flex-1">
              <Label className="text-xs font-semibold">Min $</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                min={0}
                step={0.01}
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <Label className="text-xs font-semibold">Max $</Label>
              <Input
                type="number"
                placeholder="∞"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                min={0}
                step={0.01}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold">Sort by</Label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Newest</SelectItem>
                <SelectItem value="price">Price</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={ignoreOwn}
                onCheckedChange={(v) => setIgnoreOwn(Boolean(v))}
              />
              <span className="text-sm">Ignore Your Listings</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={showSold}
                onCheckedChange={(v) => setShowSold(Boolean(v))}
              />
              <span className="text-sm">Show Sold Items</span>
            </label>
          </div>

          <Button variant="outline" className="w-full" onClick={onApply}>Apply</Button>
        </CardContent>
      </Card>
    </div>
  )
}
