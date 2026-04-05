"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import NextLink from "next/link"
import { CheckCircle, Loader2, Shield } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

const SCOPE_LABELS: Record<string, string> = {
  read_id:       "Read your User ID",
  read_username: "Read your username",
  read_balance:  "Read your balance",
  spend_balance: "Spend balance on your behalf",
  buy_listing:   "Buy marketplace listings on your behalf",
  write_cases:   "Open cases on your behalf",
  notify:        "Send you in-app notifications",
}

function AuthorizeContent() {
  const sp = useSearchParams()
  const { user } = useAuth()

  const clientId   = sp.get("client_id") ?? ""
  const redirectUri = sp.get("redirect_uri") ?? ""
  const scope      = sp.get("scope") ?? ""
  const state      = sp.get("state") ?? ""

  const [app, setApp] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const requestedScopes = scope ? scope.split(",").map(s => s.trim()).filter(Boolean) : []

  useEffect(() => {
    if (!clientId) { setError("Missing client_id"); setLoading(false); return }
    fetch(`/api/oauth/app?client_id=${encodeURIComponent(clientId)}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setApp(d) })
      .catch(() => setError("Failed to load application"))
      .finally(() => setLoading(false))
  }, [clientId])

  if (user === undefined || loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={28} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center">
        <p className="text-muted-foreground mb-4 text-sm">You need to be signed in to authorize this app.</p>
        <NextLink
          href={`/login?next=${encodeURIComponent(`/oauth/authorize?${sp.toString()}`)}`}
          className="inline-block px-5 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Sign In
        </NextLink>
      </div>
    )
  }

  if (error) {
    return <p className="text-destructive text-sm text-center">{error}</p>
  }

  const handleAction = async (accept: boolean) => {
    setSubmitting(true)
    try {
      const res = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, client_id: clientId, redirect_uri: redirectUri, scope, state, accept }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Something went wrong"); return }
      window.location.href = data.redirect_url
    } catch {
      setError("Network error")
    } finally {
      setSubmitting(false)
    }
  }

  return app ? (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-5 border-b border-border/60">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Authorization request from</p>
        <p className="text-2xl font-bold">{app.name}</p>
        <p className="text-xs text-muted-foreground mt-1">by {app.owner}</p>
      </div>

      <div className="px-6 py-5">
        <p className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <Shield size={14} className="text-primary" /> This application wants to:
        </p>
        <ul className="space-y-2.5">
          {requestedScopes.map(s => (
            <li key={s} className="flex items-center gap-2.5 text-sm">
              <CheckCircle size={14} className="text-green-500 shrink-0" />
              {SCOPE_LABELS[s] ?? s}
            </li>
          ))}
          {requestedScopes.length === 0 && (
            <li className="text-sm text-muted-foreground">No specific data requested</li>
          )}
        </ul>
        <p className="text-xs text-muted-foreground mt-5">
          Authorizing as <span className="font-semibold text-foreground">{user.username}</span>
        </p>
      </div>

      <div className="px-6 py-4 border-t border-border/60 flex gap-3">
        <button
          onClick={() => handleAction(false)}
          disabled={submitting}
          className="flex-1 py-2 text-sm font-semibold border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
        >
          Decline
        </button>
        <button
          onClick={() => handleAction(true)}
          disabled={submitting}
          className="flex-1 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Authorize
        </button>
      </div>
    </div>
  ) : null
}

export default function AuthorizePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/omegacrate_logo-tJzRwAfwpZAQEkJOSjQGI93l5hRU06.png"
            alt="OmegaCases"
            className="w-12 h-12 mb-2"
          />
          <span className="text-base font-bold">Omega<span className="text-primary">Cases</span></span>
        </div>
        <Suspense fallback={<div className="flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>}>
          <AuthorizeContent />
        </Suspense>
      </div>
    </div>
  )
}
