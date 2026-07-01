"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import NextLink from "next/link"
import { ArrowLeft, Server, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/lib/auth-context"

export default function CreatePoolPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [name, setName] = useState("")
  const [host, setHost] = useState("")
  const [port, setPort] = useState("")
  const [ipVersion, setIpVersion] = useState("auto")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ pool_id: string; api_key: string } | null>(null)
  const [copied, setCopied] = useState(false)

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center text-sm text-muted-foreground">
        Log in to create a mining pool.
      </div>
    )
  }

  const handleSubmit = async () => {
    setError(null)
    if (!name || !host || !port) {
      setError("Name, host, and port are required")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/mining/pools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_id: user.id,
          name,
          host,
          port: Number(port),
          ip_version: ipVersion,
          description: description || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to create pool")
      } else {
        setResult({ pool_id: data.pool.id, api_key: data.api_key })
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10">
        <Card className="bg-card/60">
          <CardHeader>
            <CardTitle className="text-lg">Pool registered</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Alert>
              <AlertDescription className="text-xs">
                Save this API key now. It will not be shown again, and you need it to authenticate
                your pool's heartbeat and found-block calls.
              </AlertDescription>
            </Alert>
            <div className="flex items-center gap-2 bg-muted rounded-lg p-3 font-mono text-xs break-all">
              {result.api_key}
              <button
                onClick={() => { navigator.clipboard.writeText(result.api_key); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Your pool is now being tested. OmegaCases will connect to your server for about 30
              seconds and expects a PONG reply to a PING message. Once it passes, it appears on the
              public pool list automatically.
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => router.push(`/mining/pools/${result.pool_id}`)}>View Pool</Button>
              <Button variant="outline" className="flex-1" asChild>
                <NextLink href="/developer/docs/mining-pools">Read the docs</NextLink>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <NextLink href="/mining" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft size={14} /> Back to pools
      </NextLink>

      <Card className="bg-card/60">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Server size={18} className="text-primary" /> Create a Mining Pool
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            You need your own server (a VPS or a machine at home) reachable at a public IPv4 or
            IPv6 address before registering. See the{" "}
            <NextLink href="/developer/docs/mining-pools" className="text-primary hover:underline">Mining Pools documentation</NextLink>{" "}
            for the full setup guide.
          </p>

          <div>
            <Label className="text-xs mb-1 block">Pool name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Pool" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs mb-1 block">Host (IP or hostname)</Label>
              <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="203.0.113.10" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Port</Label>
              <Input type="number" value={port} onChange={(e) => setPort(e.target.value)} placeholder="3333" />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1 block">IP version</Label>
            <Select value={ipVersion} onValueChange={setIpVersion}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
                <SelectItem value="ipv4">IPv4</SelectItem>
                <SelectItem value="ipv6">IPv6</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-1 block">Description (optional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Low-fee pool, PPLNS payouts" />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Registering…" : "Register Pool"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
