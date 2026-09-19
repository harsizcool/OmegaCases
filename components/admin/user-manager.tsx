"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Search, Star, Package, DollarSign, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/lib/auth-context"

const TOKEN_KEY = "oc_session_token"

type ManagedUser = {
  id: string
  username: string
  profile_picture: string | null
  balance: number
  zites_balance: number
  cases_remaining: number
  plus: boolean
  admin: boolean
}

type Mode = "add" | "set"

export function UserManager() {
  const { user, refreshUser } = useAuth()

  const [query, setQuery] = useState("")
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState("")

  const [selected, setSelected] = useState<ManagedUser | null>(null)
  const [balanceMode, setBalanceMode] = useState<Mode>("add")
  const [balanceValue, setBalanceValue] = useState("")
  const [casesMode, setCasesMode] = useState<Mode>("add")
  const [casesValue, setCasesValue] = useState("")
  const [plus, setPlus] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [applied, setApplied] = useState<string[]>([])

  const token = typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)

  const load = useCallback(
    async (search: string) => {
      if (!user || !token) return
      setLoading(true)
      setListError("")
      try {
        const params = new URLSearchParams({ actor_id: user.id, session_token: token, q: search })
        const res = await fetch(`/api/admin/users?${params}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Could not load accounts")
        setUsers(data.users)
      } catch (e) {
        setListError(e instanceof Error ? e.message : "Could not load accounts")
      } finally {
        setLoading(false)
      }
    },
    [user, token]
  )

  useEffect(() => {
    load("")
  }, [load])

  // Opening an account resets the form to that account's current state, so the
  // Plus switch always shows what is true right now rather than a stale value.
  function open(target: ManagedUser) {
    setSelected(target)
    setBalanceMode("add")
    setBalanceValue("")
    setCasesMode("add")
    setCasesValue("")
    setPlus(target.plus)
    setError("")
    setApplied([])
  }

  async function apply() {
    if (!selected || !user || !token) return
    setSaving(true)
    setError("")
    setApplied([])

    const payload: Record<string, unknown> = {
      actor_id: user.id,
      session_token: token,
      target_id: selected.id,
    }
    if (balanceValue.trim() !== "") {
      payload.balance = { mode: balanceMode, value: Number(balanceValue) }
    }
    if (casesValue.trim() !== "") {
      payload.cases = { mode: casesMode, value: Number(casesValue) }
    }
    if (plus !== selected.plus) {
      payload.plus = plus
    }

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "The change could not be applied")

      setApplied(data.changed?.length ? data.changed : ["nothing to change"])
      setBalanceValue("")
      setCasesValue("")
      if (data.user) {
        setSelected(data.user)
        setPlus(data.user.plus)
        setUsers((current) => current.map((u) => (u.id === data.user.id ? data.user : u)))
      }
      // The header shows your own balance and case count, so refresh it when
      // you were the one adjusted.
      if (selected.id === user.id) await refreshUser()
    } catch (e) {
      setError(e instanceof Error ? e.message : "The change could not be applied")
    } finally {
      setSaving(false)
    }
  }

  const nothingEntered =
    balanceValue.trim() === "" && casesValue.trim() === "" && (!selected || plus === selected.plus)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold">Accounts</h2>
        <p className="text-xs text-muted-foreground">
          Adjust balance, unopened cases and Plus membership. Changes take effect at once, and
          anyone other than you is notified that their account was adjusted.
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          load(query)
        }}
      >
        <Input
          value={query}
          placeholder="Search by username"
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button type="submit" variant="secondary" className="gap-1.5" disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Search
        </Button>
        {user && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setQuery(user.username)
              load(user.username)
            }}
          >
            Find me
          </Button>
        )}
      </form>

      {listError && (
        <Alert variant="destructive">
          <AlertDescription>{listError}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
        {loading && users.length === 0 && (
          <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Loading accounts…
          </div>
        )}
        {!loading && users.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            {query ? `No account matches “${query}”.` : "No accounts yet."}
          </p>
        )}
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => open(u)}
            className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-muted/50 ${
              selected?.id === u.id ? "bg-muted" : ""
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold truncate">{u.username}</span>
                {u.id === user?.id && (
                  <span className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    YOU
                  </span>
                )}
                {u.admin && (
                  <span className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    ADMIN
                  </span>
                )}
                {u.plus && (
                  <span className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400">
                    PLUS
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                ${Number(u.balance).toFixed(2)} · {u.cases_remaining ?? 0} cases
              </p>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {selected?.id === u.id ? "Editing" : "Adjust"}
            </span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="rounded-xl border border-border p-4 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-bold">{selected.username}</h3>
            <p className="text-xs text-muted-foreground">
              Now: ${Number(selected.balance).toFixed(2)} · {selected.cases_remaining ?? 0} cases ·{" "}
              {selected.plus ? "Plus member" : "no Plus"}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <DollarSign size={12} /> Balance
              </Label>
              <div className="flex gap-2">
                <ModeToggle mode={balanceMode} onChange={setBalanceMode} />
                <Input
                  type="number"
                  step="0.01"
                  min={balanceMode === "add" ? undefined : 0}
                  placeholder={balanceMode === "add" ? "e.g. 25.00" : "e.g. 100.00"}
                  value={balanceValue}
                  onChange={(e) => setBalanceValue(e.target.value)}
                />
              </div>
              <p className="text-[0.65rem] text-muted-foreground">
                {balanceMode === "add"
                  ? "Added to the current balance. A negative number takes it away."
                  : "Replaces the current balance."}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Package size={12} /> Cases
              </Label>
              <div className="flex gap-2">
                <ModeToggle mode={casesMode} onChange={setCasesMode} />
                <Input
                  type="number"
                  step="1"
                  placeholder={casesMode === "add" ? "e.g. 100" : "e.g. 0"}
                  value={casesValue}
                  onChange={(e) => setCasesValue(e.target.value)}
                />
              </div>
              <p className="text-[0.65rem] text-muted-foreground">
                Unopened cases, the same ones a purchase grants.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <Label className="text-xs flex items-center gap-1.5 cursor-pointer">
              <Star size={12} /> OmegaCases Plus
            </Label>
            <Switch checked={plus} onCheckedChange={setPlus} />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {applied.length > 0 && (
            <Alert>
              <AlertDescription className="text-green-600 flex items-center gap-1.5">
                <Check size={14} /> {applied.join(", ")}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button className="gap-2" disabled={saving || nothingEntered} onClick={apply}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Applying…" : "Apply changes"}
            </Button>
            <Button variant="ghost" onClick={() => setSelected(null)} disabled={saving}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Switches between adding to a value and replacing it. */
function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <div className="flex rounded-md border border-border overflow-hidden shrink-0">
      {(["add", "set"] as Mode[]).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
            mode === option
              ? "bg-primary text-primary-foreground"
              : "bg-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {option === "add" ? "Add" : "Set"}
        </button>
      ))}
    </div>
  )
}
