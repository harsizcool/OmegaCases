"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Container, Box, Typography, TextField, InputAdornment,
  Grid, Card, CardContent, CardMedia, Chip, Avatar,
  CircularProgress, Tabs, Tab,
} from "@mui/material"
import SearchIcon from "@mui/icons-material/Search"
import NextLink from "next/link"
import { RARITY_COLORS } from "@/lib/types"
import type { Rarity } from "@/lib/types"

interface SearchResults {
  items: any[]
  users: any[]
  listings: any[]
}

export default function SearchPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQuery = searchParams.get("query") ?? ""

  const [inputValue, setInputValue] = useState(initialQuery)
  const [results, setResults] = useState<SearchResults>({ items: [], users: [], listings: [] })
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState(0)

  const doSearch = useCallback(async (q: string) => {
    setLoading(true)
    const res = await fetch(`/api/search?query=${encodeURIComponent(q)}`)
    const data = await res.json()
    setResults(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    doSearch(initialQuery)
  }, [initialQuery, doSearch])

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const q = inputValue.trim()
      router.push(q ? `/search?query=${encodeURIComponent(q)}` : "/search")
    }
  }

  const totalResults = results.items.length + results.users.length + results.listings.length

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        {initialQuery ? `Results for "${initialQuery}"` : "Browse Everything"}
      </Typography>

      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search items, users, listings..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKey}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          size="medium"
          autoFocus
        />
      </Box>

      {loading ? (
        <Box textAlign="center" py={8}><CircularProgress /></Box>
      ) : (
        <>
          {!loading && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {totalResults} result{totalResults !== 1 ? "s" : ""}
              {initialQuery ? ` for "${initialQuery}"` : " — showing all"}
            </Typography>
          )}

          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
            <Tab label={`Items (${results.items.length})`} />
            <Tab label={`Users (${results.users.length})`} />
            <Tab label={`Listings (${results.listings.length})`} />
          </Tabs>

          {/* Items */}
          {tab === 0 && (
            results.items.length === 0 ? (
              <Typography color="text.secondary" textAlign="center" py={4}>No items found.</Typography>
            ) : (
              <Grid container spacing={2}>
                {results.items.map((item) => {
                  const color = RARITY_COLORS[item.rarity as Rarity]
                  const likelihood = item.likelihood > 0 ? Math.round(1 / item.likelihood) : 0
                  return (
                    <Grid item key={item.id} xs={6} sm={4} md={3} lg={2}>
                      <Card
                        component={NextLink}
                        href={`/item/${encodeURIComponent(item.name)}`}
                        sx={{
                          cursor: "pointer", textDecoration: "none", display: "block",
                          border: `1px solid ${color}33`,
                          "&:hover": { boxShadow: `0 4px 20px ${color}44`, transform: "translateY(-2px)", transition: "all 0.15s" },
                        }}
                      >
                        <CardMedia component="img" image={item.image_url} alt={item.name}
                          sx={{ height: 120, objectFit: "contain", p: 1, bgcolor: "#f8fbff" }} />
                        <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
                          <Chip label={item.rarity} size="small"
                            sx={{ bgcolor: color, color: "#fff", mb: 0.5, fontSize: "0.6rem" }} />
                          <Typography variant="caption" display="block" fontWeight={600}
                            sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "text.primary" }}>
                            {item.name}
                          </Typography>
                          <Typography variant="caption" color="primary.main" fontWeight={700} display="block">
                            RAP: ${Number(item.rap).toFixed(2)}
                          </Typography>
                          {likelihood > 0 && (
                            <Typography variant="caption" color="text.secondary">
                              1 in {likelihood.toLocaleString()}
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  )
                })}
              </Grid>
            )
          )}

          {/* Users */}
          {tab === 1 && (
            results.users.length === 0 ? (
              <Typography color="text.secondary" textAlign="center" py={4}>No users found.</Typography>
            ) : (
              <Grid container spacing={2}>
                {results.users.map((u) => (
                  <Grid item key={u.id} xs={6} sm={4} md={3} lg={2}>
                    <Card
                      component={NextLink}
                      href={`/user/${u.username}`}
                      sx={{
                        cursor: "pointer", textDecoration: "none", display: "block",
                        "&:hover": { boxShadow: "0 4px 16px #1976d244", transform: "translateY(-2px)", transition: "all 0.15s" },
                      }}
                    >
                      <CardContent sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 2 }}>
                        {u.profile_picture ? (
                          <Avatar src={u.profile_picture} sx={{ width: 64, height: 64, mb: 1 }} />
                        ) : (
                          <Avatar sx={{ width: 64, height: 64, mb: 1, bgcolor: "primary.main", fontSize: 24 }}>
                            {u.username[0].toUpperCase()}
                          </Avatar>
                        )}
                        <Typography variant="body2" fontWeight={700} textAlign="center">{u.username}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )
          )}

          {/* Listings */}
          {tab === 2 && (
            results.listings.length === 0 ? (
              <Typography color="text.secondary" textAlign="center" py={4}>No listings found.</Typography>
            ) : (
              <Grid container spacing={2}>
                {results.listings.map((listing) => {
                  const item = listing.items
                  if (!item) return null
                  const color = RARITY_COLORS[item.rarity as Rarity]
                  return (
                    <Grid item key={listing.id} xs={6} sm={4} md={3} lg={2}>
                      <Card
                        component={NextLink}
                        href={`/listing/${listing.id}`}
                        sx={{
                          cursor: "pointer", textDecoration: "none", display: "block",
                          border: `1px solid ${color}33`,
                          "&:hover": { boxShadow: `0 4px 20px ${color}44`, transform: "translateY(-2px)", transition: "all 0.15s" },
                        }}
                      >
                        <CardMedia component="img" image={item.image_url} alt={item.name}
                          sx={{ height: 120, objectFit: "contain", p: 1, bgcolor: "#f8fbff" }} />
                        <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
                          <Chip label={item.rarity} size="small"
                            sx={{ bgcolor: color, color: "#fff", mb: 0.5, fontSize: "0.6rem" }} />
                          <Typography variant="caption" display="block" fontWeight={600}
                            sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "text.primary" }}>
                            {item.name}
                          </Typography>
                          <Typography variant="body2" fontWeight={700} color="primary.main">
                            ${Number(listing.price).toFixed(2)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            by {listing.users?.username || "—"}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  )
                })}
              </Grid>
            )
          )}
        </>
      )}
    </Container>
  )
}
