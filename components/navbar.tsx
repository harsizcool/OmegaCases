"use client"

import { useState, useEffect } from "react"
import NextLink from "next/link"
import { useRouter } from "next/navigation"
import {
  AppBar, Toolbar, Box, Button, Typography, IconButton,
  Avatar, Menu, MenuItem, Chip, Divider,
  Drawer, List, ListItem, ListItemText, ListItemButton,
  Badge, InputBase,
} from "@mui/material"
import MenuIcon from "@mui/icons-material/Menu"
import WorkspacesIcon from "@mui/icons-material/Workspaces"
import SearchIcon from "@mui/icons-material/Search"
import { useAuth } from "@/lib/auth-context"
import DepositWithdrawModal from "./deposit-withdraw-modal"

export default function Navbar() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [pendingTrades, setPendingTrades] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [depositOpen, setDepositOpen] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Poll for pending received trades every 30s
  useEffect(() => {
    if (!user) return
    const fetchPending = async () => {
      try {
        const res = await fetch(`/api/trades?user_id=${user.id}`)
        const data = await res.json()
        if (data?.received) {
          setPendingTrades(data.received.filter((t: any) => t.status === "pending").length)
        }
      } catch {}
    }
    fetchPending()
    const interval = setInterval(fetchPending, 30000)
    return () => clearInterval(interval)
  }, [user])

  const handleUserMenu = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)
  const handleCloseMenu = () => setAnchorEl(null)

  const handleLogout = async () => {
    handleCloseMenu()
    await logout()
    router.push("/")
  }

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const q = searchQuery.trim()
      router.push(q ? `/search?query=${encodeURIComponent(q)}` : "/search")
      setSearchQuery("")
    }
  }

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          backgroundColor: "#fff",
          borderBottom: "1px solid #e3f2fd",
          color: "text.primary",
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, md: 64 }, px: { xs: 1, md: 2 }, display: "flex", alignItems: "center" }}>
          {/* LEFT: logo + nav links + Cases */}
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
            <Box
              component={NextLink}
              href="/"
              sx={{ display: "flex", alignItems: "center", gap: 1, textDecoration: "none", mr: 1, flexShrink: 0 }}
            >
              <Box
                component="img"
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/omegacrate_logo-tJzRwAfwpZAQEkJOSjQGI93l5hRU06.png"
                alt="OmegaCases"
                sx={{ width: 36, height: 36 }}
              />
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, color: "primary.main", display: { xs: "none", sm: "block" }, whiteSpace: "nowrap" }}
              >
                OmegaCases
              </Typography>
            </Box>

            {/* Desktop nav links */}
            <Box sx={{ display: { xs: "none", md: "flex" }, gap: 0.5, flexShrink: 0 }}>
              <Button
                component={NextLink}
                href="/marketplace"
                sx={{ color: "text.primary", "&:hover": { color: "primary.main" } }}
              >
                Marketplace
              </Button>
              <Button
                component={NextLink}
                href="/trade"
                sx={{ color: "text.primary", "&:hover": { color: "primary.main" } }}
              >
                <Badge badgeContent={mounted && user ? pendingTrades : 0} color="error">
                  <Box sx={{ pr: pendingTrades > 0 ? 1 : 0 }}>Trade</Box>
                </Badge>
              </Button>
              <Button
                component={NextLink}
                href="/leaderboard"
                sx={{ color: "text.primary", "&:hover": { color: "primary.main" } }}
              >
                Leaderboard
              </Button>
            </Box>

            <Button
              component={NextLink}
              href="/open"
              variant="contained"
              startIcon={<WorkspacesIcon />}
              size="small"
              sx={{ fontWeight: 700, ml: 0.5, flexShrink: 0, display: { xs: "none", md: "flex" } }}
            >
              Cases
            </Button>
          </Box>

          {/* CENTER: search bar — always truly centered */}
          <Box
            sx={{
              display: { xs: "none", md: "flex" },
              justifyContent: "center",
              alignItems: "center",
              flexShrink: 0,
              width: 340,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                bgcolor: "#f0f7ff",
                border: "1px solid #e3f2fd",
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                width: "100%",
                gap: 1,
              }}
            >
              <SearchIcon sx={{ color: "text.secondary", fontSize: 20 }} />
              <InputBase
                placeholder="Search items, users, listings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                sx={{ flex: 1, fontSize: "0.875rem" }}
              />
            </Box>
          </Box>

          {/* RIGHT: balance + avatar + mobile hamburger */}
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1, minWidth: 0 }}>
            {/* Balance chip */}
            {mounted && user && (
              <Chip
                label={`$${Number(user.balance).toFixed(2)}`}
                color="primary"
                variant="outlined"
                onClick={() => setDepositOpen(true)}
                sx={{ fontWeight: 700, cursor: "pointer", fontSize: "0.9rem", flexShrink: 0 }}
              />
            )}

            {/* User menu or login */}
            {mounted && (
              user ? (
                <>
                  <IconButton onClick={handleUserMenu} size="small" sx={{ flexShrink: 0 }}>
                    {user.profile_picture ? (
                      <Avatar src={user.profile_picture} sx={{ width: 34, height: 34 }} />
                    ) : (
                      <Avatar sx={{ width: 34, height: 34, bgcolor: "primary.main", fontSize: 16 }}>
                        {user.username[0].toUpperCase()}
                      </Avatar>
                    )}
                  </IconButton>
                  <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleCloseMenu}>
                    <MenuItem component={NextLink} href={`/user/${user.username}`} onClick={handleCloseMenu}>
                      My Inventory
                    </MenuItem>
                    <MenuItem component={NextLink} href="/settings" onClick={handleCloseMenu}>
                      Settings
                    </MenuItem>
                    {user.admin && (
                      <MenuItem component={NextLink} href="/admin" onClick={handleCloseMenu}>
                        Admin Panel
                      </MenuItem>
                    )}
                    <Divider />
                    <MenuItem onClick={handleLogout} sx={{ color: "error.main" }}>Logout</MenuItem>
                  </Menu>
                </>
              ) : (
                <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
                  <Button variant="outlined" size="small" component={NextLink} href="/login">Login</Button>
                  <Button variant="contained" size="small" component={NextLink} href="/register"
                    sx={{ display: { xs: "none", sm: "flex" } }}>
                    Register
                  </Button>
                </Box>
              )
            )}

            {/* Mobile hamburger */}
            <IconButton
              onClick={() => setMobileOpen(true)}
              sx={{ display: { xs: "flex", md: "none" } }}
            >
              <MenuIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer anchor="right" open={mobileOpen} onClose={() => setMobileOpen(false)}>
        <Box sx={{ width: 260 }}>
          {/* Mobile search */}
          <Box sx={{ p: 2 }}>
            <Box
              sx={{
                display: "flex", alignItems: "center",
                bgcolor: "#f0f7ff", border: "1px solid #e3f2fd",
                borderRadius: 2, px: 1.5, py: 0.75, gap: 1,
              }}
            >
              <SearchIcon sx={{ color: "text.secondary", fontSize: 18 }} />
              <InputBase
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const q = searchQuery.trim()
                    router.push(q ? `/search?query=${encodeURIComponent(q)}` : "/search")
                    setSearchQuery("")
                    setMobileOpen(false)
                  }
                }}
                sx={{ flex: 1, fontSize: "0.875rem" }}
              />
            </Box>
          </Box>
          <Divider />
          <List>
            <ListItem disablePadding>
              <ListItemButton component={NextLink} href="/marketplace" onClick={() => setMobileOpen(false)}>
                <ListItemText primary="Marketplace" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton component={NextLink} href="/trade" onClick={() => setMobileOpen(false)}>
                <ListItemText
                  primary={
                    <Badge badgeContent={mounted && user ? pendingTrades : 0} color="error">
                      <Box sx={{ pr: pendingTrades > 0 ? 1.5 : 0 }}>Trade</Box>
                    </Badge>
                  }
                />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton component={NextLink} href="/leaderboard" onClick={() => setMobileOpen(false)}>
                <ListItemText primary="Leaderboard" />
              </ListItemButton>
            </ListItem>
            {mounted && user && (
              <>
                <Divider />
                <ListItem disablePadding>
                  <ListItemButton component={NextLink} href={`/user/${user.username}`} onClick={() => setMobileOpen(false)}>
                    <ListItemText primary="My Inventory" />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton component={NextLink} href="/settings" onClick={() => setMobileOpen(false)}>
                    <ListItemText primary="Settings" />
                  </ListItemButton>
                </ListItem>
                {user.admin && (
                  <ListItem disablePadding>
                    <ListItemButton component={NextLink} href="/admin" onClick={() => setMobileOpen(false)}>
                      <ListItemText primary="Admin Panel" />
                    </ListItemButton>
                  </ListItem>
                )}
                <ListItem disablePadding>
                  <ListItemButton onClick={() => { setMobileOpen(false); handleLogout() }}>
                    <ListItemText primary="Logout" sx={{ color: "error.main" }} />
                  </ListItemButton>
                </ListItem>
              </>
            )}
          </List>
        </Box>
      </Drawer>

      {mounted && (
        <DepositWithdrawModal open={depositOpen} onClose={() => setDepositOpen(false)} />
      )}
    </>
  )
}
