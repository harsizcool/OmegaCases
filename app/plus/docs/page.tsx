"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import NextLink from "next/link"
import { Lock, Code2, Crown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/lib/auth-context"

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
  GET: "#16a34a",
  POST: "#2563eb",
  DELETE: "#dc2626",
}

export default function PlusDocsPage() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user !== undefined && !user?.plus) {
      router.replace("/plus")
    }
  }, [user, router])

  if (!user || !user.plus) return null

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-2">
        <Code2 size={32} className="text-primary" />
        <div>
          <h1 className="text-3xl font-extrabold">API Documentation</h1>
          <div className="flex items-center gap-1.5">
            <Crown size={14} className="text-amber-500" />
            <span className="text-sm font-bold text-amber-500">Plus Exclusive</span>
          </div>
        </div>
      </div>
      <p className="text-muted-foreground mb-8">
        Programmatic access to OmegaCases data. Your user ID must be a Plus member to use authenticated endpoints.
      </p>

      <Alert className="mb-6">
        <Lock size={14} />
        <AlertDescription>
          <p className="font-bold mb-1">Authentication</p>
          <p className="text-sm">For authenticated endpoints, pass your user ID as a query parameter: <code className="bg-muted px-1 rounded">?user_id={user.id}</code></p>
          <div className="mt-2 p-2 bg-muted rounded font-mono text-xs break-all">
            Your user ID: <strong>{user.id}</strong>
          </div>
        </AlertDescription>
      </Alert>

      <div className="p-3 border border-border rounded-lg mb-8">
        <p className="text-xs font-semibold text-muted-foreground mb-1">Base URL</p>
        <code className="font-mono text-sm">{BASE}</code>
      </div>

      <div className="flex flex-col gap-4">
        {ENDPOINTS.map((ep, i) => (
          <div key={i} className="border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-muted">
              <span
                className="text-white text-xs font-bold px-2 py-0.5 rounded"
                style={{ backgroundColor: METHOD_COLORS[ep.method] }}
              >
                {ep.method}
              </span>
              <code className="font-mono font-semibold text-sm break-all flex-1">{ep.path}</code>
              {ep.auth && (
                <span className="flex items-center gap-1 text-xs text-amber-600 border border-amber-300 rounded px-1.5 py-0.5 font-semibold">
                  <Lock size={10} /> Auth
                </span>
              )}
            </div>
            <Separator />
            <div className="px-4 py-3 flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{ep.desc}</p>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Example Request</p>
              <pre className="bg-slate-900 rounded-lg p-3 text-blue-300 font-mono text-xs whitespace-pre-wrap break-all">
                {`fetch("${BASE}${ep.path.includes("{") ? ep.path.replace("{username}", "player1").replace("{userId}", user.id) : ep.path}${ep.auth ? (ep.path.includes("?") ? `&user_id=${user.id}` : `?user_id=${user.id}`) : ""}")`}
              </pre>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Response</p>
              <pre className="bg-slate-900 rounded-lg p-3 text-green-300 font-mono text-xs whitespace-pre-wrap">
                {ep.response}
              </pre>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="text-2xl font-extrabold mb-2">OAuth / Sign In with OmegaCases</h2>
        <p className="text-muted-foreground mb-6 text-sm">
          Add "Sign In with OmegaCases" to your app in 2 steps. Generate a consent URL, then handle the callback.
        </p>
        <div className="bg-muted rounded-xl p-5 flex flex-col gap-4">
          <div>
            <p className="font-bold text-sm mb-2">Step 1: Generate OAuth URL</p>
            <p className="text-sm text-muted-foreground mb-2">POST to <code className="bg-background px-1 rounded">/api/oauth/init</code> (no auth required):</p>
            <pre className="bg-slate-900 rounded-lg p-3 text-blue-300 font-mono text-xs whitespace-pre-wrap">
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
            </pre>
          </div>
          <div>
            <p className="font-bold text-sm mb-2">Step 2: Handle Callback</p>
            <p className="text-sm text-muted-foreground mb-2">When the user confirms, we POST to your callback URL with their data:</p>
            <pre className="bg-slate-900 rounded-lg p-3 text-green-300 font-mono text-xs whitespace-pre-wrap">
{`POST /api/oauth/callback
{
  "success": true,
  "user_data": {
    "user_id": "uuid-here",
    "username": "player1",
    "balance": 45.67
  }
}`}
            </pre>
          </div>
        </div>
      </div>

      <div className="mt-10 text-center">
        <Button variant="outline" className="gap-2 border-amber-400 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30" asChild>
          <NextLink href="/plus">
            <Crown size={14} className="text-amber-500" />
            Back to Plus
          </NextLink>
        </Button>
      </div>
    </div>
  )
}
