"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@/lib/types"

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
    const stored = localStorage.getItem("oc_user_id")
    if (!stored) return
    const u = await fetchUser(stored)
    if (u) setUser(u)
  }, [fetchUser])

  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem("oc_user_id")
      if (stored) {
        const u = await fetchUser(stored)
        setUser(u)
      }
      setLoading(false)
    }
    init()
  }, [fetchUser])

  const login = async (username: string, password: string): Promise<{ error?: string }> => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
    const json = await res.json()
    if (!res.ok) return { error: json.error || "Login failed" }
    localStorage.setItem("oc_user_id", json.user.id)
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
    localStorage.setItem("oc_user_id", json.user.id)
    setUser(json.user)
    return {}
  }

  const logout = async () => {
    localStorage.removeItem("oc_user_id")
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
