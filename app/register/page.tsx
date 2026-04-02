"use client"

import { useState } from "react"
import NextLink from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
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
    <div className="max-w-sm mx-auto px-4 py-16">
      <div className="text-center mb-6">
        <img
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/omegacrate_logo-tJzRwAfwpZAQEkJOSjQGI93l5hRU06.png"
          alt="OmegaCases"
          className="w-16 h-16 mx-auto mb-3"
        />
        <h1 className="text-2xl font-bold">Create Account</h1>
      </div>
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Username</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
              <p className="text-xs text-muted-foreground">3–20 characters</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Confirm Password</Label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <Button type="submit" size="lg" disabled={loading} className="gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Creating…" : "Create Account"}
            </Button>
          </form>
          <Separator className="my-4" />
          <p className="text-sm text-center text-muted-foreground">
            Have an account?{" "}
            <NextLink href="/login" className="text-primary font-semibold hover:underline">Sign in</NextLink>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
