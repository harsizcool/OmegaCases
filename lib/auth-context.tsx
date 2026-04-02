"use client"

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react"
import type { User } from "@/lib/types"

const TOKEN_KEY = "oc_session_token"
const USER_KEY  = "oc_user_id"
const CACHE_KEY = "oc_user_cache"      // sessionStorage — survives refresh, not new tab
const CACHE_TTL = 5 * 60 * 1000       // 5 min before re-validating with server

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<{ error?: string }>
  register: (username: string, password: string) => Promise<{ error?: string }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const validating = useRef(false)

  /* ── helpers ─────────────────────────────────────── */
  const readCache = (): { user: User; ts: number } | null => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }
  const writeCache = (u: User) => {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ user: u, ts: Date.now() })) } catch {}
  }
  const clearCache = () => {
    try { sessionStorage.removeItem(CACHE_KEY) } catch {}
  }

  /* ── validate with server ────────────────────────── */
  const validateSession = useCallback(async (userId: string, token: string): Promise<User | null> => {
    try {
      const res = await fetch("/api/auth/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, session_token: token }),
      })
      // ONLY clear stored creds on explicit 401 — not on network errors / 500s
      if (res.status === 401) return null
      if (!res.ok) throw new Error("Server error")
      const { valid, user: validatedUser } = await res.json()
      return valid && validatedUser ? validatedUser : null
    } catch {
      // Network / server error — keep user logged in, return cached value
      return undefined as unknown as User
    }
  }, [])

  /* ── init on mount ───────────────────────────────── */
  useEffect(() => {
    if (validating.current) return
    validating.current = true

    const init = async () => {
      try {
        const userId = localStorage.getItem(USER_KEY)
        const token  = localStorage.getItem(TOKEN_KEY)

        if (!userId || !token) { setLoading(false); return }

        // 1. Serve from sessionStorage cache immediately (no flash of "logged out")
        const cached = readCache()
        if (cached && Date.now() - cached.ts < CACHE_TTL) {
          setUser(cached.user)
          setLoading(false)
          // Still re-validate in background silently
          validateSession(userId, token).then((fresh) => {
            if (fresh === null) {
              // Explicit 401 — session truly revoked
              localStorage.removeItem(USER_KEY)
              localStorage.removeItem(TOKEN_KEY)
              clearCache()
              setUser(null)
            } else if (fresh && typeof fresh === "object" && "id" in fresh) {
              setUser(fresh)
              writeCache(fresh)
            }
          })
          return
        }

        // 2. No cache — validate synchronously so user isn't flashed as logged out
        const validated = await validateSession(userId, token)
        if (validated === null) {
          // Explicit 401
          localStorage.removeItem(USER_KEY)
          localStorage.removeItem(TOKEN_KEY)
          clearCache()
        } else if (validated && typeof validated === "object" && "id" in validated) {
          setUser(validated)
          writeCache(validated)
        }
        // else: server/network error — don't touch anything, user stays logged in on next load
      } finally {
        setLoading(false)
        validating.current = false
      }
    }
    init()
  }, [validateSession])

  /* ── refreshUser ─────────────────────────────────── */
  const refreshUser = useCallback(async () => {
    const userId = localStorage.getItem(USER_KEY)
    const token  = localStorage.getItem(TOKEN_KEY)
    if (!userId || !token) return
    const fresh = await validateSession(userId, token)
    if (fresh && typeof fresh === "object" && "id" in fresh) {
      setUser(fresh)
      writeCache(fresh)
    }
  }, [validateSession])

  /* ── login ───────────────────────────────────────── */
  const login = async (username: string, password: string): Promise<{ error?: string }> => {
    const res  = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
    const json = await res.json()
    if (!res.ok) return { error: json.error || "Login failed" }
    localStorage.setItem(USER_KEY, json.user.id)
    localStorage.setItem(TOKEN_KEY, json.session_token)
    writeCache(json.user)
    setUser(json.user)
    return {}
  }

  /* ── register ────────────────────────────────────── */
  const register = async (username: string, password: string): Promise<{ error?: string }> => {
    const res  = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
    const json = await res.json()
    if (!res.ok) return { error: json.error || "Registration failed" }
    localStorage.setItem(USER_KEY, json.user.id)
    localStorage.setItem(TOKEN_KEY, json.session_token)
    writeCache(json.user)
    setUser(json.user)
    return {}
  }

  /* ── logout ──────────────────────────────────────── */
  const logout = async () => {
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(TOKEN_KEY)
    clearCache()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
