"use client"

import { useState, useRef, useEffect } from "react"
import {
  Box, Container, Typography, Paper, Avatar, Button,
  TextField, Divider, Alert, Chip, CircularProgress,
  Stack, Switch, FormControlLabel,
} from "@mui/material"
import CameraAltIcon from "@mui/icons-material/CameraAlt"
import PersonIcon from "@mui/icons-material/Person"
import SettingsIcon from "@mui/icons-material/Settings"
import VolumeOffIcon from "@mui/icons-material/VolumeOff"
import VolumeUpIcon from "@mui/icons-material/VolumeUp"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
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
      <Container maxWidth="sm" sx={{ py: 10, textAlign: "center" }}>
        <Typography variant="h6" color="text.secondary">
          You must be logged in to view settings.
        </Typography>
        <Button variant="contained" sx={{ mt: 2 }} onClick={() => router.push("/login")}>
          Login
        </Button>
      </Container>
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
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
        <SettingsIcon sx={{ fontSize: 32, color: "primary.main" }} />
        <Typography variant="h4" fontWeight={700}>Settings</Typography>
      </Box>

      <Paper elevation={0} sx={{ border: "1px solid #e3f2fd", borderRadius: 3, overflow: "hidden" }}>
        <Box sx={{ bgcolor: "#f0f7ff", px: 4, py: 4, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <Box sx={{ position: "relative", display: "inline-flex" }}>
            <Avatar src={avatarSrc} sx={{ width: 100, height: 100, fontSize: 40, bgcolor: "primary.main", border: "3px solid #fff", boxShadow: 2 }}>
              {!avatarSrc && user.username[0].toUpperCase()}
            </Avatar>
            <Box onClick={handleAvatarClick} sx={{ position: "absolute", bottom: 0, right: 0, bgcolor: "primary.main", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "2px solid #fff", "&:hover": { bgcolor: "primary.dark" }, transition: "background 0.2s" }}>
              <CameraAltIcon sx={{ fontSize: 16, color: "#fff" }} />
            </Box>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={handleFileChange} />
          </Box>
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="h6" fontWeight={600}>{user.username}</Typography>
            <Typography variant="body2" color="text.secondary">{user.admin ? "Administrator" : "Member"}</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Chip label={`$${Number(user.balance).toFixed(2)} balance`} color="primary" variant="outlined" size="small" />
            <Chip label={`${user.cases ?? 0} cases opened`} variant="outlined" size="small" />
          </Stack>
        </Box>

        <Divider />

        <Box sx={{ px: 4, py: 4 }}>
          {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess("")}>{success}</Alert>}
          {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError("")}>{error}</Alert>}

          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <PersonIcon fontSize="small" sx={{ color: "primary.main" }} /> Username
              </Typography>
              <TextField fullWidth value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your username" size="small" inputProps={{ maxLength: 32 }} helperText="This also changes your profile URL (/user/username)" />
            </Box>

            <Box>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <CameraAltIcon fontSize="small" sx={{ color: "primary.main" }} /> Profile Picture
              </Typography>
              <Box onClick={handleAvatarClick} sx={{ border: "2px dashed #90caf9", borderRadius: 2, py: 3, textAlign: "center", cursor: "pointer", bgcolor: avatarFile ? "#f0f7ff" : "#fafafa", "&:hover": { borderColor: "primary.main", bgcolor: "#f0f7ff" }, transition: "all 0.2s" }}>
                {avatarFile ? (
                  <Box>
                    <Typography variant="body2" color="primary" fontWeight={600}>{avatarFile.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{(avatarFile.size / 1024).toFixed(0)} KB — Click to change</Typography>
                  </Box>
                ) : (
                  <Box>
                    <CameraAltIcon sx={{ fontSize: 28, color: "#90caf9", mb: 0.5 }} />
                    <Typography variant="body2" color="text.secondary">Click to upload a new profile picture</Typography>
                    <Typography variant="caption" color="text.secondary">JPEG, PNG, WebP or GIF — max 5MB</Typography>
                  </Box>
                )}
              </Box>
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                {muted
                  ? <VolumeOffIcon fontSize="small" sx={{ color: "text.secondary" }} />
                  : <VolumeUpIcon fontSize="small" sx={{ color: "primary.main" }} />
                }
                Sound
              </Typography>
              <Paper variant="outlined" sx={{ px: 2, py: 1.5, borderRadius: 2 }}>
                <FormControlLabel
                  control={<Switch checked={muted} onChange={toggleMute} />}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={600}>Mute all sounds</Typography>
                      <Typography variant="caption" color="text.secondary">Disables tick sounds and win effects while opening cases</Typography>
                    </Box>
                  }
                  sx={{ m: 0, width: "100%" }}
                  labelPlacement="start"
                />
              </Paper>
            </Box>

            <Divider />

            <Button variant="contained" size="large" onClick={handleSave} disabled={saving} sx={{ fontWeight: 700, display: "flex", gap: 1, alignItems: "center" }}>
              {saving && <CircularProgress size={16} sx={{ color: "inherit" }} />}
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Container>
  )
}
