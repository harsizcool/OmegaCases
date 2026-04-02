"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import NextLink from "next/link"
import { Globe, Send, Loader2, MessageSquare, Crown, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase/client"
import type { Message, MessageSender } from "@/lib/types"

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
  const gap = new Date(cur.created_at).getTime() - new Date(prev.created_at).getTime()
  return gap > 5 * 60 * 1000 // 5 min gap = new group
}

export default function PublicChatPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [onlineCount, setOnlineCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const atBottomRef = useRef(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback((instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? "instant" : "smooth" })
  }, [])

  // Track scroll position to decide whether to auto-scroll on new message
  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
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

  // Supabase Realtime — new public messages
  useEffect(() => {
    const supabase = createClient()

    // Track online users via Presence
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

    // Realtime inserts
    const msgChannel = supabase
      .channel("public-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: "type=eq.public" },
        (payload) => {
          const msg = payload.new as Message
          // Fetch with sender info
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
    const content = input.trim()
    setInput("")
    setSending(true)

    // Optimistic
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
                {/* Avatar column — only shown on header rows */}
                <div className="w-8 shrink-0 flex flex-col items-center">
                  {showHeader && sender && (
                    <Avatar className="w-8 h-8">
                      {sender.profile_picture && <AvatarImage src={sender.profile_picture} />}
                      <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                        {sender.username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>

                {/* Content */}
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
                  <p className="text-sm text-foreground/90 leading-relaxed break-words">{msg.content}</p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border/40 bg-card/40 shrink-0">
        {!user ? (
          <div className="flex items-center justify-center gap-3 py-1">
            <p className="text-sm text-muted-foreground">
              <NextLink href="/login" className="text-primary hover:underline">Sign in</NextLink> to chat
            </p>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); sendMessage() }} className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message everyone…"
              maxLength={500}
              className="flex-1 bg-muted/60 border-border/40 focus:border-primary/40"
              autoComplete="off"
            />
            <Button type="submit" size="sm" disabled={!input.trim() || sending} className="px-3 shrink-0">
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </Button>
          </form>
        )}
        {input.length > 400 && (
          <p className="text-[0.6rem] text-muted-foreground mt-1 text-right">{500 - input.length} chars left</p>
        )}
      </div>
    </div>
  )
}
