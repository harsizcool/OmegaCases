"use client"

import { useState, useEffect, useCallback } from "react"
import NextLink from "next/link"
import {
  IconButton, Badge, Popover, Box, Typography, Divider,
  Button, List, ListItem, ListItemText, Tooltip, Chip,
} from "@mui/material"
import NotificationsIcon from "@mui/icons-material/Notifications"
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone"
import DoneAllIcon from "@mui/icons-material/DoneAll"
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag"
import SwapHorizIcon from "@mui/icons-material/SwapHoriz"
import CampaignIcon from "@mui/icons-material/Campaign"
import CheckCircleIcon from "@mui/icons-material/CheckCircle"
import CancelIcon from "@mui/icons-material/Cancel"

interface Notification {
  id: string
  type: string
  title: string
  body: string
  link?: string
  read: boolean
  created_at: string
}

function typeIcon(type: string) {
  switch (type) {
    case "item_sold": return <ShoppingBagIcon sx={{ fontSize: 16, color: "#16a34a" }} />
    case "trade_received": return <SwapHorizIcon sx={{ fontSize: 16, color: "#2563eb" }} />
    case "trade_accepted": return <CheckCircleIcon sx={{ fontSize: 16, color: "#16a34a" }} />
    case "trade_declined":
    case "trade_cancelled": return <CancelIcon sx={{ fontSize: 16, color: "#dc2626" }} />
    default: return <CampaignIcon sx={{ fontSize: 16, color: "#d97706" }} />
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
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)

  const unread = notifications.filter((n) => !n.read).length
  const badgeCount = unread > 99 ? 99 : unread
  const badgeLabel = unread > 99 ? "99+" : undefined

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?user_id=${userId}`)
      const data = await res.json()
      if (data.notifications) setNotifications(data.notifications)
    } catch {}
  }, [userId])

  // Poll every 8 seconds
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 8000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget)
    // Mark all as read when opening
    if (unread > 0) {
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, action: "read_all" }),
      }).then(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      })
    }
  }

  const handleClose = () => setAnchorEl(null)

  const markOneRead = (id: string) => {
    fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, ids: [id], action: "read" }),
    })
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
  }

  return (
    <>
      <Tooltip title="Notifications" placement="bottom" arrow>
        <IconButton size="small" onClick={handleOpen} sx={{ flexShrink: 0 }}>
          <Badge
            badgeContent={badgeLabel ?? badgeCount}
            color="error"
            max={99}
            sx={{
              "& .MuiBadge-badge": {
                fontSize: "0.65rem",
                minWidth: 16,
                height: 16,
                px: 0.5,
              },
            }}
          >
            {unread > 0
              ? <NotificationsIcon sx={{ fontSize: 22, color: "primary.main" }} />
              : <NotificationsNoneIcon sx={{ fontSize: 22, color: "text.secondary" }} />
            }
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          sx: {
            width: 340,
            maxHeight: 480,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            borderRadius: 2,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          },
        }}
      >
        {/* Header */}
        <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography fontWeight={700} fontSize="0.95rem">Notifications</Typography>
          {notifications.some((n) => !n.read) && (
            <Button
              size="small"
              startIcon={<DoneAllIcon sx={{ fontSize: 14 }} />}
              onClick={() => {
                fetch("/api/notifications", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ user_id: userId, action: "read_all" }),
                })
                setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
              }}
              sx={{ fontSize: "0.75rem", py: 0.25 }}
            >
              Mark all read
            </Button>
          )}
        </Box>

        {/* List */}
        <Box sx={{ overflowY: "auto", flex: 1 }}>
          {notifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <NotificationsNoneIcon sx={{ fontSize: 36, color: "text.disabled", mb: 1 }} />
              <Typography variant="body2" color="text.secondary">No notifications yet</Typography>
            </Box>
          ) : (
            <List disablePadding>
              {notifications.map((n, i) => (
                <Box key={n.id}>
                  <ListItem
                    component={n.link ? NextLink : "div"}
                    href={n.link ?? undefined}
                    onClick={() => { markOneRead(n.id); handleClose() }}
                    sx={{
                      px: 2,
                      py: 1.25,
                      bgcolor: n.read ? "transparent" : "action.hover",
                      cursor: "pointer",
                      "&:hover": { bgcolor: "action.selected" },
                      alignItems: "flex-start",
                      gap: 1.25,
                      textDecoration: "none",
                      color: "inherit",
                      display: "flex",
                    }}
                  >
                    <Box sx={{ mt: 0.25, flexShrink: 0 }}>{typeIcon(n.type)}</Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, justifyContent: "space-between" }}>
                        <Typography variant="body2" fontWeight={n.read ? 400 : 700} noWrap>
                          {n.title}
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>
                          {timeAgo(n.created_at)}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.4 }}>
                        {n.body}
                      </Typography>
                    </Box>
                    {!n.read && (
                      <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "primary.main", flexShrink: 0, mt: 0.75 }} />
                    )}
                  </ListItem>
                  {i < notifications.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          )}
        </Box>
      </Popover>
    </>
  )
}
