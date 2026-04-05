"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import NextLink from "next/link"
import { Globe, Send, Loader2, MessageSquare, Crown, ArrowLeft, AtSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase/client"
import type { Message, MessageSender } from "@/lib/types"
import { filterChat } from "@/lib/chat-filter"

// ── helpers ────────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  if (diffMs < 60_000) return "just now"
  if (diffMs < 3600_000) return `${Math.floor(diffMs / 60_000)}m ago`
  if (diffMs < 86400_000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

function shouldShowHeader(msgs: Message[], idx: number) {
  if (idx === 0) return true
  const prev = msgs[idx - 1]
  const cur = msgs[idx]
  if (prev.sender_id !== cur.sender_id) return true
  return new Date(cur.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60_000
}

// Render message text with @mention highlighting and clickable links
function MessageContent({
  content,
  myUsername,
}: {
  content: string
  myUsername?: string
}) {
  const parts = content.split(/(https?:\/\/[^\s<>"{}|\\^`[\]]+|@\w+)/)
  return (
    <p className="text-sm text-foreground/90 leading-relaxed break-words">
      {parts.map((part, i) => {
        if (/^https?:\/\//.test(part)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 opacity-90 hover:opacity-100 break-all"
            >
              {part}
            </a>
          )
        }
        if (/^@\w+$/.test(part)) {
          const isMine = myUsername && part.toLowerCase() === `@${myUsername.toLowerCase()}`
          return (
            <span
              key={i}
              className={
                isMine
                  ? "bg-primary/25 text-primary font-bold rounded px-0.5 mx-0.5"
                  : "text-primary font-semibold"
              }
            >
              {part}
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </p>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function PublicChatPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [onlineCount, setOnlineCount] = useState(0)

  // @mention autocomplete
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionResults, setMentionResults] = useState<MessageSender[]>([])
  const [mentionIdx, setMentionIdx] = useState(0)
  const mentionDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const atBottomRef = useRef(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback((instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? "instant" : "smooth" })
  }, [])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  // Fetch mention suggestions
  const fetchMentions = useCallback(async (q: string) => {
    if (!q) { setMentionResults([]); return }
    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(q)}&type=users&limit=6`)
      const data = res.ok ? await res.json() : {}
      const users: any[] = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : []
      setMentionResults(
        users.map((u) => ({ id: u.id, username: u.username, profile_picture: u.profile_picture, plus: !!u.plus }))
      )
    } catch { setMentionResults([]) }
  }, [])

  // Handle input change — detect @mention mode
  const handleInputChange = (val: string) => {
    setInput(val)
    // Check if the last "word" (no spaces) starts with @
    const match = val.match(/@(\w*)$/)
    if (match) {
      const q = match[1]
      setMentionQuery(q)
      setMentionIdx(0)
      if (mentionDebounce.current) clearTimeout(mentionDebounce.current)
      mentionDebounce.current = setTimeout(() => fetchMentions(q), 200)
    } else {
      setMentionQuery(null)
      setMentionResults([])
    }
  }

  // Insert @username into input at the @partial position
  const insertMention = useCallback((username: string) => {
    setInput((prev) => prev.replace(/@(\w*)$/, `@${username} `))
    setMentionQuery(null)
    setMentionResults([])
    setMentionIdx(0)
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  const closeMention = useCallback(() => {
    setMentionQuery(null)
    setMentionResults([])
    setMentionIdx(0)
  }, [])

  // Keyboard navigation for mention dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionQuery !== null && mentionResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setMentionIdx((i) => Math.min(i + 1, mentionResults.length - 1))
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setMentionIdx((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        insertMention(mentionResults[mentionIdx]?.username ?? "")
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        closeMention()
        return
      }
    }
  }

  // Fetch initial messages
  useEffect(() => {
    fetch("/api/messages?type=public&limit=80")
      .then((r) => r.json())
      .then((d) => {
        setMessages(Array.isArray(d.messages) ? d.messages : [])
        setLoading(false)
        setTimeout(() => scrollToBottom(true), 50)
      })
  }, [scrollToBottom])

  // Supabase Realtime
  useEffect(() => {
    const supabase = createClient()

    // Presence
    const presenceChannel = supabase.channel("public-chat-presence", {
      config: { presence: { key: user?.id ?? `anon-${Math.random()}` } },
    })
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        setOnlineCount(Object.keys(presenceChannel.presenceState()).length)
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && user) {
          await presenceChannel.track({ user_id: user.id, username: user.username })
        }
      })

    // New public messages
    const msgChannel = supabase
      .channel("public-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: "type=eq.public" },
        (payload) => {
          const msg = payload.new as Message
          fetch(`/api/messages?type=public&limit=1`)
            .then((r) => r.json())
            .then((d) => {
              const msgs: Message[] = Array.isArray(d.messages) ? d.messages : []
              const latest = msgs[msgs.length - 1]
              if (latest?.id === msg.id) {
                setMessages((prev) => {
                  if (prev.find((m) => m.id === latest.id)) return prev
                  const next = [...prev, latest]
                  if (atBottomRef.current) setTimeout(() => scrollToBottom(), 50)
                  return next
                })
              }
            })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(presenceChannel)
      supabase.removeChannel(msgChannel)
    }
  }, [user, scrollToBottom])

  const sendMessage = async () => {
    if (!user || !input.trim() || sending) return
    const content = filterChat(input.trim())
    setInput("")
    closeMention()
    setSending(true)

    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      sender_id: user.id,
      receiver_id: null,
      content,
      type: "public",
      read: true,
      created_at: new Date().toISOString(),
      sender: { id: user.id, username: user.username, profile_picture: user.profile_picture, plus: user.plus },
    }
    setMessages((prev) => [...prev, tempMsg])
    setTimeout(() => scrollToBottom(), 50)

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender_id: user.id, content, type: "public" }),
      })
      const data = res.ok ? await res.json() : null
      if (data?.id) {
        setMessages((prev) => prev.map((m) => (m.id === tempMsg.id ? { ...data } : m)))
      }
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-card/60 shrink-0">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
          <NextLink href="/chat"><ArrowLeft size={15} /></NextLink>
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Globe size={15} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Public Chat</p>
            <p className="text-[0.65rem] text-muted-foreground leading-tight">
              {onlineCount > 0 ? `${onlineCount} online` : "Global"}
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground" asChild>
            <NextLink href="/chat"><MessageSquare size={12} /> DMs</NextLink>
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-0.5"
      >
        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
            <Globe size={32} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No messages yet — be the first!</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const sender = msg.sender
            const showHeader = shouldShowHeader(messages, idx)
            const isOwn = msg.sender_id === user?.id
            return (
              <div key={msg.id} className={`flex gap-2.5 ${showHeader ? "mt-3" : "mt-0.5"}`}>
                <div className="w-8 shrink-0">
                  {showHeader && sender && (
                    <Avatar className="w-8 h-8">
                      {sender.profile_picture && <AvatarImage src={sender.profile_picture} />}
                      <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                        {sender.username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {showHeader && sender && (
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <NextLink
                        href={`/user/${sender.username}`}
                        className={`text-sm font-bold hover:underline ${isOwn ? "text-primary" : "text-foreground"}`}
                      >
                        {sender.username}
                      </NextLink>
                      {sender.plus && <Crown size={9} className="text-amber-400" />}
                      <span className="text-[0.6rem] text-muted-foreground/50">{formatTime(msg.created_at)}</span>
                    </div>
                  )}
                  <MessageContent content={msg.content} myUsername={user?.username} />
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-border/40 bg-card/40 shrink-0">
        {!user ? (
          <div className="flex items-center justify-center gap-3 py-1">
            <p className="text-sm text-muted-foreground">
              <NextLink href="/login" className="text-primary hover:underline">Sign in</NextLink> to chat
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* @mention autocomplete dropdown */}
            {mentionQuery !== null && mentionResults.length > 0 && (
              <div className="absolute bottom-full mb-2 left-0 right-0 bg-popover border border-border/60 rounded-xl shadow-xl overflow-hidden z-20">
                <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border/40">
                  <AtSign size={11} className="text-muted-foreground" />
                  <span className="text-[0.6rem] font-bold text-muted-foreground uppercase tracking-wider">Mention a user</span>
                </div>
                {mentionResults.map((u, i) => (
                  <button
                    key={u.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); insertMention(u.username) }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left ${
                      i === mentionIdx ? "bg-primary/10 text-primary" : "hover:bg-muted"
                    }`}
                  >
                    <Avatar className="w-6 h-6 shrink-0">
                      {u.profile_picture && <AvatarImage src={u.profile_picture} />}
                      <AvatarFallback className="text-[0.6rem] bg-primary/20 text-primary">
                        {u.username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-semibold">{u.username}</span>
                    {u.plus && <Crown size={9} className="text-amber-400 ml-0.5" />}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); sendMessage() }} className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message everyone… (type @ to mention)"
                maxLength={500}
                className="flex-1 bg-muted/60 border-border/40 focus:border-primary/40"
                autoComplete="off"
              />
              <Button type="submit" size="sm" disabled={!input.trim() || sending} className="px-3 shrink-0">
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </Button>
            </form>
          </div>
        )}
        {input.length > 400 && (
          <p className="text-[0.6rem] text-muted-foreground mt-1 text-right">{500 - input.length} chars left</p>
        )}
      </div>
    </div>
  )
}
