"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@/lib/types"

const TOKEN_KEY = "oc_session_token"
const USER_KEY = "oc_user_id"

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

  // Fetch fresh user data from DB (used for refreshUser)
  const fetchUser = useCallback(async (userId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single()
    return data as User | null
  }, [])

  const refreshUser = useCallback(async () => {
    const userId = localStorage.getItem(USER_KEY)
    const token = localStorage.getItem(TOKEN_KEY)
    if (!userId || !token) return
    // Re-validate then fetch fresh data
    const res = await fetch("/api/auth/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, session_token: token }),
    })
    if (!res.ok) return
    const { user: freshUser } = await res.json()
    if (freshUser) setUser(freshUser)
  }, [])

  useEffect(() => {
    const init = async () => {
      const userId = localStorage.getItem(USER_KEY)
      const token = localStorage.getItem(TOKEN_KEY)

      if (userId && token) {
        // Validate the session token server-side — rejects forged user IDs
        const res = await fetch("/api/auth/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, session_token: token }),
        })
        if (res.ok) {
          const { valid, user: validatedUser } = await res.json()
          if (valid && validatedUser) {
            setUser(validatedUser)
          } else {
            // Invalid or tampered session — clear it
            localStorage.removeItem(USER_KEY)
            localStorage.removeItem(TOKEN_KEY)
          }
        } else {
          localStorage.removeItem(USER_KEY)
          localStorage.removeItem(TOKEN_KEY)
        }
      }
      setLoading(false)
    }
    init()
  }, [])

  const login = async (username: string, password: string): Promise<{ error?: string }> => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
    const json = await res.json()
    if (!res.ok) return { error: json.error || "Login failed" }
    localStorage.setItem(USER_KEY, json.user.id)
    localStorage.setItem(TOKEN_KEY, json.session_token)
    setUser(json.user)
    return {}
  }

  const register = async (username: string, password: string): Promise<{ error?: string }> => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
    const json = await res.json()
    if (!res.ok) return { error: json.error || "Registration failed" }
    localStorage.setItem(USER_KEY, json.user.id)
    localStorage.setItem(TOKEN_KEY, json.session_token)
    setUser(json.user)
    return {}
  }

  const logout = async () => {
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(TOKEN_KEY)
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
