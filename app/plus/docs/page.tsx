"use client"

import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import {
  Container, Box, Typography, Paper, Chip, Divider,
  Alert, Button,
} from "@mui/material"
import LockIcon from "@mui/icons-material/Lock"
import ApiIcon from "@mui/icons-material/Api"
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium"
import NextLink from "next/link"

const BASE = "https://omegacases.com"

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/admin/items",
    auth: false,
    desc: "Returns all items in the game with their rarity, RAP, market price, and image.",
    response: `[
  {
    "id": "uuid",
    "name": "Item Name",
    "image_url": "https://...",
    "rarity": "Rare",
    "likelihood": 12.5,
    "market_price": 4.99,
    "rap": 4.50,
    "limited_time": false,
    "created_at": "2025-01-01T00:00:00Z"
  }
]`,
  },
  {
    method: "GET",
    path: "/api/rolls?limit=50",
    auth: true,
    desc: "Returns the most recent rolls (up to 50). Each roll includes the item details and the user who rolled it.",
    response: `[
  {
    "id": "uuid",
    "created_at": "2025-01-01T00:00:00Z",
    "user": { "id": "uuid", "username": "player1", "profile_picture": null },
    "item": { "id": "uuid", "name": "Item Name", "image_url": "https://...", "rarity": "Legendary" }
  }
]`,
  },
  {
    method: "GET",
    path: "/api/leaderboard",
    auth: false,
    desc: "Returns the leaderboard sorted by total RAP value of inventory. Includes Plus status.",
    response: `[
  {
    "id": "uuid",
    "username": "topplayer",
    "profile_picture": null,
    "plus": true,
    "rap": 1234.56,
    "itemCount": 42
  }
]`,
  },
  {
    method: "GET",
    path: "/api/users?username={username}",
    auth: true,
    desc: "Look up a user by username. Returns profile info including balance and Plus status.",
    response: `{
  "id": "uuid",
  "username": "player1",
  "profile_picture": null,
  "balance": 12.50,
  "plus": false,
  "cases": 100,
  "created_at": "2025-01-01T00:00:00Z"
}`,
  },
  {
    method: "GET",
    path: "/api/inventory/{userId}",
    auth: true,
    desc: "Returns a user's full inventory. Each entry includes the inventory ID, quantity, and full item details.",
    response: `[
  {
    "id": "uuid",
    "created_at": "2025-01-01T00:00:00Z",
    "item": {
      "id": "uuid",
      "name": "Item Name",
      "image_url": "https://...",
      "rarity": "Omega",
      "rap": 99.99,
      "market_price": 105.00
    }
  }
]`,
  },
  {
    method: "POST",
    path: "/api/oauth/init",
    auth: false,
    desc: "Initialize an OAuth flow. Generate a consent page URL that redirects users through OmegaCases sign-in. No Plus required — public API.",
    response: `{
  "success": true,
  "generated_url": "https://omegacases.com/ext/auth/a1b2c3d4"
}`,
  },
]

const METHOD_COLORS: Record<string, string> = {
  GET: "#2e7d32",
  POST: "#1565c0",
  DELETE: "#c62828",
}

