"use client"

import { useState, useEffect, useCallback } from "react"
import NextLink from "next/link"
import { Plus, X, ArrowLeftRight, Check, Ban, Search, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@/lib/auth-context"
import { RARITY_COLORS } from "@/lib/types"
import type { InventoryItem, Rarity } from "@/lib/types"
import PlusBadge from "@/components/plus-badge"

const MAX_ITEMS = 6
const MAX_BALANCE = 50
const RARITIES_LIST = ["Common", "Uncommon", "Rare", "Legendary", "Omega"]

function ItemSlots({
  items,
  inventory,
  onAdd,
  onRemove,
  label,
}: {
  items: TradeItem[]
  inventory: InventoryItem[]
  onAdd: (inv: InventoryItem) => void
  onRemove: (id: string) => void
  label: string
}) {
  const [search, setSearch] = useState("")
  const [rarityFilter, setRarityFilter] = useState<string>("")

  const uniqueInventory = inventory.filter((inv, idx, arr) => arr.findIndex((x) => x.id === inv.id) === idx)
  const available = uniqueInventory.filter((inv) => !items.find((i) => i.id === inv.id))
  const filtered = available.filter((inv) => {
    const matchSearch = !search || inv.items?.name.toLowerCase().includes(search.toLowerCase())
    const matchRarity = !rarityFilter || inv.items?.rarity === rarityFilter
    return matchSearch && matchRarity
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <p className="text-xs font-bold">{label}</p>
        <p className="text-xs text-primary font-semibold">
          RAP: ${items.reduce((s, ti) => s + ti.item.rap, 0).toFixed(2)}
        </p>
      </div>

      {/* Selected slots */}
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[56px]">
        {items.map((ti, idx) => (
          <TooltipProvider key={`${ti.id}-${idx}`}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <img
                    src={ti.item.image_url}
                    alt={ti.item.name}
                    className="w-14 h-14 object-contain rounded-lg cursor-pointer"
                    style={{ border: `2px solid ${RARITY_COLORS[ti.item.rarity as Rarity]}66`, backgroundColor: "#f8fbff" }}
                  />
                  <button
                    onClick={() => onRemove(ti.id)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive rounded-full flex items-center justify-center"
                  >
                    <X size={9} className="text-white" />
                  </button>
                </div>
              </TooltipTrigger>
              <TooltipContent>{ti.item.name} — RAP: ${ti.item.rap.toFixed(2)}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
        {items.length < MAX_ITEMS && (
          <div className="w-14 h-14 border-2 border-dashed border-primary/20 rounded-lg flex items-center justify-center text-primary/30">
            <Plus size={16} />
          </div>
        )}
      </div>

      {/* Search + filter + available */}
      {items.length < MAX_ITEMS && available.length > 0 && (
        <>
          <div className="relative mb-1.5">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-6 h-7 text-xs"
            />
          </div>
          <div className="flex gap-1 flex-wrap mb-1.5">
            <button
              onClick={() => setRarityFilter("")}
              className={`text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full border transition-colors ${rarityFilter === "" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground"}`}
            >All</button>
            {RARITIES_LIST.map((r) => (
              <button
                key={r}
                onClick={() => setRarityFilter(rarityFilter === r ? "" : r)}
                className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full border transition-colors"
                style={{
                  backgroundColor: rarityFilter === r ? RARITY_COLORS[r as Rarity] : "transparent",
                  color: rarityFilter === r ? "#fff" : RARITY_COLORS[r as Rarity],
                  borderColor: RARITY_COLORS[r as Rarity],
                }}
              >{r}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
            {filtered.map((inv) => (
              <TooltipProvider key={inv.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <img
                      src={inv.items?.image_url}
                      alt={inv.items?.name}
                      onClick={() => onAdd(inv)}
                      className="w-11 h-11 object-contain rounded-lg cursor-pointer hover:opacity-80 hover:scale-105 transition-all"
                      style={{
                        border: `2px solid ${RARITY_COLORS[(inv.items?.rarity as Rarity) || "Common"]}44`,
                        backgroundColor: "#f8fbff",
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>{inv.items?.name} — RAP: ${Number(inv.items?.rap || 0).toFixed(2)}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
            {filtered.length === 0 && <p className="text-xs text-muted-foreground">No items match.</p>}
          </div>
        </>
      )}
      {items.length === MAX_ITEMS && (
        <p className="text-xs text-muted-foreground">Max {MAX_ITEMS} items reached</p>
      )}
    </div>
  )
}

interface TradeItem {
  id: string
  item: { id: string; name: string; image_url: string; rarity: string; rap: number }
}

interface Trade {
  id: string
  sender_id: string
  receiver_id: string
  sender_balance: number
  receiver_balance: number
  status: string
  created_at: string
  sender?: { id: string; username: string; profile_picture?: string; plus?: boolean }
  receiver?: { id: string; username: string; profile_picture?: string; plus?: boolean }
  trade_items: Array<{
    id: string
    side: string
    inventory: {
      id: string
      item_id: string
      items: { id: string; name: string; image_url: string; rarity: string; rap: number }
    }
  }>
}

function tradeValue(items: TradeItem[], balance: number) {
  return items.reduce((sum, ti) => sum + Number(ti.item.rap), 0) + Number(balance)
}

function tradeValueFromSide(tradeItems: Trade["trade_items"], side: string, balance: number) {
  return tradeItems.filter((ti) => ti.side === side).reduce((sum, ti) => sum + Number(ti.inventory.items.rap), 0) + Number(balance)
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  declined: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-muted text-muted-foreground",
}

export default function TradePage() {
  const { user, refreshUser } = useAuth()
  const [tab, setTab] = useState(0)
  const [trades, setTrades] = useState<{ sent: Trade[]; received: Trade[] }>({ sent: [], received: [] })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [newTradeOpen, setNewTradeOpen] = useState(false)
  const [allUsers, setAllUsers] = useState<{ id: string; username: string }[]>([])
  const [userSearch, setUserSearch] = useState("")
  const [receiver, setReceiver] = useState<{ id: string; username: string } | null>(null)
  const [myInventory, setMyInventory] = useState<InventoryItem[]>([])
  const [theirInventory, setTheirInventory] = useState<InventoryItem[]>([])
  const [offerItems, setOfferItems] = useState<TradeItem[]>([])
  const [requestItems, setRequestItems] = useState<TradeItem[]>([])
  const [offerBalance, setOfferBalance] = useState("")
  const [requestBalance, setRequestBalance] = useState("")
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState("")

  const fetchTrades = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const res = await fetch(`/api/trades?user_id=${user.id}`)
    const data = await res.json()
    setTrades(data)
    setLoading(false)
  }, [user])

  useEffect(() => { fetchTrades() }, [fetchTrades])

  const fetchMyInventory = async () => {
    if (!user) return
    let all: InventoryItem[] = []
    let page = 0
    while (true) {
      const res = await fetch(`/api/inventory/${user.id}?page=${page}`)
      const data = await res.json()
      const batch = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : []
      all = all.concat(batch)
      if (batch.length < 1000) break
      page++
    }
    setMyInventory(all)
  }

  const fetchTheirInventory = async (userId: string) => {
    let all: InventoryItem[] = []
    let page = 0
    while (true) {
      const res = await fetch(`/api/inventory/${userId}?page=${page}`)
      const data = await res.json()
      const batch = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : []
      all = all.concat(batch)
      if (batch.length < 1000) break
      page++
    }
    setTheirInventory(all)
  }

  const fetchUsers = async () => {
    const res = await fetch("/api/users")
    const data = await res.json()
    setAllUsers(Array.isArray(data) ? data.filter((u: any) => u.id !== user?.id) : [])
  }

  const openNewTrade = async () => {
    setCreateError("")
    setOfferItems([])
    setRequestItems([])
    setOfferBalance("")
    setRequestBalance("")
    setReceiver(null)
    setTheirInventory([])
    setUserSearch("")
    await fetchMyInventory()
    await fetchUsers()
    setNewTradeOpen(true)
  }

  const handleReceiverSelect = async (val: { id: string; username: string }) => {
    setReceiver(val)
    setUserSearch(val.username)
    setRequestItems([])
    await fetchTheirInventory(val.id)
  }

  const addOfferItem = (inv: InventoryItem) => {
    if (offerItems.length >= MAX_ITEMS || offerItems.find((i) => i.id === inv.id)) return
    setOfferItems((prev) => [...prev, { id: inv.id, item: { id: inv.item_id, name: inv.items!.name, image_url: inv.items!.image_url, rarity: inv.items!.rarity, rap: Number(inv.items!.rap) } }])
  }

  const addRequestItem = (inv: InventoryItem) => {
    if (requestItems.length >= MAX_ITEMS || requestItems.find((i) => i.id === inv.id)) return
    setRequestItems((prev) => [...prev, { id: inv.id, item: { id: inv.item_id, name: inv.items!.name, image_url: inv.items!.image_url, rarity: inv.items!.rarity, rap: Number(inv.items!.rap) } }])
  }

  const handleCreateTrade = async () => {
    if (!user || !receiver) return
    const ob = Number(offerBalance) || 0
    const rb = Number(requestBalance) || 0
    if (ob > MAX_BALANCE || rb > MAX_BALANCE) { setCreateError(`Max $${MAX_BALANCE} balance per side`); return }
    setCreateLoading(true)
    setCreateError("")
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_id: user.id,
          receiver_id: receiver.id,
          sender_items: offerItems.map((i) => i.id),
          receiver_items: requestItems.map((i) => i.id),
          sender_balance: ob,
          receiver_balance: rb,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setNewTradeOpen(false)
      setSuccess("Trade sent!")
      fetchTrades()
    } catch (e: any) {
      setCreateError(e.message)
    } finally {
      setCreateLoading(false)
    }
  }

  const handleAction = async (tradeId: string, action: "accept" | "decline" | "cancel") => {
    if (!user) return
    setActionLoading(tradeId + action)
    setError("")
    try {
      const res = await fetch(`/api/trades/${tradeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, user_id: user.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess(`Trade ${action}ed!`)
      await fetchTrades()
      await refreshUser()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  const TradeCard = ({ trade, isSent }: { trade: Trade; isSent: boolean }) => {
    const other = isSent ? trade.receiver : trade.sender
    const leftItems = trade.trade_items.filter((ti) => ti.side === "sender")
    const rightItems = trade.trade_items.filter((ti) => ti.side === "receiver")
    const leftValue = tradeValueFromSide(trade.trade_items, "sender", trade.sender_balance)
    const rightValue = tradeValueFromSide(trade.trade_items, "receiver", trade.receiver_balance)
    const isPending = trade.status === "pending"
    const leftLabel = isSent ? "You Offer" : "They Offer"
    const rightLabel = isSent ? "You Request" : "They Request"

    return (
      <div className={`border rounded-xl p-4 mb-3 ${isPending ? "border-primary/30" : "border-border"}`}>
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <Avatar className="w-8 h-8">
              {other?.profile_picture && <AvatarImage src={other.profile_picture} />}
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                {other?.username?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold">
                {isSent ? "To" : "From"}{" "}
                <NextLink href={`/user/${other?.username}`} className="text-primary hover:underline">{other?.username}</NextLink>
                {other?.plus && <PlusBadge className="ml-1 align-middle" />}
              </p>
              <p className="text-xs text-muted-foreground">{new Date(trade.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[trade.status] || "bg-muted text-muted-foreground"}`}>
            {trade.status}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
          <div>
            <div className="flex justify-between mb-1">
              <p className="text-xs text-muted-foreground font-semibold">{leftLabel}</p>
              <p className="text-xs text-primary font-semibold">${leftValue.toFixed(2)}</p>
            </div>
            <div className="flex flex-wrap gap-1 min-h-[44px]">
              {leftItems.map((ti, idx) => (
                <TooltipProvider key={`${ti.id}-${idx}`}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <img src={ti.inventory.items.image_url} alt={ti.inventory.items.name}
                        className="w-11 h-11 object-contain rounded-lg"
                        style={{ border: `2px solid ${RARITY_COLORS[ti.inventory.items.rarity as Rarity]}44`, backgroundColor: "#f8fbff" }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>{ti.inventory.items.name} (RAP: ${Number(ti.inventory.items.rap).toFixed(2)})</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
              {leftItems.length === 0 && <p className="text-xs text-muted-foreground">No items</p>}
            </div>
            {Number(trade.sender_balance) > 0 && (
              <span className="text-xs font-bold text-green-600 bg-green-100 dark:bg-green-900/20 rounded px-1.5 py-0.5 mt-1 inline-block">
                +${Number(trade.sender_balance).toFixed(2)}
              </span>
            )}
          </div>

          <div className="flex items-center justify-center pt-6">
            <ArrowLeftRight size={18} className="text-muted-foreground" />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <p className="text-xs text-muted-foreground font-semibold">{rightLabel}</p>
              <p className="text-xs text-primary font-semibold">${rightValue.toFixed(2)}</p>
            </div>
            <div className="flex flex-wrap gap-1 min-h-[44px]">
              {rightItems.map((ti, idx) => (
                <TooltipProvider key={`${ti.id}-${idx}`}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <img src={ti.inventory.items.image_url} alt={ti.inventory.items.name}
                        className="w-11 h-11 object-contain rounded-lg"
                        style={{ border: `2px solid ${RARITY_COLORS[ti.inventory.items.rarity as Rarity]}44`, backgroundColor: "#f8fbff" }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>{ti.inventory.items.name} (RAP: ${Number(ti.inventory.items.rap).toFixed(2)})</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
              {rightItems.length === 0 && <p className="text-xs text-muted-foreground">No items</p>}
            </div>
            {Number(trade.receiver_balance) > 0 && (
              <span className="text-xs font-bold text-green-600 bg-green-100 dark:bg-green-900/20 rounded px-1.5 py-0.5 mt-1 inline-block">
                +${Number(trade.receiver_balance).toFixed(2)}
              </span>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-2">
          Trade value: <span className="text-primary font-bold">${leftValue.toFixed(2)}</span>{" "}vs{" "}
          <span className="text-primary font-bold">${rightValue.toFixed(2)}</span>
        </p>

        {isPending && (
          <div className="flex gap-2 justify-end mt-3">
            {isSent ? (
              <Button size="sm" variant="outline" className="text-destructive border-destructive hover:bg-destructive hover:text-white"
                onClick={() => handleAction(trade.id, "cancel")}
                disabled={actionLoading === trade.id + "cancel"}>
                Cancel
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" className="gap-1 text-destructive border-destructive hover:bg-destructive hover:text-white"
                  onClick={() => handleAction(trade.id, "decline")} disabled={!!actionLoading}>
                  <Ban size={13} /> Decline
                </Button>
                <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700"
                  onClick={() => handleAction(trade.id, "accept")} disabled={!!actionLoading}>
                  <Check size={13} /> Accept
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-lg font-semibold mb-3">Sign in to trade</p>
        <Button asChild><NextLink href="/login">Login</NextLink></Button>
      </div>
    )
  }

  const pendingReceived = trades.received.filter((t) => t.status === "pending").length
  const offerVal = tradeValue(offerItems, Number(offerBalance) || 0)
  const requestVal = tradeValue(requestItems, Number(requestBalance) || 0)
  const filteredUsers = allUsers.filter((u) => u.username.toLowerCase().includes(userSearch.toLowerCase()))

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold">Trades</h1>
        <Button className="gap-2" onClick={openNewTrade}><Plus size={15} /> New Trade</Button>
      </div>

      {error && <Alert variant="destructive" className="mb-3"><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="mb-3"><AlertDescription className="text-green-600">{success}</AlertDescription></Alert>}

      {/* Tabs */}
      <div className="flex border-b border-border mb-5">
        {[
          { label: "Received", count: pendingReceived },
          { label: "Sent", count: 0 },
        ].map((t, i) => (
          <button
            key={t.label}
            onClick={() => setTab(i)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${tab === i ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="text-[0.6rem] font-bold bg-destructive text-white rounded-full px-1.5 py-0.5">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {tab === 0 && (
            trades.received.length === 0
              ? <p className="text-muted-foreground text-center py-10">No received trades yet.</p>
              : trades.received.map((t) => <TradeCard key={t.id} trade={t} isSent={false} />)
          )}
          {tab === 1 && (
            trades.sent.length === 0
              ? <p className="text-muted-foreground text-center py-10">No sent trades yet.</p>
              : trades.sent.map((t) => <TradeCard key={t.id} trade={t} isSent={true} />)
          )}
        </>
      )}

      {/* New Trade Dialog */}
      <Dialog open={newTradeOpen} onOpenChange={(v) => !v && setNewTradeOpen(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Trade</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {/* User search */}
            <div className="flex flex-col gap-1.5">
              <Label>Trade with (username)</Label>
              <div className="relative">
                <Input
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); setReceiver(null) }}
                />
                {userSearch && !receiver && filteredUsers.length > 0 && (
                  <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filteredUsers.slice(0, 10).map((u) => (
                      <button
                        key={u.id}
                        onClick={() => handleReceiverSelect(u)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                      >
                        {u.username}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {receiver && <p className="text-xs text-green-600 font-semibold">Trading with: {receiver.username}</p>}
            </div>

            {createError && <Alert variant="destructive"><AlertDescription>{createError}</AlertDescription></Alert>}

            {/* Trade value summary */}
            <div className="flex justify-center gap-6 bg-muted/50 rounded-xl p-3">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">You Offer</p>
                <p className="text-sm font-bold text-primary">${offerVal.toFixed(2)}</p>
              </div>
              <Separator orientation="vertical" />
              <div className="text-center">
                <p className="text-xs text-muted-foreground">You Request</p>
                <p className="text-sm font-bold text-primary">${requestVal.toFixed(2)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <ItemSlots
                  items={offerItems}
                  inventory={myInventory}
                  onAdd={addOfferItem}
                  onRemove={(id) => setOfferItems((p) => p.filter((i) => i.id !== id))}
                  label="You Offer"
                />
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Your Balance Offer (max $50)</Label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      type="number"
                      value={offerBalance}
                      onChange={(e) => setOfferBalance(e.target.value)}
                      min={0} max={MAX_BALANCE} step={0.01}
                      className="pl-5 h-8 text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Your balance: ${Number(user.balance).toFixed(2)}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <ItemSlots
                  items={requestItems}
                  inventory={theirInventory}
                  onAdd={addRequestItem}
                  onRemove={(id) => setRequestItems((p) => p.filter((i) => i.id !== id))}
                  label={receiver ? `Request from ${receiver.username}` : "Select a user first"}
                />
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Request Balance (max $50)</Label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      type="number"
                      value={requestBalance}
                      onChange={(e) => setRequestBalance(e.target.value)}
                      min={0} max={MAX_BALANCE} step={0.01}
                      className="pl-5 h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTradeOpen(false)}>Cancel</Button>
            <Button
              className="gap-2"
              onClick={handleCreateTrade}
              disabled={createLoading || !receiver || (offerItems.length === 0 && requestItems.length === 0 && !offerBalance && !requestBalance)}
            >
              {createLoading ? <Loader2 size={14} className="animate-spin" /> : <ArrowLeftRight size={14} />}
              Send Trade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
