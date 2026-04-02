"use client"

import { Suspense, useEffect, useState, useCallback, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Search, Clock, Loader2 } from "lucide-react"
import NextLink from "next/link"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { RARITY_COLORS } from "@/lib/types"
import type { Rarity } from "@/lib/types"
import PlusBadge from "@/components/plus-badge"

interface SearchResults {
  items: any[]
  users: any[]
  listings: any[]
}

const TABS = ["Items", "Users", "Listings"]

function SearchInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQuery = searchParams.get("query") ?? ""

  const [inputValue, setInputValue] = useState(initialQuery)
  const [results, setResults] = useState<SearchResults>({ items: [], users: [], listings: [] })
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string) => {
    setLoading(true)
    const res = await fetch(`/api/search?query=${encodeURIComponent(q)}`)
    const data = await res.json()
    setResults(data)
    setLoading(false)
  }, [])

  useEffect(() => { doSearch(initialQuery) }, [initialQuery, doSearch])

  const handleChange = (val: string) => {
    setInputValue(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      router.replace(val.trim() ? `/search?query=${encodeURIComponent(val.trim())}` : "/search", { scroll: false })
      doSearch(val.trim())
    }, 300)
  }

  const counts = [results.items.length, results.users.length, results.listings.length]
  const totalResults = counts.reduce((a, b) => a + b, 0)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">
        {initialQuery ? `Results for "${initialQuery}"` : "Browse Everything"}
      </h1>

      <div className="flex items-center gap-2 bg-muted border border-border rounded-xl px-4 py-2.5 mb-6">
        <Search size={18} className="text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Search items, users, listings..."
          value={inputValue}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (debounceRef.current) clearTimeout(debounceRef.current)
              const q = inputValue.trim()
              router.push(q ? `/search?query=${encodeURIComponent(q)}` : "/search")
              doSearch(q)
            }
          }}
          className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          autoFocus
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {totalResults} result{totalResults !== 1 ? "s" : ""}
            {initialQuery ? ` for "${initialQuery}"` : " — showing all"}
          </p>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-border">
            {TABS.map((label, i) => (
              <button
                key={label}
                onClick={() => setTab(i)}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px ${tab === i ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {label} ({counts[i]})
              </button>
            ))}
          </div>

          {/* Items */}
          {tab === 0 && (
            results.items.length === 0 ? (
              <p className="text-muted-foreground text-center py-10">No items found.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {results.items.map((item) => {
                  const color = RARITY_COLORS[item.rarity as Rarity]
                  const likelihood = item.likelihood > 0 ? Math.round(1 / item.likelihood) : 0
                  return (
                    <NextLink
                      key={item.id}
                      href={`/item/${encodeURIComponent(item.name)}`}
                      className="border border-border rounded-xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all block"
                    >
                      <div className="relative">
                        <img src={item.image_url} alt={item.name} className="w-full h-28 object-contain p-2 bg-muted" />
                        {item.limited_time && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="absolute top-1.5 right-1.5 bg-black/60 rounded-full w-5 h-5 flex items-center justify-center">
                                  <Clock size={11} className="text-yellow-300" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>Limited time — not available in cases</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <div className="p-2">
                        <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full text-white mb-1 inline-block" style={{ backgroundColor: color }}>{item.rarity}</span>
                        <p className="text-xs font-semibold truncate">{item.name}</p>
                        <p className="text-xs font-bold text-primary">RAP: ${Number(item.rap).toFixed(2)}</p>
                        {likelihood > 0 && <p className="text-[0.65rem] text-muted-foreground">1 in {likelihood.toLocaleString()}</p>}
                      </div>
                    </NextLink>
                  )
                })}
              </div>
            )
          )}

          {/* Users */}
          {tab === 1 && (
            results.users.length === 0 ? (
              <p className="text-muted-foreground text-center py-10">No users found.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {results.users.map((u) => (
                  <NextLink
                    key={u.id}
                    href={`/user/${u.username}`}
                    className="border border-border rounded-xl p-4 flex flex-col items-center gap-2 hover:shadow-md hover:-translate-y-0.5 transition-all block"
                  >
                    <Avatar className="w-16 h-16">
                      {u.profile_picture && <AvatarImage src={u.profile_picture} />}
                      <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                        {u.username[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-1 text-sm font-bold text-center">
                      {u.username}
                      {u.plus && <PlusBadge />}
                    </div>
                  </NextLink>
                ))}
              </div>
            )
          )}

          {/* Listings */}
          {tab === 2 && (
            results.listings.length === 0 ? (
              <p className="text-muted-foreground text-center py-10">No listings found.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {results.listings.map((listing) => {
                  const item = listing.items
                  if (!item) return null
                  const color = RARITY_COLORS[item.rarity as Rarity]
                  return (
                    <NextLink
                      key={listing.id}
                      href={`/listing/${listing.id}`}
                      className="border border-border rounded-xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all block"
                    >
                      <div className="relative">
                        <img src={item.image_url} alt={item.name} className="w-full h-28 object-contain p-2 bg-muted" />
                        {item.limited_time && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="absolute top-1.5 right-1.5 bg-black/60 rounded-full w-5 h-5 flex items-center justify-center">
                                  <Clock size={11} className="text-yellow-300" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>Limited time — not available in cases</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <div className="p-2">
                        <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full text-white mb-1 inline-block" style={{ backgroundColor: color }}>{item.rarity}</span>
                        <p className="text-xs font-semibold truncate">{item.name}</p>
                        <p className="text-sm font-bold text-primary">${Number(listing.price).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">by {listing.users?.username || "—"}</p>
                      </div>
                    </NextLink>
                  )
                })}
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-muted-foreground" /></div>}>
      <SearchInner />
    </Suspense>
  )
}