export default function PlusDocsPage() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user !== undefined && !user?.plus) {
      router.replace("/plus")
    }
  }, [user, router])

  if (!user) return null
  if (!user.plus) return null

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
        <ApiIcon sx={{ fontSize: 36, color: "primary.main" }} />
        <Box>
          <Typography variant="h4" fontWeight={800}>API Documentation</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <WorkspacePremiumIcon sx={{ fontSize: 16, color: "#f59e0b" }} />
            <Typography variant="body2" sx={{ color: "#f59e0b", fontWeight: 700 }}>Plus Exclusive</Typography>
          </Box>
        </Box>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Programmatic access to OmegaCases data. Your user ID must be a Plus member to use authenticated endpoints.
      </Typography>

      {/* Auth note */}
      <Alert severity="info" icon={<LockIcon fontSize="small" />} sx={{ mb: 4 }}>
        <Typography variant="body2" fontWeight={700}>Authentication</Typography>
        <Typography variant="body2">
          For authenticated endpoints, pass your user ID as a query parameter: <code>?user_id={user.id}</code>
        </Typography>
        <Box sx={{ mt: 1, p: 1, bgcolor: "#e3f2fd", borderRadius: 1, fontFamily: "monospace", fontSize: "0.8rem", wordBreak: "break-all" }}>
          Your user ID: <strong>{user.id}</strong>
        </Box>
      </Alert>

      {/* Base URL */}
      <Paper elevation={0} sx={{ p: 2, mb: 4, border: "1px solid #e3f2fd", borderRadius: 2 }}>
        <Typography variant="body2" color="text.secondary" fontWeight={600} gutterBottom>Base URL</Typography>
        <Typography variant="body2" fontFamily="monospace" fontSize="0.9rem">{BASE}</Typography>
      </Paper>

      {/* Endpoints */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {ENDPOINTS.map((ep, i) => (
          <Paper key={i} elevation={0} sx={{ border: "1px solid #e3f2fd", borderRadius: 2, overflow: "hidden" }}>
            {/* Endpoint header */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, px: 3, py: 2, bgcolor: "#f8fbff" }}>
              <Chip
                label={ep.method}
                size="small"
                sx={{
                  bgcolor: METHOD_COLORS[ep.method],
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.7rem",
                  height: 22,
                  "& .MuiChip-label": { px: 1 },
                }}
              />
              <Typography fontFamily="monospace" fontWeight={600} fontSize="0.9rem" sx={{ wordBreak: "break-all" }}>
                {ep.path}
              </Typography>
              {ep.auth && (
                <Chip
                  icon={<LockIcon sx={{ fontSize: "0.75rem !important" }} />}
                  label="Auth"
                  size="small"
                  color="warning"
                  variant="outlined"
                  sx={{ height: 20, fontSize: "0.65rem", "& .MuiChip-label": { px: 0.5 } }}
                />
              )}
            </Box>

            <Divider />

            <Box sx={{ px: 3, py: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{ep.desc}</Typography>

              <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" gutterBottom>
                EXAMPLE REQUEST
              </Typography>
              <Box sx={{ bgcolor: "#0d1b2a", borderRadius: 1.5, p: 2, mb: 2 }}>
                <Typography
                  component="pre"
                  sx={{ m: 0, color: "#90caf9", fontFamily: "monospace", fontSize: "0.8rem", whiteSpace: "pre-wrap", wordBreak: "break-all" }}
                >
                  {`fetch("${BASE}${ep.path.includes("{") ? ep.path.replace("{username}", "player1").replace("{userId}", user.id) : ep.path}${ep.auth ? (ep.path.includes("?") ? `&user_id=${user.id}` : `?user_id=${user.id}`) : ""}")`}
                </Typography>
              </Box>

              <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" gutterBottom>
                RESPONSE
              </Typography>
              <Box sx={{ bgcolor: "#0d1b2a", borderRadius: 1.5, p: 2 }}>
                <Typography
                  component="pre"
                  sx={{ m: 0, color: "#a5d6a7", fontFamily: "monospace", fontSize: "0.78rem", whiteSpace: "pre-wrap" }}
                >
                  {ep.response}
                </Typography>
              </Box>
            </Box>
          </Paper>
        ))}
      </Box>

      {/* OAuth Guide */}
      <Box sx={{ mt: 6 }}>
        <Typography variant="h5" fontWeight={800} gutterBottom>OAuth / Sign In with OmegaCases</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Add "Sign In with OmegaCases" to your app in 2 steps. Generate a consent URL, then handle the callback.
        </Typography>

        <Paper sx={{ p: 3, mb: 3, bgcolor: "#f5f5f5" }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>Step 1: Generate OAuth URL</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            POST to <code>/api/oauth/init</code> (no auth required):
          </Typography>
          <Box sx={{ bgcolor: "#0d1b2a", borderRadius: 1.5, p: 2, mb: 2 }}>
            <Typography component="pre" sx={{ m: 0, color: "#90caf9", fontFamily: "monospace", fontSize: "0.75rem", whiteSpace: "pre-wrap" }}>
{`const res = await fetch("${BASE}/api/oauth/init", {
  method: "POST",
  body: JSON.stringify({
    service_name: "My App",
    callback_URL: "https://myapp.com/api/oauth/callback",
    redirect_after_success: "https://myapp.com/dashboard",
    getUserId: true,
    getUsername: true,
    getBalance: false
  })
})
const { generated_url } = await res.json()
// Use generated_url as your "Sign In" button href`}
            </Typography>
          </Box>

          <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ mt: 3 }}>Step 2: Handle Callback</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            When the user confirms, we POST to your callback URL with their data:
          </Typography>
          <Box sx={{ bgcolor: "#0d1b2a", borderRadius: 1.5, p: 2 }}>
            <Typography component="pre" sx={{ m: 0, color: "#a5d6a7", fontFamily: "monospace", fontSize: "0.75rem", whiteSpace: "pre-wrap" }}>
{`POST /api/oauth/callback
{
  "success": true,
  "user_data": {
    "user_id": "uuid-here",
    "username": "player1",
    "balance": 45.67
  }
}`}
            </Typography>
          </Box>
        </Paper>
      </Box>

      <Box sx={{ mt: 5, textAlign: "center" }}>
        <Button component={NextLink} href="/plus" variant="outlined" startIcon={<WorkspacePremiumIcon sx={{ color: "#f59e0b" }} />}
          sx={{ borderColor: "#f59e0b", color: "#f59e0b" }}>
          Back to Plus
        </Button>
      </Box>
    </Container>
  )
}
