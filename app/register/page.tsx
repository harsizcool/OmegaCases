"use client"

import { useState } from "react"
import NextLink from "next/link"
import { useRouter } from "next/navigation"
import {
  Container, Box, Card, CardContent, Typography,
  TextField, Button, Alert, CircularProgress, Divider,
} from "@mui/material"
import { useAuth } from "@/lib/auth-context"

export default function RegisterPage() {
  const { register } = useAuth()
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (password !== confirm) { setError("Passwords do not match"); return }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return }
    setLoading(true)
    const { error: err } = await register(username, password)
    setLoading(false)
    if (err) { setError(err); return }
    router.push("/")
  }

  return (
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <Box textAlign="center" mb={3}>
        <Box
          component="img"
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/omegacrate_logo-tJzRwAfwpZAQEkJOSjQGI93l5hRU06.png"
          alt="OmegaCases"
          sx={{ width: 64, height: 64, mb: 1 }}
        />
        <Typography variant="h5" fontWeight={700}>Create Account</Typography>
      </Box>
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              helperText="3–20 characters"
              fullWidth
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Confirm Password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              fullWidth
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={18} /> : null}
            >
              {loading ? "Creating…" : "Create Account"}
            </Button>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Typography variant="body2" textAlign="center" color="text.secondary">
            Have an account?{" "}
            <NextLink href="/login" style={{ color: "#1976d2", fontWeight: 600 }}>
              Sign in
            </NextLink>
          </Typography>
        </CardContent>
      </Card>
    </Container>
  )
}
