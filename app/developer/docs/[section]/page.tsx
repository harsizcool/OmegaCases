"use client"

import { useParams } from "next/navigation"
import { notFound } from "next/navigation"

const BASE = "https://omegacases.com"

// ─── Shared primitives ────────────────────────────────────────────────────────

function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="text-2xl font-bold mb-1">{children}</h1>
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-bold mt-8 mb-3">{children}</h2>
}
function Desc({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground mb-6">{children}</p>
}
function Code({ children }: { children: string }) {
  return <code className="bg-muted border border-border px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
}
function Block({ label, lang = "text", children }: { label?: string; lang?: string; children: string }) {
  return (
    <div className="mb-4">
      {label && <p className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{label}</p>}
      <pre className={`rounded-lg p-4 text-xs font-mono whitespace-pre-wrap break-all ${lang === "js" ? "bg-slate-900 text-blue-300" : lang === "response" ? "bg-slate-900 text-green-300" : "bg-muted text-foreground"}`}>
        {children}
      </pre>
    </div>
  )
}
function Row({ method, path, desc }: { method: string; path: string; desc: string }) {
  const colors: Record<string, string> = { GET: "bg-green-700", POST: "bg-blue-700", DELETE: "bg-red-700" }
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0">
      <span className={`${colors[method] ?? "bg-muted"} text-white text-[0.6rem] font-bold px-1.5 py-0.5 rounded mt-0.5 shrink-0`}>{method}</span>
      <div>
        <code className="text-xs font-mono font-semibold">{path}</code>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  )
}
function Card({ children }: { children: React.ReactNode }) {
  return <div className="border border-border rounded-xl overflow-hidden mb-6">{children}</div>
}
function CardHead({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-3 bg-muted border-b border-border/60 text-sm font-semibold">{children}</div>
}
function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-4">{children}</div>
}
function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2.5 text-xs text-amber-600 dark:text-amber-400 mb-4">
      {children}
    </div>
  )
}
function ScopeTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="border border-border rounded-xl overflow-hidden mb-4">
      <div className="grid grid-cols-[140px_1fr] text-xs font-bold text-muted-foreground uppercase tracking-wide px-4 py-2 bg-muted border-b border-border/60">
        <span>Scope</span><span>What it allows</span>
      </div>
      {rows.map(([scope, desc]) => (
        <div key={scope} className="grid grid-cols-[140px_1fr] px-4 py-2.5 border-b border-border/40 last:border-0 items-start">
          <code className="text-xs font-mono text-primary">{scope}</code>
          <span className="text-xs text-muted-foreground">{desc}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Section content ──────────────────────────────────────────────────────────

function Overview() {
  return (
    <>
      <H1>Overview</H1>
      <Desc>OmegaCases developer API — integrate balance, OAuth, and game data into your apps.</Desc>

      <Card>
        <CardHead>Base URL</CardHead>
        <CardBody>
          <code className="text-sm font-mono">{BASE}</code>
        </CardBody>
      </Card>

      <H2>Authentication</H2>
      <p className="text-sm text-muted-foreground mb-4">
        Two auth methods depending on context:
      </p>
      <div className="border border-border rounded-xl overflow-hidden mb-6">
        <div className="grid grid-cols-[120px_1fr] text-xs font-bold text-muted-foreground uppercase tracking-wide px-4 py-2 bg-muted border-b border-border/60">
          <span>Method</span><span>When to use</span>
        </div>
        {[
          ["User ID",     "Authenticated endpoints where the caller is a Plus user (query param ?user_id=)"],
          ["OAuth Token", "Acting on behalf of another user — returned after OAuth authorization"],
        ].map(([m, d]) => (
          <div key={m} className="grid grid-cols-[120px_1fr] px-4 py-2.5 border-b border-border/40 last:border-0 items-start">
            <code className="text-xs font-mono font-semibold">{m}</code>
            <span className="text-xs text-muted-foreground">{d}</span>
          </div>
        ))}
      </div>

      <H2>Endpoints at a glance</H2>
      <div className="border border-border rounded-xl overflow-hidden">
        <Row method="GET"  path="/api/oauth/me?token=xxx"        desc="Fetch authorized user info" />
        <Row method="POST" path="/api/oauth/spend"               desc="Spend balance on behalf of user" />
        <Row method="POST" path="/api/oauth/cases/open"           desc="Open a case on behalf of user" />
        <Row method="POST" path="/api/oauth/listings/buy"         desc="Buy a marketplace listing on behalf of user" />
        <Row method="POST" path="/api/oauth/notify"               desc="Send an in-app notification to user" />
        <Row method="GET"  path="/api/admin/items"               desc="All items (public)" />
        <Row method="GET"  path="/api/rolls?limit=50"            desc="Recent rolls (public)" />
        <Row method="GET"  path="/api/leaderboard"               desc="Leaderboard (public)" />
        <Row method="GET"  path="/api/users?username=x"         desc="User profile lookup" />
        <Row method="GET"  path="/api/inventory/{userId}"        desc="User inventory" />
      </div>
    </>
  )
}

function OAuthDocs() {
  return (
    <>
      <H1>OAuth</H1>
      <Desc>Let users sign in with their OmegaCases account. Create an app on the Developer Dashboard first.</Desc>

      <Card>
        <CardHead>Step 1 — Redirect the user</CardHead>
        <CardBody>
          <p className="text-sm text-muted-foreground mb-3">
            Build a URL with your <Code>client_id</Code>, a <Code>redirect_uri</Code>, and the <Code>scope</Code> you need.
          </p>
          <Block lang="js" label="Example">{`const url = new URL("${BASE}/oauth/authorize")
url.searchParams.set("client_id",    "YOUR_CLIENT_ID")
url.searchParams.set("redirect_uri", "https://yourapp.com/callback")
url.searchParams.set("scope",        "read_id,read_username")
url.searchParams.set("state",        crypto.randomUUID())

window.location.href = url.toString()`}
          </Block>
        </CardBody>
      </Card>

      <Card>
        <CardHead>Step 2 — Handle the callback</CardHead>
        <CardBody>
          <p className="text-sm text-muted-foreground mb-3">
            After the user authorizes, they're redirected to your <Code>redirect_uri</Code> with query params including a <Code>token</Code>.
          </p>
          <Block lang="js" label="Callback URL example">{`https://yourapp.com/callback
  ?token=a3f9...
  &user_id=uuid-here
  &username=player1
  &state=your-state-value`}
          </Block>
          <Block lang="js" label="Parse it">{`const p = new URLSearchParams(window.location.search)
const token    = p.get("token")    // store this!
const userId   = p.get("user_id")
const username = p.get("username")
const state    = p.get("state")    // verify matches what you sent`}
          </Block>
          <Warn>Store the <strong>token</strong> — it's how you make future API calls without asking the user again.</Warn>
        </CardBody>
      </Card>

      <H2>Scopes</H2>
      <ScopeTable rows={[
        ["read_id",       "User UUID — returned in callback"],
        ["read_username", "Username — returned in callback"],
        ["read_balance",  "Balance — returned in callback and /api/oauth/me"],
        ["spend_balance", "Deduct balance, credited to app owner via /api/oauth/spend"],
        ["buy_listing",   "Buy marketplace listings via /api/oauth/listings/buy"],
        ["write_cases",   "Open cases on behalf of user via /api/oauth/cases/open"],
        ["notify",        "Send in-app notifications via /api/oauth/notify"],
      ]} />
    </>
  )
}

function TokensDocs() {
  return (
    <>
      <H1>Tokens</H1>
      <Desc>A token is generated when a user authorizes your app. Use it to make API calls without re-authorizing.</Desc>

      <Card>
        <CardHead>GET /api/oauth/me — fetch user info</CardHead>
        <CardBody>
          <Block lang="js" label="Request">{`fetch("${BASE}/api/oauth/me?token=TOKEN_HERE")`}
          </Block>
          <Block lang="response" label="Response">{`{
  "user_id":  "uuid-here",
  "username": "player1",
  "balance":  42.50
}`}
          </Block>
          <p className="text-xs text-muted-foreground">Only returns fields the token has scope for.</p>
        </CardBody>
      </Card>

      <H2>Token behaviour</H2>
      <div className="border border-border rounded-xl overflow-hidden mb-6">
        {[
          ["Persistent",    "Tokens don't expire — they last until the user revokes them"],
          ["Scoped",        "Each token only grants the scopes the user approved"],
          ["last_used_at",  "Updated automatically on every API call"],
          ["Revocation",    "Users can revoke tokens from their account settings"],
        ].map(([k, v]) => (
          <div key={k} className="grid grid-cols-[140px_1fr] px-4 py-2.5 border-b border-border/40 last:border-0 items-start">
            <span className="text-xs font-semibold">{k}</span>
            <span className="text-xs text-muted-foreground">{v}</span>
          </div>
        ))}
      </div>

      <Warn>
        <strong>Treat tokens like passwords.</strong> Never log them, expose them client-side, or commit them to source control.
      </Warn>
    </>
  )
}

function SpendDocs() {
  return (
    <>
      <H1>Spend Balance</H1>
      <Desc>Deduct balance from an authorized user. The amount is transferred to your account (app owner).</Desc>

      <Card>
        <CardHead>POST /api/oauth/spend</CardHead>
        <CardBody>
          <Block lang="js" label="Request">{`fetch("${BASE}/api/oauth/spend", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    token:  "user_token_here",
    amount: 2.50
  })
})`}
          </Block>
          <Block lang="response" label="Success response">{`{ "ok": true, "spent": 2.50, "new_balance": 47.50 }`}
          </Block>
          <Block lang="response" label="Error responses">{`{ "error": "Invalid or revoked token" }       // 401
{ "error": "Token does not have spend_balance scope" } // 403
{ "error": "Insufficient balance" }           // 402`}
          </Block>
        </CardBody>
      </Card>

      <H2>Rules</H2>
      <div className="border border-border rounded-xl overflow-hidden mb-4">
        {[
          ["Amount",       "Must be a positive number — you can only spend, never add"],
          ["Transfer",     "Deducted from user, credited to app owner account"],
          ["Notification", "User receives an in-app notification every time balance is spent"],
          ["Requires",     "spend_balance scope on the token"],
        ].map(([k, v]) => (
          <div key={k} className="grid grid-cols-[120px_1fr] px-4 py-2.5 border-b border-border/40 last:border-0 items-start">
            <span className="text-xs font-semibold">{k}</span>
            <span className="text-xs text-muted-foreground">{v}</span>
          </div>
        ))}
      </div>

      <Warn>
        Only call <Code>/api/oauth/spend</Code> from your <strong>server</strong>. Tokens exposed client-side can be abused.
      </Warn>
    </>
  )
}

function PublicDocs() {
  return (
    <>
      <H1>Public API</H1>
      <Desc>These endpoints require no authentication. Safe to call from client-side code.</Desc>

      <Card>
        <CardHead>GET /api/admin/items — all items</CardHead>
        <CardBody>
          <Block lang="response" label="Response">{`[
  {
    "id":           "uuid",
    "name":         "Dragon Claw",
    "image_url":    "https://...",
    "rarity":       "Legendary",
    "likelihood":   2.5,
    "market_price": 49.99,
    "rap":          45.00
  }
]`}
          </Block>
        </CardBody>
      </Card>

      <Card>
        <CardHead>GET /api/rolls?limit=50 — recent rolls</CardHead>
        <CardBody>
          <p className="text-sm text-muted-foreground mb-3">Returns the most recent rolls. <Code>limit</Code> is respected (1–200, default 30).</p>
          <Block lang="response" label="Response">{`[
  {
    "id":         "uuid",
    "created_at": "2025-01-01T00:00:00Z",
    "username":   "player1",
    "item_name":  "Dragon Claw",
    "image_url":  "https://...",
    "rarity":     "Legendary",
    "rap":        45.00
  }
]`}
          </Block>
        </CardBody>
      </Card>

      <Card>
        <CardHead>GET /api/leaderboard — top players by RAP</CardHead>
        <CardBody>
          <Block lang="response" label="Response">{`[
  {
    "username":  "topplayer",
    "plus":      true,
    "rap":       1234.56,
    "itemCount": 42
  }
]`}
          </Block>
        </CardBody>
      </Card>

      <Card>
        <CardHead>GET /api/users?username=x — user profile</CardHead>
        <CardBody>
          <p className="text-sm text-muted-foreground mb-3">Look up a single user by exact username (case-insensitive). Also supports <Code>?id=uuid</Code>.</p>
          <Block lang="response" label="Response">{`{
  "id":          "uuid",
  "username":    "player1",
  "balance":     12.50,
  "plus":        false,
  "cases":       100
}`}
          </Block>
        </CardBody>
      </Card>

      <Card>
        <CardHead>GET /api/inventory/{"{userId}"} — user inventory</CardHead>
        <CardBody>
          <Block lang="response" label="Response">{`[
  {
    "id":   "uuid",
    "item": { "name": "Dragon Claw", "rarity": "Omega", "rap": 99.99 }
  }
]`}
          </Block>
        </CardBody>
      </Card>

      <Card>
        <CardHead>GET /api/listings — marketplace listings</CardHead>
        <CardBody>
          <p className="text-sm text-muted-foreground mb-3">Paginated active listings. Supports filtering, sorting, and search.</p>
          <Block lang="js" label="Query params">{`page=0          // page number (default 0)
limit=24        // results per page (default 24, max 1000)
sortBy=price    // "price" or "created_at"
sortDir=asc     // "asc" or "desc"
minPrice=1.00   // minimum price filter
maxPrice=50.00  // maximum price filter
search=dragon   // filter by item name
rarity=Rare     // filter by rarity (comma-separated: "Rare,Legendary")`}
          </Block>
          <Block lang="response" label="Response">{`{
  "listings": [
    {
      "id":       "uuid",
      "price":    12.50,
      "status":   "active",
      "items":    { "name": "Dragon Claw", "rarity": "Legendary", "rap": 45.00 },
      "users":    { "username": "seller1" }
    }
  ],
  "total":    142,
  "page":     0,
  "pageSize": 24
}`}
          </Block>
        </CardBody>
      </Card>
    </>
  )
}

function ListingsDocs() {
  return (
    <>
      <H1>Buy Listings</H1>
      <Desc>Purchase a marketplace listing on behalf of an authorized user. Balance is deducted from the user and the seller is credited.</Desc>

      <Card>
        <CardHead>POST /api/oauth/listings/buy</CardHead>
        <CardBody>
          <Block lang="js" label="Request">{`fetch("${BASE}/api/oauth/listings/buy", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    token:      "user_token_here",
    listing_id: "uuid-of-listing"
  })
})`}
          </Block>
          <Block lang="response" label="Success response">{`{
  "ok":          true,
  "item_name":   "Dragon Claw",
  "price":       12.50,
  "new_balance": 37.50
}`}
          </Block>
          <Block lang="response" label="Error responses">{`{ "error": "Invalid or revoked token" }             // 401
{ "error": "Token does not have buy_listing scope" }  // 403
{ "error": "Listing not found or already sold" }      // 404
{ "error": "Cannot buy your own listing" }            // 400
{ "error": "Insufficient balance" }                   // 402`}
          </Block>
        </CardBody>
      </Card>

      <H2>Getting listing IDs</H2>
      <p className="text-sm text-muted-foreground mb-3">
        Fetch active listings from the public API to get <Code>listing_id</Code> values:
      </p>
      <Block lang="js" label="Fetch listings">{`const res = await fetch("${BASE}/api/listings?limit=24&page=0")
const { listings } = await res.json()
// listings[0].id is the listing_id to pass`}
      </Block>
    </>
  )
}

function NotifyDocs() {
  return (
    <>
      <H1>Notifications</H1>
      <Desc>Send an in-app notification to a user who has authorized your app. The notification appears under their bell icon.</Desc>

      <Card>
        <CardHead>POST /api/oauth/notify</CardHead>
        <CardBody>
          <Block lang="js" label="Request">{`fetch("${BASE}/api/oauth/notify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    token: "user_token_here",
    title: "Your order shipped",
    body:  "Your item is on its way!"
  })
})`}
          </Block>
          <Block lang="response" label="Success response">{`{ "ok": true }`}
          </Block>
          <Block lang="response" label="Error responses">{`{ "error": "Invalid or revoked token" }        // 401
{ "error": "Token does not have notify scope" } // 403`}
          </Block>
        </CardBody>
      </Card>

      <H2>How it appears</H2>
      <div className="border border-border rounded-xl overflow-hidden mb-4">
        {[
          ["Title",  "Prefixed with app name: \"MyApp: Your order shipped\""],
          ["Body",   "Your body text, shown in full"],
          ["Link",   "No link — notification is display-only"],
          ["Unread", "Shows as unread until the user opens notifications"],
        ].map(([k, v]) => (
          <div key={k} className="grid grid-cols-[80px_1fr] px-4 py-2.5 border-b border-border/40 last:border-0 items-start">
            <span className="text-xs font-semibold">{k}</span>
            <span className="text-xs text-muted-foreground">{v}</span>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        You can also send notifications directly from the <strong>Developer Dashboard</strong> → Notify tab without writing any code.
      </p>
    </>
  )
}

function CasesDocs() {
  return (
    <>
      <H1>Open Cases</H1>
      <Desc>Open cases on behalf of an authorized user using their token. Each spin is provably fair with HMAC-SHA256.</Desc>

      <Card>
        <CardHead>POST /api/oauth/cases/open</CardHead>
        <CardBody>
          <Block lang="js" label="Request">{`fetch("${BASE}/api/oauth/cases/open", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    token:       "user_token_here",
    client_seed: "optional-custom-seed"  // defaults to "omegacases"
  })
})`}
          </Block>
          <Block lang="response" label="Success response">{`{
  "wonItem": {
    "id":           "uuid",
    "name":         "Dragon Claw",
    "image_url":    "https://...",
    "rarity":       "Legendary",
    "rap":          45.00,
    "market_price": 49.99
  },
  "cases_remaining":  12,
  "server_seed_hash": "sha256 hash shown before spin",
  "server_seed":      "revealed seed for verification",
  "client_seed":      "optional-custom-seed",
  "nonce":            0,
  "float":            0.4821903467
}`}
          </Block>
          <Block lang="response" label="Error responses">{`{ "error": "Invalid or revoked token" }              // 401
{ "error": "Token does not have write_cases scope" }  // 403
{ "error": "No cases remaining" }                     // 402`}
          </Block>
        </CardBody>
      </Card>

      <H2>Provably fair</H2>
      <p className="text-sm text-muted-foreground mb-4">
        Every spin uses <strong>HMAC-SHA256</strong> with a server seed and client seed. You can verify any roll independently.
      </p>
      <div className="border border-border rounded-xl overflow-hidden mb-4">
        {[
          ["Algorithm",        "HMAC-SHA256(serverSeed, clientSeed:nonce:0) → first 8 hex chars as uint32 / 0x100000000"],
          ["server_seed_hash", "SHA-256 of the server seed — commit shown before rolling"],
          ["server_seed",      "Revealed in the response so the roll can be independently verified"],
          ["client_seed",      "Your input — defaults to 'omegacases', override per request"],
          ["Verify endpoint",  "GET /api/rolls/verify?id=roll_id — recomputes and confirms integrity"],
        ].map(([k, v]) => (
          <div key={k} className="grid grid-cols-[160px_1fr] px-4 py-2.5 border-b border-border/40 last:border-0 items-start">
            <span className="text-xs font-semibold">{k}</span>
            <span className="text-xs text-muted-foreground font-mono">{v}</span>
          </div>
        ))}
      </div>

      <Block lang="js" label="Verify a roll yourself">{`const hmac = createHmac("sha256", server_seed)
hmac.update(\`\${client_seed}:\${nonce}:0\`)
const hex   = hmac.digest("hex")
const float = parseInt(hex.slice(0, 8), 16) / 0x100000000
// float should match the float in the response`}
      </Block>
    </>
  )
}

function MiningPoolsDocs() {
  return (
    <>
      <H1>Creating your own OmegaCases Mining Pool</H1>
      <Desc>
        A mining pool lets many miners combine hashpower and split OmegaZites rewards proportionally to
        the shares they contribute. You do not need much custom code to run one. OmegaCases handles
        listing, uptime checks, the join flow, and splitting the reward, all automatically.
      </Desc>

      <Card>
        <CardHead>What you actually need to build</CardHead>
        <CardBody>
          <p className="text-sm text-muted-foreground mb-3">
            Only two things are required from you as the pool operator.
          </p>
          <div className="border border-border rounded-xl overflow-hidden mb-2">
            {[
              ["1. Answer PING with PONG", "Something listening on the port you register, that replies with the text PONG when it receives PING. This can be a few lines in almost any language."],
              ["2. Accept miners and report blocks", "Your own logic for accepting miner connections, tracking their shares (PPLNS, proportional, or anything you like), and calling the submit-block endpoint whenever you solve a block."],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[220px_1fr] px-4 py-2.5 border-b border-border/40 last:border-0 items-start">
                <span className="text-xs font-semibold">{k}</span>
                <span className="text-xs text-muted-foreground">{v}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Everything else, listing your pool publicly, checking that it is still online, letting users
            join, and splitting the OmegaZites reward across participants, is handled by OmegaCases for you.
          </p>
        </CardBody>
      </Card>

      <Warn>
        <strong>You do not have to design this protocol yourself.</strong> The official miner at{" "}
        <Code>github.com/harsiz/oc-miner</Code> already ships a working reference pool server,{" "}
        <Code>oc-pool-server</Code>, that implements a small, documented protocol (the OC-Miner Pool
        Protocol v1, newline-delimited JSON) and already answers PING with PONG and calls submit-block
        for you. Most operators can just run <Code>oc-pool-server -listen 0.0.0.0:PORT -pool-id ID
        -api-key KEY</Code> instead of writing anything. The miner itself already supports pointing at
        any pool speaking this protocol, so members can mine to your pool immediately, no custom client
        needed either. Build your own server only if you want different payout logic or a different
        wire protocol.
      </Warn>

      <H2>Prerequisites</H2>
      <p className="text-sm text-muted-foreground mb-6">
        You need a VPS or a machine you control (even a home computer works) with a public IPv4 or IPv6
        address and an open port that miners and OmegaCases can reach. You can create an unlimited
        number of pools.
      </p>

      <Card>
        <CardHead>POST /api/mining/pools (register a pool)</CardHead>
        <CardBody>
          <Block lang="js" label="Request">{`fetch("${BASE}/api/mining/pools", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    owner_id:    "your-user-id",
    name:        "My Pool",
    host:        "203.0.113.10",
    port:        3333,
    ip_version:  "auto",       // "ipv4", "ipv6", or "auto"
    description: "Low fee pool, PPLNS payouts"
  })
})`}
          </Block>
          <Block lang="response" label="Response">{`{
  "success": true,
  "pool":    { "id": "pool-uuid", "status": "testing", ... },
  "api_key": "a3f9c2...",
  "warning": "Save this API key now, it will not be shown again."
}`}
          </Block>
          <Warn>
            <strong>Save the api_key immediately.</strong> It is shown once and is required to authenticate
            every future call your pool makes to OmegaCases.
          </Warn>
        </CardBody>
      </Card>

      <H2>Authenticating pool API calls</H2>
      <p className="text-sm text-muted-foreground mb-6">
        Calls your pool makes to OmegaCases (like submitting a found block) are authenticated with your
        API key, not a normal user session, since your pool is an unattended server rather than a logged
        in browser. Send it as a bearer token.
      </p>
      <Block lang="js" label="Authorization header">{`Authorization: Bearer a3f9c2...`}
      </Block>

      <H2>The 30 second liveness check</H2>
      <p className="text-sm text-muted-foreground mb-4">
        After you register, OmegaCases's own server starts connecting to the host and port you gave it.
        It sends a short message, <Code>PING</Code>, and expects <Code>PONG</Code> back. This repeats for
        about 30 seconds. If enough of those checks succeed, your pool's status changes from
        <Code>testing</Code> to <Code>active</Code> and it appears on the public pool list at
        <Code>/mining</Code>. If it fails, your pool goes back to <Code>pending</Code> and you can fix
        whatever is blocking the connection (a firewall rule, for example) and try again by editing the
        pool, which restarts the check.
      </p>

      <H2>Ongoing uptime checks</H2>
      <p className="text-sm text-muted-foreground mb-6">
        OmegaCases keeps re-checking active pools the same way, roughly every few minutes, for as long as
        you are listed. A pool that stops answering PING for several checks in a row gets marked
        offline until it responds again. You do not need to call anything yourself for this, OmegaCases
        always initiates the check.
      </p>

      <Card>
        <CardHead>POST /api/mining/pools/{"{id}"}/submit-block (report a found block)</CardHead>
        <CardBody>
          <p className="text-sm text-muted-foreground mb-3">
            Call this when your pool solves a block. Include the winning nonce and hash, plus the shares
            each participant contributed for that round.
          </p>
          <Block lang="js" label="Request">{`fetch("${BASE}/api/mining/pools/{id}/submit-block", {
  method: "POST",
  headers: {
    "Content-Type":  "application/json",
    "Authorization": "Bearer a3f9c2..."
  },
  body: JSON.stringify({
    nonce: 918234,
    hash:  "0000abc...",
    shares: [
      { "user_id": "uuid-of-participant",       "shares": 1500 },
      { "user_id": "uuid-of-another-participant", "shares": 800 }
    ]
  })
})`}
          </Block>
          <Block lang="response" label="Response">{`{
  "success": true,
  "block":   { "height": 1234, "reward_zites": 64 },
  "payouts": [
    { "user_id": "...", "shares": 1500, "zites_credited": 41.7391 },
    { "user_id": "...", "shares": 800,  "zites_credited": 22.2609 }
  ]
}`}
          </Block>
          <Warn>
            The proof of work preimage for a pool block is <Code>previous_hash + pool_id_no_dashes + nonce</Code>,
            using your pool's own id in place of an individual miner's id, since many people contribute to
            one pool block. This differs from solo mining, where the miner's own user id is used instead.
          </Warn>
          <p className="text-xs text-muted-foreground">
            Any <Code>user_id</Code> in the shares list that has not joined your pool through the site first
            is ignored. Users join from your pool's page by pressing Join Pool.
          </p>
        </CardBody>
      </Card>

      <H2>PPLNS and payout logic is your responsibility</H2>
      <p className="text-sm text-muted-foreground mb-6">
        OmegaCases does not care how you decide share weights internally, whether that is PPLNS, PPS,
        simple proportional, or anything else. It only takes the shares list you submit at block-found
        time and splits that block's OmegaZites reward proportionally among those numbers. All internal
        accounting, minimum payout thresholds, and fairness between your own miners is entirely up to you.
      </p>

      <H2>Getting listed and letting users join</H2>
      <p className="text-sm text-muted-foreground mb-6">
        Once active, your pool appears on <Code>/mining</Code> showing its uptime, blocks found, and
        member count so prospective miners can evaluate it before joining. When a user presses Join Pool,
        OmegaCases simply records them as a participant, so the site can show that they are a member and
        so your <Code>submit-block</Code> calls can credit their <Code>user_id</Code>. The user still
        needs to separately configure their own mining software with your pool's host and port to actually
        start contributing hashpower, joining on the site does not connect them to your server for you.
      </p>

      <H2>Endpoints at a glance</H2>
      <div className="border border-border rounded-xl overflow-hidden mb-4">
        <Row method="POST" path="/api/mining/pools"                    desc="Register a new pool, returns a one time API key" />
        <Row method="GET"  path="/api/mining/pools"                    desc="Public list of active pools" />
        <Row method="GET"  path="/api/mining/pools/{id}"                desc="Pool detail, stats, and recent blocks" />
        <Row method="PATCH" path="/api/mining/pools/{id}"               desc="Owner edits, host or port changes re-run the liveness check" />
        <Row method="POST" path="/api/mining/pools/{id}/join"           desc="Join a pool as a declared participant" />
        <Row method="DELETE" path="/api/mining/pools/{id}/join"         desc="Leave a pool" />
        <Row method="POST" path="/api/mining/pools/{id}/submit-block"   desc="Report a found block and the shares to split its reward" />
      </div>

      <Warn>
        Treat your pool's API key like a password. Anyone with it can submit blocks and shares on your
        pool's behalf.
      </Warn>
    </>
  )
}

// ─── Router ───────────────────────────────────────────────────────────────────

const PAGES: Record<string, React.FC> = {
  overview: Overview,
  oauth:    OAuthDocs,
  tokens:   TokensDocs,
  spend:    SpendDocs,
  cases:    CasesDocs,
  listings: ListingsDocs,
  notify:   NotifyDocs,
  public:   PublicDocs,
  "mining-pools": MiningPoolsDocs,
}

export default function DocsSection() {
  const { section } = useParams<{ section: string }>()
  const Page = PAGES[section]
  if (!Page) return notFound()
  return (
    <div className="max-w-2xl px-8 py-10">
      <Page />
    </div>
  )
}
