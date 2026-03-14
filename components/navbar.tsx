"use client"

import { useState } from "react"
import NextLink from "next/link"
import { useRouter } from "next/navigation"
import {
  AppBar, Toolbar, Box, Button, Typography, IconButton,
  Avatar, Menu, MenuItem, Chip, Divider, useMediaQuery, useTheme,
  Drawer, List, ListItem, ListItemText, ListItemButton,
} from "@mui/material"
import MenuIcon from "@mui/icons-material/Menu"
import AccountCircleIcon from "@mui/icons-material/AccountCircle"
import { useAuth } from "@/lib/auth-context"
import DepositWithdrawModal from "./deposit-withdraw-modal"

export default function Navbar() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("md"))

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [depositOpen, setDepositOpen] = useState(false)

  const handleUserMenu = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)
  const handleCloseMenu = () => setAnchorEl(null)

  const handleLogout = async () => {
    handleCloseMenu()
    await logout()
    router.push("/")
  }

  const navLinks = [
    { label: "Marketplace", href: "/marketplace" },
    { label: "Leaderboard", href: "/leaderboard" },
  ]

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
        <Toolbar sx={{ gap: 2, minHeight: { xs: 56, md: 64 } }}>
          {/* Logo */}
          <Box
            component={NextLink}
            href="/"
            sx={{ display: "flex", alignItems: "center", gap: 1, textDecoration: "none", mr: 2 }}
          >
            <Box
              component="img"
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/omegacrate_logo-tJzRwAfwpZAQEkJOSjQGI93l5hRU06.png"
              alt="OmegaCases"
              sx={{ width: 36, height: 36 }}
            />
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, color: "primary.main", display: { xs: "none", sm: "block" } }}
            >
              OmegaCases
            </Typography>
          </Box>

          {/* Desktop nav */}
          {!isMobile && (
            <Box sx={{ display: "flex", gap: 1, flex: 1 }}>
              {navLinks.map((link) => (
                <Button
                  key={link.href}
                  component={NextLink}
                  href={link.href}
                  sx={{ color: "text.primary", "&:hover": { color: "primary.main" } }}
                >
                  {link.label}
                </Button>
              ))}
            </Box>
          )}

          <Box sx={{ flex: 1 }} />

          {/* Balance chip */}
          {user && (
            <Chip
              label={`$${Number(user.balance).toFixed(2)}`}
              color="primary"
              variant="outlined"
              onClick={() => setDepositOpen(true)}
              sx={{ fontWeight: 700, cursor: "pointer", fontSize: "0.9rem" }}
            />
          )}

          {/* User menu or login */}
          {user ? (
            <>
              <IconButton onClick={handleUserMenu} size="small">
                {user.profile_picture ? (
                  <Avatar src={user.profile_picture} sx={{ width: 34, height: 34 }} />
                ) : (
                  <Avatar sx={{ width: 34, height: 34, bgcolor: "primary.main", fontSize: 16 }}>
                    {user.username[0].toUpperCase()}
                  </Avatar>
                )}
              </IconButton>
              <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleCloseMenu}>
                <MenuItem
                  component={NextLink}
                  href={`/user/${user.username}`}
                  onClick={handleCloseMenu}
                >
                  My Inventory
                </MenuItem>
                {user.admin && (
                  <MenuItem component={NextLink} href="/admin" onClick={handleCloseMenu}>
                    Admin Panel
                  </MenuItem>
                )}
                <Divider />
                <MenuItem onClick={handleLogout} sx={{ color: "error.main" }}>
                  Logout
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                component={NextLink}
                href="/login"
              >
                Login
              </Button>
              <Button
                variant="contained"
                size="small"
                component={NextLink}
                href="/register"
                sx={{ display: { xs: "none", sm: "flex" } }}
              >
                Register
              </Button>
            </Box>
          )}

          {/* Mobile hamburger */}
          {isMobile && (
            <IconButton onClick={() => setMobileOpen(true)} sx={{ ml: 1 }}>
              <MenuIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer anchor="right" open={mobileOpen} onClose={() => setMobileOpen(false)}>
        <Box sx={{ width: 240 }}>
          <List>
            {navLinks.map((link) => (
              <ListItem key={link.href} disablePadding>
                <ListItemButton
                  component={NextLink}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                >
                  <ListItemText primary={link.label} />
                </ListItemButton>
              </ListItem>
            ))}
            {user && (
              <>
                <Divider />
                <ListItem disablePadding>
                  <ListItemButton
                    component={NextLink}
                    href={`/user/${user.username}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <ListItemText primary="My Inventory" />
                  </ListItemButton>
                </ListItem>
                {user.admin && (
                  <ListItem disablePadding>
                    <ListItemButton
                      component={NextLink}
                      href="/admin"
                      onClick={() => setMobileOpen(false)}
                    >
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

      <DepositWithdrawModal open={depositOpen} onClose={() => setDepositOpen(false)} />
    </>
  )
}
