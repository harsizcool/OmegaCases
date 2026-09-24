"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import NextLink from "next/link"
import { Loader2, Send, Plus, ArrowLeft, CheckCircle2, LifeBuoy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/lib/auth-context"

const TOKEN_KEY = "oc_session_token"

const CATEGORIES = [
  { value: "payment", label: "Deposits and withdrawals" },
  { value: "account", label: "My account" },
  { value: "trade", label: "Trades and the marketplace" },
  { value: "bug", label: "Something is broken" },
  { value: "report", label: "Reporting someone" },
  { value: "other", label: "Something else" },
]

const STATUS_LABEL: Record<string, string> = {
  open: "Waiting for support",
  answered: "Support replied",
  closed: "Closed",
}

const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-500/15 text-amber-500",
  answered: "bg-green-500/15 text-green-500",
  closed: "bg-muted text-muted-foreground",
}

type Ticket = {
  id: string
  subject: string
  category: string
  status: string
  last_message_at: string
  unread_for_user?: boolean
  created_at: string
}

type Message = {
  id: string
  from_staff: boolean
  body: string
  created_at: string
  users?: { username: string } | null
}

function when(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(iso).toLocaleDateString()
}

// useSearchParams needs a Suspense boundary, because the page is prerendered at
// build time and the query string only exists per request.
export default function SupportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 size={28} className="animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SupportView />
    </Suspense>
  )
}

function SupportView() {
  const { user, loading: authLoading } = useAuth()
  const params = useSearchParams()

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [notice, setNotice] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Which thread is open. The link in a notification names one directly.
  const [openId, setOpenId] = useState<string | null>(params.get("ticket"))
  const [thread, setThread] = useState<{ ticket: Ticket; messages: Message[] } | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)

  const [composing, setComposing] = useState(false)
  const [subject, setSubject] = useState("")
  const [category, setCategory] = useState("other")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)

  const token = typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)
  const credentials = user && token ? { user_id: user.id, session_token: token } : null

  const loadTickets = useCallback(async () => {
    if (!credentials) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/support?${new URLSearchParams(credentials)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Could not load your tickets")
      setTickets(data.tickets)
      setNotice(data.notice ?? "")
      setEnabled(data.enabled !== false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your tickets")
    } finally {
      setLoading(false)
    }
  }, [credentials])

  const loadThread = useCallback(
    async (id: string) => {
      if (!credentials) return
      setThreadLoading(true)
      setError("")
      try {
        const res = await fetch(`/api/support?${new URLSearchParams({ ...credentials, ticket_id: id })}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Could not open that ticket")
        setThread({ ticket: data.ticket, messages: data.messages })
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not open that ticket")
        setOpenId(null)
      } finally {
        setThreadLoading(false)
      }
    },
    [credentials]
  )

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  useEffect(() => {
    if (openId) loadThread(openId)
    else setThread(null)
  }, [openId, loadThread])

  async function send() {
    if (!credentials) return
    setSending(true)
    setError("")
    try {
      const payload: Record<string, unknown> = { ...credentials, body }
      if (openId) payload.ticket_id = openId
      else {
        payload.subject = subject
        payload.category = category
      }

      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Could not send that")

      setBody("")
      setSubject("")
      setComposing(false)
      await loadTickets()
      const id = openId ?? data.ticket?.id
      if (id) {
        setOpenId(id)
        await loadThread(id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send that")
    } finally {
      setSending(false)
    }
  }

  async function closeTicket() {
    if (!credentials || !openId) return
    setSending(true)
    try {
      await fetch("/api/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...credentials, ticket_id: openId }),
      })
      await loadTickets()
      await loadThread(openId)
    } finally {
      setSending(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={28} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center flex flex-col gap-4">
        <LifeBuoy size={32} className="mx-auto text-muted-foreground" />
        <h1 className="text-2xl font-bold">Support</h1>
        <p className="text-sm text-muted-foreground">
          Log in to message support, so we can see which account you are asking about.
        </p>
        <Button asChild>
          <NextLink href="/login">Log in</NextLink>
        </Button>
      </div>
    )
  }

  // ─── one thread ────────────────────────────────────────────────────────────
  if (openId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-4">
        <Button variant="ghost" className="self-start gap-1.5 -ml-2" onClick={() => setOpenId(null)}>
          <ArrowLeft size={14} /> All tickets
        </Button>

        {threadLoading && !thread ? (
          <Loader2 size={24} className="animate-spin text-muted-foreground mx-auto my-10" />
        ) : thread ? (
          <>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">{thread.ticket.subject}</h1>
                <span
                  className={`text-[0.65rem] font-bold px-1.5 py-0.5 rounded ${
                    STATUS_STYLE[thread.ticket.status]
                  }`}
                >
                  {STATUS_LABEL[thread.ticket.status]?.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Opened {when(thread.ticket.created_at)}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {thread.messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl border p-3 ${
                    m.from_staff
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-muted/30 sm:ml-8"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold">
                      {m.from_staff ? "Support" : (m.users?.username ?? "You")}
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

            {thread.ticket.status === "closed" ? (
              <Alert>
                <AlertDescription className="text-xs">
                  This ticket is closed. Open a new one if you still need help.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex flex-col gap-2">
                <Textarea
                  placeholder="Add to this ticket…"
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button className="gap-2" disabled={sending || !body.trim()} onClick={send}>
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Send
                  </Button>
                  <Button variant="ghost" className="gap-1.5" disabled={sending} onClick={closeTicket}>
                    <CheckCircle2 size={14} /> This is sorted
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    )
  }

  // ─── the list ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">Support</h1>
        <p className="text-sm text-muted-foreground">
          Message us about anything — payments, your account, or something that looks broken. Replies
          arrive as a notification.
        </p>
      </div>

      {notice && (
        <Alert>
          <AlertDescription className="text-sm">{notice}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {composing || tickets.length === 0 ? (
        !enabled ? (
          <Alert>
            <AlertDescription>
              Support is not taking new tickets at the moment. Please check back later.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="rounded-xl border border-border p-4 flex flex-col gap-3">
            <h2 className="text-sm font-bold">New ticket</h2>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">What is it about?</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Subject</Label>
              <Input
                placeholder="A one-line summary"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Message</Label>
              <Textarea
                placeholder="What happened? Include anything that would help us find it — amounts, item names, times."
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="gap-2"
                disabled={sending || !subject.trim() || !body.trim()}
                onClick={send}
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Send to support
              </Button>
              {tickets.length > 0 && (
                <Button variant="ghost" disabled={sending} onClick={() => setComposing(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )
      ) : (
        <Button className="gap-2 self-start" onClick={() => setComposing(true)} disabled={!enabled}>
          <Plus size={14} /> New ticket
        </Button>
      )}

      {loading ? (
        <Loader2 size={24} className="animate-spin text-muted-foreground mx-auto my-6" />
      ) : (
        tickets.length > 0 && (
          <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
            {tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => setOpenId(t.id)}
                className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{t.subject}</span>
                    {t.unread_for_user && (
                      <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                        NEW
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {STATUS_LABEL[t.status]} · {when(t.last_message_at)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  )
}
