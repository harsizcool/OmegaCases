"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Send, ArrowLeft, Save, Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/lib/auth-context"

const TOKEN_KEY = "oc_session_token"

const QUEUES = [
  { value: "open", label: "Waiting" },
  { value: "answered", label: "Answered" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
]

const CATEGORY_LABEL: Record<string, string> = {
  payment: "Payments",
  account: "Account",
  trade: "Trades",
  bug: "Broken",
  report: "Report",
  other: "Other",
}

type Ticket = {
  id: string
  user_id: string
  subject: string
  category: string
  status: string
  last_message_at: string
  unread_for_staff?: boolean
  created_at: string
  users?: { username: string; plus?: boolean } | null
}

type Message = {
  id: string
  from_staff: boolean
  body: string
  created_at: string
  users?: { username: string } | null
}

function when(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(iso).toLocaleDateString()
}

export function SupportPanel() {
  const { user } = useAuth()
  const token = typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)
  const credentials = user && token ? { actor_id: user.id, session_token: token } : null

  const [queue, setQueue] = useState("open")
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [waiting, setWaiting] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [openId, setOpenId] = useState<string | null>(null)
  const [thread, setThread] = useState<{ ticket: Ticket; messages: Message[] } | null>(null)
  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)

  // Whether the support page takes new tickets, and the note shown above its form.
  const [supportEnabled, setSupportEnabled] = useState(true)
  const [supportNotice, setSupportNotice] = useState("")
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  const loadQueue = useCallback(
    async (status: string) => {
      if (!credentials) return
      setLoading(true)
      setError("")
      try {
        const res = await fetch(`/api/admin/support?${new URLSearchParams({ ...credentials, status })}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Could not load tickets")
        setTickets(data.tickets)
        setWaiting(data.waiting)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load tickets")
      } finally {
        setLoading(false)
      }
    },
    [credentials]
  )

  const loadThread = useCallback(
    async (id: string) => {
      if (!credentials) return
      try {
        const res = await fetch(
          `/api/admin/support?${new URLSearchParams({ ...credentials, ticket_id: id })}`
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Could not open that ticket")
        setThread({ ticket: data.ticket, messages: data.messages })
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not open that ticket")
      }
    },
    [credentials]
  )

  useEffect(() => {
    loadQueue(queue)
  }, [queue, loadQueue])

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.support_enabled === "boolean") setSupportEnabled(data.support_enabled)
        if (typeof data.support_notice === "string") setSupportNotice(data.support_notice)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (openId) loadThread(openId)
    else setThread(null)
  }, [openId, loadThread])

  async function act(status?: string) {
    if (!credentials || !openId) return
    setSending(true)
    setError("")
    try {
      const res = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...credentials, ticket_id: openId, body: reply, status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Could not send that")
      setReply("")
      await loadThread(openId)
      await loadQueue(queue)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send that")
    } finally {
      setSending(false)
    }
  }

  async function saveSettings(enabled: boolean, notice: string) {
    if (!user) return
    setSettingsSaving(true)
    setSettingsSaved(false)
    try {
      const save = (key: string, value: unknown) =>
        fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value, user_id: user.id }),
        })
      await Promise.all([save("support_enabled", enabled), save("support_notice", notice)])
      setSupportEnabled(enabled)
      setSettingsSaved(true)
    } catch {
      setError("Could not save the support settings")
    } finally {
      setSettingsSaving(false)
    }
  }

  // ─── one thread ────────────────────────────────────────────────────────────
  if (openId && thread) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" className="self-start gap-1.5 -ml-2" onClick={() => setOpenId(null)}>
          <ArrowLeft size={14} /> Back to the queue
        </Button>

        <div>
          <h2 className="text-lg font-bold">{thread.ticket.subject}</h2>
          <p className="text-xs text-muted-foreground">
            {thread.ticket.users?.username ?? "unknown"} ·{" "}
            {CATEGORY_LABEL[thread.ticket.category] ?? thread.ticket.category} · opened{" "}
            {when(thread.ticket.created_at)}
          </p>
        </div>

        <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-1">
          {thread.messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl border p-3 ${
                m.from_staff ? "border-primary/30 bg-primary/5 sm:ml-8" : "border-border bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-bold">
                  {m.from_staff ? `${m.users?.username ?? "Support"} (staff)` : m.users?.username}
                </span>
                <span className="text-[0.65rem] text-muted-foreground">{when(m.created_at)}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
            </div>
          ))}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Textarea
          placeholder="Your reply. The player gets a notification linking straight to this ticket."
          rows={4}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
        />
        <div className="flex gap-2 flex-wrap">
          <Button className="gap-2" disabled={sending || !reply.trim()} onClick={() => act()}>
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send reply
          </Button>
          <Button
            variant="secondary"
            disabled={sending}
            onClick={() => act("closed")}
            title="Closes the ticket, sending the reply first if you wrote one"
          >
            {reply.trim() ? "Reply and close" : "Close ticket"}
          </Button>
          {thread.ticket.status === "closed" && (
            <Button variant="ghost" disabled={sending} onClick={() => act("open")}>
              Reopen
            </Button>
          )}
        </div>
      </div>
    )
  }

  // ─── queue and settings ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          Support
          {waiting > 0 && (
            <span className="text-[0.7rem] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500">
              {waiting} waiting
            </span>
          )}
        </h2>
        <p className="text-xs text-muted-foreground">
          Tickets players have sent. Replying notifies them with a link to the thread.
        </p>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {QUEUES.map((q) => (
          <button
            key={q.value}
            onClick={() => setQueue(q.value)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              queue === q.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
        {loading ? (
          <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Inbox size={20} />
            {queue === "open" ? "Nothing waiting. All caught up." : "No tickets here."}
          </div>
        ) : (
          tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => setOpenId(t.id)}
              className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold truncate">{t.subject}</span>
                {t.unread_for_staff && (
                  <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-black">
                    NEW
                  </span>
                )}
                <span className="text-[0.65rem] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {CATEGORY_LABEL[t.category] ?? t.category}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t.users?.username ?? "unknown"} · {when(t.last_message_at)}
              </p>
            </button>
          ))
        )}
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold">Support page settings</h3>

        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <div>
            <Label className="text-xs cursor-pointer">Accept new tickets</Label>
            <p className="text-[0.7rem] text-muted-foreground">
              Turn off and players can still read their existing tickets, but cannot open new ones.
            </p>
          </div>
          <Switch
            checked={supportEnabled}
            disabled={settingsSaving}
            onCheckedChange={(v) => saveSettings(v, supportNotice)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Note shown above the form</Label>
          <Input
            placeholder="e.g. Replies usually take a day. Never share your password."
            value={supportNotice}
            onChange={(e) => setSupportNotice(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="gap-1.5 self-start"
              disabled={settingsSaving}
              onClick={() => saveSettings(supportEnabled, supportNotice)}
            >
              {settingsSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Save note
            </Button>
            {settingsSaved && <span className="text-xs text-green-600">Saved</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
