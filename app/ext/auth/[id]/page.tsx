"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import NextLink from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/lib/auth-context"

export default function OAuthConsentPage() {
  const params = useParams()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [req, setReq] = useState<any>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState("")

  const requestId = params.id as string

  useEffect(() => {
    const loadRequest = async () => {
      try {
        const check = await fetch(`/api/oauth/info?id=${requestId}`)
        const data = await check.json()
        if (!data.success) { setError("Request not found or expired"); return }
        setReq(data.request)
      } catch {
        setError("Failed to load request")
      } finally {
        setLoading(false)
      }
    }
    loadRequest()
  }, [requestId])

  if (!user) {
    return (
      <div className="max-w-sm mx-auto px-4 py-12">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-bold text-destructive mb-2">Not authenticated</h2>
            <p className="text-sm text-muted-foreground">
              Please <NextLink href="/login" className="text-primary font-semibold hover:underline">sign in</NextLink> to continue.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 size={32} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-sm mx-auto px-4 py-12">
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      </div>
    )
  }

  const handleConfirm = async (accept: boolean) => {
    setConfirming(true)
    try {
      const res = await fetch("/api/oauth/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oauth_request_id: requestId, accept }),
      })
      const data = await res.json()
      if (data.success) {
        window.location.href = data.redirect_url
      } else {
        setError(data.message || "Failed to process request")
      }
    } catch {
      setError("Error processing request")
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-12">
      <Card>
        <CardContent className="p-8 flex flex-col gap-4">
          <h1 className="text-xl font-bold text-center">Connect with OmegaCases</h1>

          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Service:</p>
            <p className="font-semibold">{req?.service_name}</p>
          </div>

          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Connecting user:</p>
            <p className="font-semibold font-mono text-sm">{user.id.slice(0, -3)}***</p>
          </div>

          <div>
            <p className="text-sm font-semibold mb-2">This service will receive:</p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              {req?.get_user_id && <li>Your user ID</li>}
              {req?.get_username && <li>Your username</li>}
              {req?.get_balance && <li>Your balance</li>}
            </ul>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" disabled={confirming} onClick={() => handleConfirm(false)}>
              Decline
            </Button>
            <Button className="flex-1 gap-2" disabled={confirming} onClick={() => handleConfirm(true)}>
              {confirming && <Loader2 size={14} className="animate-spin" />}
              {confirming ? "Processing..." : "Connect"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
