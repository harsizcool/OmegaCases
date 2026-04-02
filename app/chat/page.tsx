"use client"

import { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import NextLink from "next/link"
import {
  MessageSquare, Send, Plus, Search, Crown, ArrowLeft,
  Globe, Loader2, X, CheckCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase/client"
import type { Message, Conversation, MessageSender } from "@/lib/types"

// ── helpers ────────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" })
  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

function UserAvatar({ user, size = "sm" }: { user: MessageSender; size?: "sm" | "md" }) {
  const sz = size === "md" ? "w-9 h-9" : "w-7 h-7"
  return (
    <Avatar className={sz}>
      {user.profile_picture && <AvatarImage src={user.profile_picture} />}
      <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
        {user.username[0]?.toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}

// ── New DM modal ───────────────────────────────────────────────────────────────

function NewDMModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  onSelect: (user: MessageSender) => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<MessageSender[]>([])
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(q)}&type=users&limit=8`)
      const data = res.ok ? await res.json() : {}
      const users: any[] = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : []
      setResults(users.map((u) => ({ id: u.id, username: u.username, profile_picture: u.profile_picture, plus: !!u.plus })))
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (v: string) => {
    setQuery(v)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => search(v), 280)
  }

  useEffect(() => { if (!open) { setQuery(""); setResults([]) } }, [open])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Direct Message</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-1">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search for a user…"
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              className="pl-8"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-0.5 min-h-[80px]">
            {loading && <p className="text-sm text-muted-foreground text-center py-4">Searching…</p>}
            {!loading && results.length === 0 && query.trim() && (
              <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
            )}
            {results.map((u) => (
              <button
                key={u.id}
                onClick={() => { onSelect(u); onClose() }}
                className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <UserAvatar user={u} size="md" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold truncate">{u.username}</span>
                    {u.plus && (
                      <span className="flex items-center gap-0.5 text-[0.55rem] font-bold text-amber-400 bg-amber-400/10 rounded-full px-1.5 py-0.5">
                        <Crown size={8} /> Plus
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Message bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg, isOwn }: { msg: Message; isOwn: boolean }) {
  const sender = msg.sender
  return (
    <div className={`flex items-end gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
      {!isOwn && sender && <UserAvatar user={sender} />}
      <div className={`max-w-[70%] flex flex-col gap-0.5 ${isOwn ? "items-end" : "items-start"}`}>
        {!isOwn && sender && (
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-[0.65rem] font-bold text-muted-foreground">{sender.username}</span>
            {sender.plus && <Crown size={9} className="text-amber-400" />}
          </div>
        )}
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
            isOwn
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-muted text-foreground rounded-bl-sm"
          }`}
        >
          {msg.content}
        </div>
        <div className={`flex items-center gap-1 px-1 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
          <span className="text-[0.6rem] text-muted-foreground/60">{formatTime(msg.created_at)}</span>
          {isOwn && msg.read && <CheckCheck size={10} className="text-primary/60" />}
        </div>
      </div>
    </div>
  )
}

// ── Main content (needs searchParams) ─────────────────────────────────────────

function ChatContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const withParam = searchParams.get("with")

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [convsLoading, setConvsLoading] = useState(true)
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null)
  const [activePartner, setActivePartner] = useState<MessageSender | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [msgsLoading, setMsgsLoading] = useState(false)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [newDMOpen, setNewDMOpen] = useState(false)
  const [mobileView, setMobileView] = useState<"list" | "chat">("list")

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" })
  }, [])

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch(`/api/messages/conversations?user_id=${user.id}`)
      const data = res.ok ? await res.json() : {}
      setConversations(Array.isArray(data.conversations) ? data.conversations : [])
    } finally {
      setConvsLoading(false)
    }
  }, [user])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  // Fetch messages for active conversation
  const fetchMessages = useCallback(async (partnerId: string) => {
    if (!user) return
    setMsgsLoading(true)
    try {
      const res = await fetch(`/api/messages?type=dm&user_id=${user.id}&with=${partnerId}`)
      const data = res.ok ? await res.json() : {}
      setMessages(Array.isArray(data.messages) ? data.messages : [])
      // Clear unread in conversation list
      setConversations((prev) =>
        prev.map((c) => (c.partner.id === partnerId ? { ...c, unread: 0 } : c))
      )
    } finally {
      setMsgsLoading(false)
    }
  }, [user])

  // Open conversation from URL param
  useEffect(() => {
    if (!withParam || !user) return
    // Find partner in conversations or fetch from search
    const existing = conversations.find((c) => c.partner.id === withParam)
    if (existing) {
      openConversation(existing.partner)
    } else {
      // Fetch partner info
      fetch(`/api/search?query=${withParam}&type=users&limit=1`)
        .then((r) => r.json())
        .then((d) => {
          const users: any[] = Array.isArray(d?.users) ? d.users : Array.isArray(d) ? d : []
          const u = users.find((u: any) => u.id === withParam)
          if (u) openConversation({ id: u.id, username: u.username, profile_picture: u.profile_picture, plus: !!u.plus })
        })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withParam, user, conversations.length])

  const openConversation = useCallback((partner: MessageSender) => {
    setActivePartnerId(partner.id)
    setActivePartner(partner)
    setMobileView("chat")
    fetchMessages(partner.id)
    router.replace(`/chat?with=${partner.id}`, { scroll: false })
  }, [fetchMessages, router])

  // Auto-scroll on new messages
  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  // Supabase Realtime — listen for incoming DMs
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    const channel = supabase
      .channel(`dm-inbox-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${user.id}` },
        (payload) => {
          const msg = payload.new as Message
          if (msg.type !== "dm") return

          // If this is the active conversation, append message
          if (msg.sender_id === activePartnerId) {
            // Fetch with sender info
            fetch(`/api/messages?type=dm&user_id=${user.id}&with=${msg.sender_id}&limit=1`)
              .then((r) => r.json())
              .then((d) => {
                const msgs: Message[] = Array.isArray(d.messages) ? d.messages : []
                if (msgs.length > 0) {
                  setMessages((prev) => {
                    // avoid dupe
                    if (prev.find((m) => m.id === msgs[msgs.length - 1].id)) return prev
                    return [...prev, msgs[msgs.length - 1]]
                  })
                }
              })
          }

          // Refresh conversation list
          fetchConversations()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, activePartnerId, fetchConversations])

  const sendMessage = async () => {
    if (!user || !activePartnerId || !input.trim() || sending) return
    const content = input.trim()
    setInput("")
    setSending(true)

    // Optimistic update
    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      sender_id: user.id,
      receiver_id: activePartnerId,
      content,
      type: "dm",
      read: false,
      created_at: new Date().toISOString(),
      sender: { id: user.id, username: user.username, profile_picture: user.profile_picture, plus: user.plus },
    }
    setMessages((prev) => [...prev, tempMsg])

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender_id: user.id, receiver_id: activePartnerId, content, type: "dm" }),
      })
      const data = res.ok ? await res.json() : null
      if (data?.id) {
        // Replace temp with real
        setMessages((prev) => prev.map((m) => (m.id === tempMsg.id ? { ...data } : m)))
      }
      fetchConversations()
    } finally {
      setSending(false)
    }
    inputRef.current?.focus()
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <MessageSquare size={40} className="text-muted-foreground" />
        <p className="text-lg font-bold">Sign in to use Chat</p>
        <div className="flex gap-2">
          <Button asChild><NextLink href="/login">Log In</NextLink></Button>
          <Button variant="outline" asChild><NextLink href="/register">Register</NextLink></Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* ── Sidebar ── */}
      <aside
        className={`flex flex-col w-full md:w-72 shrink-0 border-r border-border/60 bg-card/60
          ${mobileView === "chat" ? "hidden md:flex" : "flex"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-primary" />
            <span className="text-sm font-bold">Direct Messages</span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setNewDMOpen(true)}>
              <Plus size={14} />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1 text-muted-foreground" asChild>
              <NextLink href="/chat/public">
                <Globe size={12} /> Public
              </NextLink>
            </Button>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto py-1">
          {convsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
              <MessageSquare size={28} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No conversations yet</p>
              <Button size="sm" variant="outline" className="gap-1.5 mt-1" onClick={() => setNewDMOpen(true)}>
                <Plus size={12} /> Start one
              </Button>
            </div>
          ) : (
            conversations.map((conv) => {
              const active = conv.partner.id === activePartnerId
              return (
                <button
                  key={conv.partner.id}
                  onClick={() => openConversation(conv.partner)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 transition-colors text-left relative
                    ${active ? "bg-primary/10" : "hover:bg-muted/60"}`}
                >
                  <div className="relative shrink-0">
                    <UserAvatar user={conv.partner} size="md" />
                    {conv.unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-primary text-primary-foreground text-[0.55rem] font-bold rounded-full flex items-center justify-center px-0.5">
                        {conv.unread > 9 ? "9+" : conv.unread}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className={`text-sm font-semibold truncate ${conv.unread > 0 ? "text-foreground" : "text-foreground/80"}`}>
                          {conv.partner.username}
                        </span>
                        {conv.partner.plus && <Crown size={9} className="text-amber-400 shrink-0" />}
                      </div>
                      <span className="text-[0.6rem] text-muted-foreground/60 shrink-0">
                        {formatTime(conv.last_at)}
                      </span>
                    </div>
                    <p className={`text-xs truncate ${conv.unread > 0 ? "text-muted-foreground font-medium" : "text-muted-foreground/60"}`}>
                      {conv.last_message}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </aside>

      {/* ── Chat window ── */}
      <main
        className={`flex-1 flex flex-col min-w-0
          ${mobileView === "list" ? "hidden md:flex" : "flex"}`}
      >
        {!activePartner ? (
          // Empty state
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquare size={28} className="text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold mb-1">Your messages</p>
              <p className="text-sm text-muted-foreground">Select a conversation or start a new DM</p>
            </div>
            <Button className="gap-1.5 mt-1" onClick={() => setNewDMOpen(true)}>
              <Plus size={14} /> New Message
            </Button>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-card/40 shrink-0">
              <Button
                variant="ghost" size="sm" className="md:hidden h-7 w-7 p-0 mr-1"
                onClick={() => { setMobileView("list"); router.replace("/chat", { scroll: false }) }}
              >
                <ArrowLeft size={15} />
              </Button>
              <UserAvatar user={activePartner} size="md" />
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-bold truncate">{activePartner.username}</span>
                {activePartner.plus && (
                  <span className="flex items-center gap-0.5 text-[0.55rem] font-bold text-amber-400 bg-amber-400/10 rounded-full px-1.5 py-0.5">
                    <Crown size={8} /> Plus
                  </span>
                )}
              </div>
              <Button
                variant="ghost" size="sm" className="ml-auto h-7 px-2 text-xs text-muted-foreground gap-1" asChild
              >
                <NextLink href={`/user/${activePartner.username}`}>Profile</NextLink>
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
              {msgsLoading ? (
                <div className="flex-1 flex justify-center items-center">
                  <Loader2 size={24} className="animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
                  <UserAvatar user={activePartner} size="md" />
                  <p className="text-sm font-semibold">{activePartner.username}</p>
                  <p className="text-xs text-muted-foreground">This is the beginning of your conversation</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} isOwn={msg.sender_id === user.id} />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-border/40 bg-card/40 shrink-0">
              <form
                onSubmit={(e) => { e.preventDefault(); sendMessage() }}
                className="flex items-center gap-2"
              >
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`Message ${activePartner.username}…`}
                  maxLength={500}
                  className="flex-1 bg-muted/60 border-border/40 focus:border-primary/40"
                  autoComplete="off"
                />
                <Button type="submit" size="sm" disabled={!input.trim() || sending} className="px-3 shrink-0">
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </Button>
              </form>
              {input.length > 400 && (
                <p className="text-[0.6rem] text-muted-foreground mt-1 text-right">{500 - input.length} chars left</p>
              )}
            </div>
          </>
        )}
      </main>

      <NewDMModal
        open={newDMOpen}
        onClose={() => setNewDMOpen(false)}
        onSelect={openConversation}
      />
    </div>
  )
}

// ── Page export (Suspense required for useSearchParams) ───────────────────────

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 size={28} className="animate-spin text-muted-foreground" />
      </div>
    }>
      <ChatContent />
    </Suspense>
  )
}
