"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import NextLink from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Menu, Layers, Search, Crown, LogOut, User, Settings, ShieldCheck, Store, ArrowLeftRight, Trophy, X, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/lib/auth-context"
import { useThemeMode } from "./app-provider"
import { useOnlineUsers } from "@/lib/use-online-users"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import DepositWithdrawModal from "./deposit-withdraw-modal"
import NotificationBell from "./notification-bell"

const NAV_LINKS = [
  { href: "/open",        label: "Cases",       icon: Layers },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/trade",       label: "Trade",       icon: ArrowLeftRight },
  { href: "/chat",        label: "Chat",        icon: MessageSquare },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
]

interface SearchResult {
  type: "item" | "user"
  id: string
  name: string
  image?: string
  sub?: string
}

function SearchBar({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const fetchPredictions = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const [itemsRes, usersRes] = await Promise.all([
        fetch(`/api/search?query=${encodeURIComponent(q)}&type=items&limit=4`),
        fetch(`/api/search?query=${encodeURIComponent(q)}&type=users&limit=3`),
      ])
      const items = itemsRes.ok ? await itemsRes.json() : []
      const users = usersRes.ok ? await usersRes.json() : []

      const mapped: SearchResult[] = [
        ...((Array.isArray(items?.items) ? items.items : Array.isArray(items) ? items : []).map((i: any) => ({
          type: "item" as const,
          id: i.id,
          name: i.name,
          image: i.image_url,
          sub: `$${Number(i.market_price || 0).toFixed(2)} · ${i.rarity}`,
        }))),
        ...((Array.isArray(users?.users) ? users.users : Array.isArray(users) ? users : []).map((u: any) => ({
          type: "user" as const,
          id: u.id,
          name: u.username,
          image: u.profile_picture,
          sub: u.plus ? "Plus member" : "Member",
        }))),
      ]
      setResults(mapped)
      setOpen(mapped.length > 0 || q.trim().length > 0)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) { setResults([]); setOpen(false); return }
    debounceRef.current = setTimeout(() => fetchPredictions(val), 320)
  }

  const handleSubmit = (q: string) => {
    if (!q.trim()) return
    router.push(`/search?query=${encodeURIComponent(q.trim())}`)
    setQuery("")
    setResults([])
    setOpen(false)
    onNavigate?.()
  }

  const handleResultClick = (r: SearchResult) => {
    if (r.type === "item") router.push(`/item/${encodeURIComponent(r.name)}`)
    else router.push(`/user/${r.name}`)
    setQuery("")
    setResults([])
    setOpen(false)
    onNavigate?.()
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className={`flex items-center gap-2 bg-muted/60 border rounded-lg px-3 py-1.5 transition-colors ${open ? "border-primary/50 bg-muted" : "border-border/60 hover:border-border"}`}>
        <Search size={14} className="text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search items, users..."
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(query); if (e.key === "Escape") { setOpen(false); inputRef.current?.blur() } }}
          onFocus={() => { if (query.trim()) setOpen(true) }}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 text-foreground min-w-0"
        />
        {query && (
          <button onClick={() => { setQuery(""); setResults([]); setOpen(false) }} className="text-muted-foreground hover:text-foreground">
            <X size={13} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 right-0 bg-popover border border-border/60 rounded-xl shadow-xl shadow-black/30 z-50 overflow-hidden">
          {/* Static quick-search shortcuts */}
          {query.trim() && (
            <div className="border-b border-border/40">
              <button onClick={() => handleSubmit(query)} className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left">
                <Search size={13} className="text-muted-foreground shrink-0" />
                <span>Search <strong>"{query}"</strong> in Items</span>
              </button>
              <button onClick={() => router.push(`/search?query=${encodeURIComponent(query.trim())}&tab=users`) || (setOpen(false), setQuery(""))} className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left">
                <User size={13} className="text-muted-foreground shrink-0" />
                <span>Search <strong>"{query}"</strong> in Users</span>
              </button>
            </div>
          )}

          {/* Actual results */}
          {results.length > 0 && (
            <div className="py-1">
              {results.filter(r => r.type === "item").length > 0 && (
                <>
                  <p className="px-3 py-1 text-[0.65rem] font-bold text-muted-foreground uppercase tracking-wider">Items</p>
                  {results.filter(r => r.type === "item").map((r) => (
                    <button key={r.id} onClick={() => handleResultClick(r)} className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-muted transition-colors text-left">
                      {r.image && <img src={r.image} alt={r.name} className="w-8 h-8 object-contain rounded shrink-0 bg-muted" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.name}</p>
                        {r.sub && <p className="text-xs text-muted-foreground">{r.sub}</p>}
                      </div>
                    </button>
                  ))}
                </>
              )}
              {results.filter(r => r.type === "user").length > 0 && (
                <>
                  <p className="px-3 py-1 text-[0.65rem] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">Users</p>
                  {results.filter(r => r.type === "user").map((r) => (
                    <button key={r.id} onClick={() => handleResultClick(r)} className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-muted transition-colors text-left">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0 overflow-hidden">
                        {r.image ? <img src={r.image} alt={r.name} className="w-full h-full object-cover" /> : r.name[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.name}</p>
                        {r.sub && <p className="text-xs text-muted-foreground">{r.sub}</p>}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          {loading && !results.length && (
            <p className="px-3 py-3 text-sm text-muted-foreground text-center">Searching…</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const { mode, toggleMode } = useThemeMode()
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [pendingTrades, setPendingTrades] = useState(0)
  const [unreadDMs, setUnreadDMs] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [depositOpen, setDepositOpen] = useState(false)
  const { count: onlineCount, users: onlineUsers } = useOnlineUsers(user?.id, user?.username)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!user) return
    const fetchPending = async () => {
      try {
        const res = await fetch(`/api/trades?user_id=${user.id}`)
        const data = await res.json()
        if (data?.received) setPendingTrades(data.received.filter((t: any) => t.status === "pending").length)
      } catch {}
    }
    fetchPending()
    const interval = setInterval(fetchPending, 30000)
    return () => clearInterval(interval)
  }, [user])

  useEffect(() => {
    if (!user) return
    const fetchUnread = async () => {
      try {
        const res = await fetch(`/api/messages?unread_count=1&user_id=${user.id}`)
        const data = res.ok ? await res.json() : {}
        setUnreadDMs(data.unread ?? 0)
      } catch {}
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 20000)
    return () => clearInterval(interval)
  }, [user])

  const handleLogout = async () => { await logout(); router.push("/") }
  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href))

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-card/90 backdrop-blur-md shadow-sm shadow-black/20">
        <div className="flex items-center h-14 px-3 md:px-5 gap-2 md:gap-3">

          {/* Logo */}
          <NextLink href="/" className="flex items-center gap-2 shrink-0">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/omegacrate_logo-tJzRwAfwpZAQEkJOSjQGI93l5hRU06.png"
              alt="OmegaCases"
              className="w-8 h-8"
            />
            <span className="hidden lg:block text-[0.92rem] font-bold tracking-tight whitespace-nowrap">
              Omega<span className="text-primary">Cases</span>
            </span>
          </NextLink>

          <Separator orientation="vertical" className="hidden lg:block h-5 bg-border/40 mx-1" />

          {/* Online users pill — only shown when signed in */}
          {mounted && user && onlineCount > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/25 rounded-full px-2.5 py-1 shrink-0 cursor-default select-none">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </span>
                    <span className="text-[0.65rem] font-bold text-green-400 tabular-nums">
                      {onlineCount.toLocaleString()} online
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="p-0 overflow-hidden min-w-[150px] bg-popover border-border/60">
                  <div className="px-3 py-2.5">
                    <p className="text-[0.6rem] font-bold text-muted-foreground uppercase tracking-wider mb-2">Online now</p>
                    <div className="flex flex-col gap-1">
                      {onlineUsers.slice(0, 7).map((u) => (
                        <div key={u.userId} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                          <span className="text-xs font-medium text-foreground">{u.username}</span>
                        </div>
                      ))}
                    </div>
                    {onlineUsers.length > 7 && (
                      <p className="text-[0.65rem] text-muted-foreground mt-1.5">+{onlineUsers.length - 7} more</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5 shrink-0">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const active = isActive(href)
              const badge =
                label === "Trade" && mounted && user && pendingTrades > 0 ? pendingTrades :
                label === "Chat"  && mounted && user && unreadDMs > 0     ? unreadDMs :
                null
              return (
                <NextLink
                  key={href}
                  href={href}
                  className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon size={14} />
                  {label}
                  {badge !== null && (
                    <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] bg-destructive text-white text-[0.55rem] font-bold rounded-full flex items-center justify-center px-0.5">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </NextLink>
              )
            })}
            <NextLink
              href="/plus"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-bold transition-colors ${
                isActive("/plus") ? "bg-amber-500/15 text-amber-400" : "text-amber-400 hover:bg-amber-500/10"
              }`}
            >
              <Crown size={14} /> Plus
            </NextLink>
          </nav>

          {/* Search — grows to fill center space */}
          <div className="flex-1 min-w-0 max-w-xs hidden md:block">
            <SearchBar />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            {mounted && user && (
              <button
                onClick={() => setDepositOpen(true)}
                className="flex text-xs font-bold text-primary bg-primary/10 border border-primary/25 rounded-lg px-2.5 py-1.5 hover:bg-primary/20 transition-colors whitespace-nowrap"
              >
                ${Number(user.balance).toFixed(2)}
              </button>
            )}

            {mounted && (
              user ? (
                <>
                  <NotificationBell userId={user.id} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="shrink-0 ring-2 ring-transparent hover:ring-primary/40 rounded-full transition-all">
                        <Avatar className="w-8 h-8 cursor-pointer">
                          {user.profile_picture && <AvatarImage src={user.profile_picture} />}
                          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                            {user.username[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 bg-popover border-border/60">
                      <div className="px-3 py-2 border-b border-border/40">
                        <p className="text-sm font-semibold truncate">{user.username}</p>
                        <p className="text-xs text-muted-foreground">${Number(user.balance).toFixed(2)} balance</p>
                      </div>
                      <DropdownMenuItem asChild>
                        <NextLink href={`/user/${user.username}`} className="flex items-center gap-2 cursor-pointer">
                          <User size={13} /> My Inventory
                        </NextLink>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <NextLink href="/settings" className="flex items-center gap-2 cursor-pointer">
                          <Settings size={13} /> Settings
                        </NextLink>
                      </DropdownMenuItem>
                      {user.admin && (
                        <DropdownMenuItem asChild>
                          <NextLink href="/admin" className="flex items-center gap-2 cursor-pointer">
                            <ShieldCheck size={13} /> Admin Panel
                          </NextLink>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator className="bg-border/40" />
                      <DropdownMenuItem onClick={handleLogout} className="text-destructive gap-2 cursor-pointer focus:text-destructive">
                        <LogOut size={13} /> Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" asChild>
                    <NextLink href="/login">Login</NextLink>
                  </Button>
                  <Button size="sm" asChild>
                    <NextLink href="/register">Register</NextLink>
                  </Button>
                </div>
              )
            )}

            {/* Mobile hamburger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="md:hidden p-1.5 text-muted-foreground">
                  <Menu size={20} />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-0 bg-card border-border/60">
                <div className="p-4 border-b border-border/40">
                  {mounted && user ? (
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        {user.profile_picture && <AvatarImage src={user.profile_picture} />}
                        <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                          {user.username[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate">{user.username}</p>
                        <button onClick={() => { setMobileOpen(false); setDepositOpen(true) }} className="text-xs text-primary font-semibold">
                          ${Number(user.balance).toFixed(2)}
                        </button>
                      </div>
                      {onlineCount > 0 && (
                        <div className="flex items-center gap-1 bg-green-500/10 border border-green-500/25 rounded-full px-2 py-0.5 shrink-0">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                          </span>
                          <span className="text-[0.6rem] font-bold text-green-400 tabular-nums">{onlineCount}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" asChild><NextLink href="/login" onClick={() => setMobileOpen(false)}>Login</NextLink></Button>
                      <Button size="sm" variant="outline" className="flex-1" asChild><NextLink href="/register" onClick={() => setMobileOpen(false)}>Register</NextLink></Button>
                    </div>
                  )}
                </div>

                {/* Mobile search */}
                <div className="px-3 py-3 border-b border-border/40">
                  <SearchBar onNavigate={() => setMobileOpen(false)} />
                </div>

                <nav className="flex flex-col py-1">
                  {NAV_LINKS.map(({ href, label, icon: Icon }) => {
                    const active = isActive(href)
                    const badge =
                      label === "Trade" && mounted && user && pendingTrades > 0 ? pendingTrades :
                      label === "Chat"  && mounted && user && unreadDMs > 0     ? unreadDMs :
                      null
                    return (
                      <NextLink
                        key={href}
                        href={href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors ${
                          active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        <span className="flex items-center gap-2.5"><Icon size={15} />{label}</span>
                        {badge !== null && (
                          <span className="min-w-[15px] h-[15px] bg-destructive text-white text-[0.55rem] font-bold rounded-full flex items-center justify-center px-1">
                            {badge > 9 ? "9+" : badge}
                          </span>
                        )}
                      </NextLink>
                    )
                  })}
                  <NextLink href="/plus" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-amber-400 hover:bg-amber-500/10 transition-colors">
                    <Crown size={15} /> Plus
                  </NextLink>
                </nav>

                {mounted && user && (
                  <>
                    <Separator className="bg-border/40" />
                    <nav className="flex flex-col py-1">
                      <NextLink href={`/user/${user.username}`} onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <User size={15} /> My Inventory
                      </NextLink>
                      <NextLink href="/settings" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Settings size={15} /> Settings
                      </NextLink>
                      {user.admin && (
                        <NextLink href="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                          <ShieldCheck size={15} /> Admin Panel
                        </NextLink>
                      )}
                      <button onClick={() => { setMobileOpen(false); handleLogout() }} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-muted transition-colors text-left">
                        <LogOut size={15} /> Logout
                      </button>
                    </nav>
                  </>
                )}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {mounted && <DepositWithdrawModal open={depositOpen} onClose={() => setDepositOpen(false)} />}
    </>
  )
}
