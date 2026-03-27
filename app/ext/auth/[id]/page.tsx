"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Box, Button, Card, CardContent, Typography, CircularProgress, Container, Alert } from "@mui/material"
import { useAuth } from "@/lib/auth-context"
import NextLink from "next/link"

export default function OAuthConsentPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [req, setReq] = useState<any>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState("")

  const requestId = params.id as string

  useEffect(() => {
    const loadRequest = async () => {
      try {
        const res = await fetch("/api/admin/settings")
        const db_data = await res.json()
        
        // Fetch the oauth_request directly by calling an internal endpoint
        const check = await fetch(`/api/oauth/info?id=${requestId}`)
        const data = await check.json()
        if (!data.success) {
          setError("Request not found or expired")
          return
        }
        setReq(data.request)
      } catch (e) {
        setError("Failed to load request")
      } finally {
        setLoading(false)
      }
    }
    loadRequest()
  }, [requestId])

  if (!user) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" color="error" gutterBottom>
              Not authenticated
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Please <NextLink href="/login" style={{ color: "#1565c0", fontWeight: 600 }}>sign in</NextLink> to continue.
            </Typography>
          </CardContent>
        </Card>
      </Container>
    )
  }

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 12, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Container>
    )
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
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
    } catch (e) {
      setError("Error processing request")
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Card sx={{ borderRadius: 2, boxShadow: "0 4px 12px rgba(21, 101, 192, 0.1)" }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ mb: 3, textAlign: "center" }}>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Connect with OmegaCases
            </Typography>
          </Box>

          <Box sx={{ bgcolor: "#f5f5f5", p: 2, borderRadius: 1, mb: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Service:
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {req?.service_name}
            </Typography>
          </Box>

          <Box sx={{ bgcolor: "#f5f5f5", p: 2, borderRadius: 1, mb: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Connecting user:
            </Typography>
            <Typography variant="body1" fontWeight={600} sx={{ fontFamily: "monospace", fontSize: "0.95rem" }}>
              {user.id.slice(0, -3)}***
            </Typography>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              This service will receive:
            </Typography>
            <Box component="ul" sx={{ m: 1, pl: 2, fontSize: "0.9rem" }}>
              {req?.get_user_id && <li>Your user ID</li>}
              {req?.get_username && <li>Your username</li>}
              {req?.get_balance && <li>Your balance</li>}
            </Box>
          </Box>

          <Box sx={{ display: "flex", gap: 2 }}>
            <Button
              variant="outlined"
              fullWidth
              disabled={confirming}
              onClick={() => handleConfirm(false)}
            >
              Decline
            </Button>
            <Button
              variant="contained"
              fullWidth
              disabled={confirming}
              onClick={() => handleConfirm(true)}
              sx={{ bgcolor: "#1565c0" }}
            >
              {confirming ? "Processing..." : "Connect"}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  )
}
