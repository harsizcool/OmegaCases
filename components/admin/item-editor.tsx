"use client"

import { useEffect, useState } from "react"
import { Loader2, Save, Trash2, EyeOff, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/lib/auth-context"
import type { Item } from "@/lib/types"

const TOKEN_KEY = "oc_session_token"
const RARITIES = ["Common", "Uncommon", "Rare", "Legendary", "Omega"]

type Usage = {
  inventory: number
  listings: number
  sales: number
  rolls: number
  battle_rolls: number
}

export function ItemEditor({
  item,
  onClose,
  onSaved,
  onDeleted,
}: {
  item: Item
  onClose: () => void
  onSaved: (updated: Item) => void
  onDeleted: (id: string) => void
}) {
  const { user } = useAuth()
  const token = typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)

  const [name, setName] = useState(item.name)
  const [imageUrl, setImageUrl] = useState(item.image_url)
  const [rarity, setRarity] = useState(item.rarity as string)
  const [likelihood, setLikelihood] = useState(String(item.likelihood ?? 0))
  const [marketPrice, setMarketPrice] = useState(String(item.market_price ?? 0))
  const [rap, setRap] = useState(String(item.rap ?? 0))
  const [limitedTime, setLimitedTime] = useState(Boolean(item.limited_time))

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [confirmName, setConfirmName] = useState("")
  const [deleting, setDeleting] = useState(false)

  const credentials = user && token ? { actor_id: user.id, session_token: token } : null

  // The counts are only fetched when someone actually moves to delete, since
  // they cost five queries and most edits never go near it.
  useEffect(() => {
    if (!confirmingDelete || usage || !credentials) return
    setUsageLoading(true)
    const params = new URLSearchParams({ ...credentials, usage: item.id })
    fetch(`/api/admin/items?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.usage) setUsage(data.usage)
        else setError(data.error ?? "Could not work out what uses this item")
      })
      .catch(() => setError("Could not work out what uses this item"))
      .finally(() => setUsageLoading(false))
  }, [confirmingDelete, usage, credentials, item.id])

  async function save(overrides?: Record<string, unknown>) {
    if (!credentials) return
    setSaving(true)
    setError("")
    setSaved(false)
    try {
      const res = await fetch("/api/admin/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...credentials,
          id: item.id,
          name,
          image_url: imageUrl,
          rarity,
          likelihood: Number(likelihood),
          market_price: Number(marketPrice),
          rap: Number(rap),
          limited_time: limitedTime,
          ...overrides,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "The item could not be saved")
      onSaved(data)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "The item could not be saved")
    } finally {
      setSaving(false)
    }
  }

  /** Sets the chance to zero: the item stays in everyone's inventory and in the
   *  history, but can never be unboxed again. */
  async function retire() {
    setLikelihood("0")
    await save({ likelihood: 0 })
  }

  async function remove() {
    if (!credentials) return
    setDeleting(true)
    setError("")
    try {
      const res = await fetch("/api/admin/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...credentials, id: item.id, confirm_name: confirmName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "The item could not be deleted")
      onDeleted(item.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "The item could not be deleted")
    } finally {
      setDeleting(false)
    }
  }

  const totalDestroyed = usage
    ? usage.inventory + usage.listings + usage.sales + usage.rolls + usage.battle_rolls
    : 0

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit item</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex gap-3 items-start">
            <img
              src={imageUrl}
              alt={name}
              className="w-20 h-20 object-contain bg-muted rounded-lg shrink-0"
            />
            <div className="flex-1 flex flex-col gap-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Image URL</Label>
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            <p className="text-[0.65rem] text-muted-foreground">
              To upload a new picture, add the item again from the Add Item tab — uploads happen
              there.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Rarity</Label>
              <Select value={rarity} onValueChange={setRarity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RARITIES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Chance (%)</Label>
              <Input
                type="number"
                step="0.001"
                min={0}
                max={100}
                value={likelihood}
                onChange={(e) => setLikelihood(e.target.value)}
              />
              <p className="text-[0.65rem] text-muted-foreground">
                {Number(likelihood) > 0
                  ? `about 1 in ${Math.round(100 / Number(likelihood)).toLocaleString()} cases`
                  : "never unboxed"}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Price ($)</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={marketPrice}
                onChange={(e) => setMarketPrice(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">RAP ($)</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={rap}
                onChange={(e) => setRap(e.target.value)}
              />
              <p className="text-[0.65rem] text-muted-foreground">
                What the item counts as in battles and inventory value.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <Label className="text-xs cursor-pointer">Limited time</Label>
            <Switch checked={limitedTime} onCheckedChange={setLimitedTime} />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {saved && (
            <Alert>
              <AlertDescription className="text-green-600">Item saved.</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button className="gap-2" disabled={saving} onClick={() => save()}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Saving…" : "Save changes"}
            </Button>
            <Button variant="ghost" onClick={onClose} disabled={saving || deleting}>
              Close
            </Button>
          </div>

          <Separator />

          {/* Removal. Retiring is offered first because it is what is almost
              always meant by "get rid of this item", and it destroys nothing. */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold">Removing this item</h3>

            <div className="rounded-lg border border-border p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <EyeOff size={14} className="text-muted-foreground" />
                <span className="text-xs font-semibold">Take it out of the pool</span>
              </div>
              <p className="text-[0.7rem] text-muted-foreground">
                Sets the chance to zero, so it can never be unboxed again. Everyone who already has
                one keeps it, and the history stays intact. This is almost always what you want.
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="self-start"
                disabled={saving || Number(likelihood) === 0}
                onClick={retire}
              >
                {Number(likelihood) === 0 ? "Already out of the pool" : "Take out of the pool"}
              </Button>
            </div>

            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-destructive" />
                <span className="text-xs font-semibold text-destructive">Delete permanently</span>
              </div>

              {!confirmingDelete ? (
                <>
                  <p className="text-[0.7rem] text-muted-foreground">
                    Erases the item and everything that refers to it, including inventories. Cannot
                    be undone.
                  </p>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="self-start gap-1.5"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    <Trash2 size={12} /> Delete permanently
                  </Button>
                </>
              ) : (
                <>
                  {usageLoading && (
                    <p className="text-[0.7rem] text-muted-foreground flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin" /> Checking what uses this item…
                    </p>
                  )}

                  {usage && (
                    <div className="text-[0.7rem] text-muted-foreground">
                      {totalDestroyed === 0 ? (
                        <p>Nothing refers to this item, so only the item itself is deleted.</p>
                      ) : (
                        <>
                          <p className="font-semibold text-destructive">
                            This also deletes {totalDestroyed.toLocaleString()} records that cannot
                            be recovered:
                          </p>
                          <ul className="list-disc pl-4 mt-1">
                            {usage.inventory > 0 && (
                              <li>
                                {usage.inventory.toLocaleString()} copies owned by players — they
                                lose them
                              </li>
                            )}
                            {usage.listings > 0 && (
                              <li>{usage.listings.toLocaleString()} marketplace listings</li>
                            )}
                            {usage.sales > 0 && <li>{usage.sales.toLocaleString()} past sales</li>}
                            {usage.rolls > 0 && (
                              <li>
                                {usage.rolls.toLocaleString()} unboxing records — the proof that
                                those rolls were fair
                              </li>
                            )}
                            {usage.battle_rolls > 0 && (
                              <li>{usage.battle_rolls.toLocaleString()} battle rolls</li>
                            )}
                          </ul>
                          <p className="mt-1">
                            Taking it out of the pool does the same job without any of this.
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[0.7rem]">
                      Type <span className="font-mono font-bold">{item.name}</span> to confirm
                    </Label>
                    <Input
                      value={confirmName}
                      onChange={(e) => setConfirmName(e.target.value)}
                      placeholder={item.name}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1.5"
                      disabled={deleting || confirmName.trim() !== item.name}
                      onClick={remove}
                    >
                      {deleting ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                      {deleting ? "Deleting…" : "Delete forever"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={deleting}
                      onClick={() => {
                        setConfirmingDelete(false)
                        setConfirmName("")
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
