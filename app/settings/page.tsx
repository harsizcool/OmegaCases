"use client"

import { useState, useRef, useEffect } from "react"
import NextLink from "next/link"
import { useRouter } from "next/navigation"
import { Camera, User, Settings, VolumeX, Volume2, Crown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/lib/auth-context"
import { useMuteSounds } from "@/lib/use-mute-sounds"

export default function SettingsPage() {
  const { user, refreshUser } = useAuth()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [mounted, setMounted] = useState(false)
  const [username, setUsername] = useState("")
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const { muted, toggle: toggleMute } = useMuteSounds()

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { if (user) setUsername(user.username) }, [user])

  if (!mounted) return null

  if (!user) {
    return (
      <div className="max-w-sm mx-auto px-4 py-20 text-center">
        <p className="text-muted-foreground mb-4">You must be logged in to view settings.</p>
        <Button onClick={() => router.push("/login")}>Login</Button>
      </div>
    )
  }

  const handleAvatarClick = () => fileInputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError("Image must be under 5MB."); return }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setError("")
  }

  const handleSave = async () => {
    setError("")
    setSuccess("")
    if (!username.trim()) { setError("Username cannot be empty."); return }
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append("userId", user.id)
      if (username !== user.username) formData.append("username", username.trim())
      if (avatarFile) formData.append("avatar", avatarFile)
      if (!avatarFile && username === user.username) { setError("No changes to save."); setSaving(false); return }
      const res = await fetch("/api/settings", { method: "POST", body: formData })
      const json = await res.json()
      if (!res.ok) { setError(json.error || "Failed to save settings.") }
      else {
        await refreshUser()
        setAvatarFile(null)
        setSuccess("Settings saved successfully!")
        setUsername(json.user.username)
      }
    } catch { setError("An unexpected error occurred.") }
    finally { setSaving(false) }
  }

  const avatarSrc = avatarPreview ?? user.profile_picture ?? undefined

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Settings size={28} className="text-primary" />
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      <div className="border border-border rounded-2xl overflow-hidden">
        {/* Profile header */}
        <div className="bg-muted px-6 py-8 flex flex-col items-center gap-3">
          <div className="relative">
            <Avatar className="w-24 h-24 border-4 border-background shadow-md">
              {avatarSrc && <AvatarImage src={avatarSrc} />}
              <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-bold">
                {user.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={handleAvatarClick}
              className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center border-2 border-background hover:bg-primary/90 transition-colors"
            >
              <Camera size={14} className="text-primary-foreground" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFileChange} />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">{user.username}</p>
            <p className="text-sm text-muted-foreground">{user.admin ? "Administrator" : "Member"}</p>
            {user.plus && (
              <span className="inline-flex items-center gap-1 mt-1 text-xs font-bold text-amber-600 border border-amber-400 rounded-full px-2 py-0.5 bg-amber-50 dark:bg-amber-950/30">
                <Crown size={11} className="text-amber-500" /> OmegaCases Plus
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <span className="text-xs border border-primary text-primary rounded-full px-2 py-0.5 font-semibold">${Number(user.balance).toFixed(2)} balance</span>
            <span className="text-xs border border-border rounded-full px-2 py-0.5 font-semibold">{user.cases ?? 0} cases opened</span>
          </div>
        </div>

        <Separator />

        <div className="px-6 py-6 flex flex-col gap-6">
          {success && <Alert><AlertDescription className="text-green-600">{success}</AlertDescription></Alert>}
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          {/* Username */}
          <div className="flex flex-col gap-2">
            <Label className="flex items-center gap-1.5 font-semibold">
              <User size={14} className="text-primary" /> Username
            </Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username"
              maxLength={32}
            />
            <p className="text-xs text-muted-foreground">This also changes your profile URL (/user/username)</p>
          </div>

          {/* Avatar upload */}
          <div className="flex flex-col gap-2">
            <Label className="flex items-center gap-1.5 font-semibold">
              <Camera size={14} className="text-primary" /> Profile Picture
            </Label>
            <button
              onClick={handleAvatarClick}
              className={`border-2 border-dashed rounded-xl py-6 text-center transition-all ${avatarFile ? "border-primary bg-primary/5" : "border-border hover:border-primary hover:bg-primary/5"}`}
            >
              {avatarFile ? (
                <div>
                  <p className="text-sm text-primary font-semibold">{avatarFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(avatarFile.size / 1024).toFixed(0)} KB — Click to change</p>
                </div>
              ) : (
                <div>
                  <Camera size={24} className="mx-auto mb-1 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to upload a new profile picture</p>
                  <p className="text-xs text-muted-foreground">JPEG, PNG, WebP or GIF — max 5MB</p>
                </div>
              )}
            </button>
          </div>

          <Separator />

          {/* Sound */}
          <div className="flex flex-col gap-2">
            <Label className="flex items-center gap-1.5 font-semibold">
              {muted ? <VolumeX size={14} className="text-muted-foreground" /> : <Volume2 size={14} className="text-primary" />}
              Sound
            </Label>
            <div className="flex items-center justify-between p-3 border border-border rounded-xl">
              <div>
                <p className="text-sm font-semibold">Mute all sounds</p>
                <p className="text-xs text-muted-foreground">Disables tick sounds and win effects while opening cases</p>
              </div>
              <Switch checked={muted} onCheckedChange={toggleMute} />
            </div>
          </div>

          <Separator />

          <Button size="lg" className="gap-2 font-bold" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  )
}
