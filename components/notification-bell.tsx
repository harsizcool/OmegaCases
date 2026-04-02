"use client"

import { useState, useEffect, useCallback } from "react"
import NextLink from "next/link"
import { Bell, CheckCheck, ShoppingBag, ArrowLeftRight, Megaphone, CheckCircle, XCircle } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

interface Notification {
  id: string
  type: string
  title: string
  body: string
  link?: string
  read: boolean
  created_at: string
}

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "item_sold": return <ShoppingBag size={14} className="text-green-600" />
    case "trade_received": return <ArrowLeftRight size={14} className="text-blue-600" />
    case "trade_accepted": return <CheckCircle size={14} className="text-green-600" />
    case "trade_declined":
    case "trade_cancelled": return <XCircle size={14} className="text-red-600" />
    default: return <Megaphone size={14} className="text-amber-600" />
  }
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)

  const unread = notifications.filter((n) => !n.read).length

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?user_id=${userId}`)
      const data = await res.json()
      if (data.notifications) setNotifications(data.notifications)
    } catch {}
  }, [userId])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 8000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen && unread > 0) {
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, action: "read_all" }),
      }).then(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      })
    }
  }

  const markOneRead = (id: string) => {
    fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, ids: [id], action: "read" }),
    })
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-1.5 rounded-md hover:bg-accent transition-colors shrink-0">
          <Bell size={20} className={unread > 0 ? "text-primary" : "text-muted-foreground"} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-destructive text-destructive-foreground text-[0.6rem] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] max-h-[480px] overflow-hidden flex flex-col p-0 rounded-xl shadow-xl">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-border shrink-0">
          <span className="font-bold text-sm">Notifications</span>
          {notifications.some((n) => !n.read) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 gap-1"
              onClick={() => {
                fetch("/api/notifications", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ user_id: userId, action: "read_all" }),
                })
                setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
              }}
            >
              <CheckCheck size={12} />
              Mark all read
            </Button>
          )}
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center gap-2">
              <Bell size={32} className="text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <ul>
              {notifications.map((n, i) => (
                <li key={n.id}>
                  {n.link ? (
                    <NextLink
                      href={n.link}
                      onClick={() => { markOneRead(n.id); setOpen(false) }}
                      className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-accent transition-colors no-underline text-inherit ${n.read ? "" : "bg-accent/50"}`}
                    >
                      <NotificationRow n={n} />
                    </NextLink>
                  ) : (
                    <div
                      onClick={() => markOneRead(n.id)}
                      className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-accent transition-colors ${n.read ? "" : "bg-accent/50"}`}
                    >
                      <NotificationRow n={n} />
                    </div>
                  )}
                  {i < notifications.length - 1 && <Separator />}
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function NotificationRow({ n }: { n: { type: string; title: string; body: string; created_at: string; read: boolean } }) {
  return (
    <>
      <div className="mt-0.5 shrink-0"><TypeIcon type={n.type} /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm truncate ${n.read ? "font-normal" : "font-bold"}`}>{n.title}</span>
          <span className="text-[0.65rem] text-muted-foreground shrink-0">{timeAgo(n.created_at)}</span>
        </div>
        <p className="text-xs text-muted-foreground leading-snug">{n.body}</p>
      </div>
      {!n.read && (
        <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />
      )}
    </>
  )
}
