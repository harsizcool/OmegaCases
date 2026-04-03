"use client"

import NextLink from "next/link"
import { Code2, Lock } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/lib/auth-context"

const BASE = "https://omegacases.com"

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/admin/items",
    auth: false,
    desc: "Returns all items with rarity, RAP, market price, and image.",
    response: `[{ "id": "uuid", "name": "Item Name", "rarity": "Rare", "likelihood": 12.5, "market_price": 4.99, "rap": 4.50 }]`,
  },
  {
    method: "GET",
    path: "/api/rolls?limit=50",
    auth: false,
    desc: "Returns recent rolls with item and user details.",
    response: `[{ "id": "uuid", "user": { "username": "player1" }, "item": { "name": "Item", "rarity": "Legendary" } }]`,
  },
  {
    method: "GET",
    path: "/api/leaderboard",
    auth: false,
    desc: "Returns leaderboard sorted by total RAP. Includes Plus status.",
    response: `[{ "username": "topplayer", "plus": true, "rap": 1234.56, "itemCount": 42 }]`,
  },
  {
    method: "GET",
    path: "/api/users?username={username}",
    auth: true,
    desc: "Look up a user by username.",
    response: `{ "id": "uuid", "username": "player1", "balance": 12.50, "plus": false }`,
  },
  {
    method: "GET",
    path: "/api/inventory/{userId}",
    auth: true,
    desc: "Returns a user's full inventory.",
    response: `[{ "id": "uuid", "item": { "name": "Item Name", "rarity": "Omega", "rap": 99.99 } }]`,
  },
]

const METHOD_COLORS: Record<string, string> = {
  GET: "#16a34a",
  POST: "#2563eb",
}

export default function DeveloperDocsPage() {
  const { user } = useAuth()

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-2">
        <Code2 size={28} className="text-primary" />
        <h1 className="text-3xl font-extrabold">API Documentation</h1>
      </div>
      <p className="text-muted-foreground mb-8 text-sm">
        Programmatic access to OmegaCases data. Authenticated endpoints require a valid user ID.
      </p>

      {user && (
        <div className="p-3 border border-border rounded-lg mb-6 bg-muted/40 text-sm">
          <p className="font-semibold mb-1 text-xs text-muted-foreground uppercase tracking-wide">Your User ID</p>
          <code className="font-mono text-xs break-all">{user.id}</code>
        </div>
      )}

      <div className="p-3 border border-border rounded-lg mb-8">
        <p className="text-xs font-semibold text-muted-foreground mb-1">Base URL</p>
        <code className="font-mono text-sm">{BASE}</code>
      </div>

      <div className="flex flex-col gap-4 mb-10">
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
            <div className="px-4 py-3 flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">{ep.desc}</p>
              <pre className="bg-slate-900 rounded-lg p-3 text-green-300 font-mono text-xs whitespace-pre-wrap">
                {ep.response}
              </pre>
            </div>
          </div>
        ))}
      </div>

      <Separator className="mb-10" />

      {/* OAuth section */}
      <h2 className="text-2xl font-extrabold mb-2">Sign In with OmegaCases</h2>
      <p className="text-muted-foreground mb-6 text-sm">
        Let users authenticate with their OmegaCases account in two steps.
        Create an app on the <NextLink href="/developer" className="text-primary hover:underline">Developer Dashboard</NextLink> first.
      </p>

      <div className="flex flex-col gap-6">
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-muted font-semibold text-sm">Step 1 — Redirect the user</div>
          <div className="px-4 py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Build a URL and redirect or link the user to it. Use your <code className="bg-muted px-1 rounded text-xs">client_id</code> from the developer dashboard.
            </p>
            <pre className="bg-slate-900 rounded-lg p-3 text-blue-300 font-mono text-xs whitespace-pre-wrap">
{`const url = new URL("${BASE}/oauth/authorize")
url.searchParams.set("client_id", "YOUR_CLIENT_ID")
url.searchParams.set("redirect_uri", "https://yourapp.com/callback")
url.searchParams.set("scope", "read_id,read_username")
url.searchParams.set("state", crypto.randomUUID())

// Redirect user:
window.location.href = url.toString()`}
            </pre>
          </div>
        </div>

        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-muted font-semibold text-sm">Step 2 — Handle the callback</div>
          <div className="px-4 py-4">
            <p className="text-sm text-muted-foreground mb-3">
              After the user authorizes, they're redirected to your <code className="bg-muted px-1 rounded text-xs">redirect_uri</code> with data as query params:
            </p>
            <pre className="bg-slate-900 rounded-lg p-3 text-green-300 font-mono text-xs whitespace-pre-wrap">
{`// Your callback URL receives:
// https://yourapp.com/callback?user_id=xxx&username=player1&state=yyy

const params = new URLSearchParams(window.location.search)
const userId   = params.get("user_id")
const username = params.get("username")
const state    = params.get("state")  // verify matches what you sent`}
            </pre>
          </div>
        </div>

        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-muted font-semibold text-sm">Available Scopes</div>
          <div className="px-4 py-4">
            <div className="grid gap-2 text-sm">
              {[
                ["read_id",       "User's UUID"],
                ["read_username", "User's username"],
                ["read_balance",  "User's balance (number)"],
                ["write_balance", "Modify user's balance"],
                ["write_cases",   "Open cases on behalf of user"],
              ].map(([scope, desc]) => (
                <div key={scope} className="flex items-center gap-3">
                  <code className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-mono w-36 shrink-0">
                    {scope}
                  </code>
                  <span className="text-muted-foreground text-xs">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
