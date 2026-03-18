"use client"

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react"

type ThemeMode = "light" | "dark"

interface ThemeModeContextType {
  mode: ThemeMode
  toggleMode: () => void
}

export const ThemeModeContext = createContext<ThemeModeContextType>({
  mode: "light",
  toggleMode: () => {},
})

export function useThemeMode() {
  return useContext(ThemeModeContext)
}

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light")

  useEffect(() => {
    try {
      const stored = localStorage.getItem("oc_theme") as ThemeMode | null
      if (stored === "dark" || stored === "light") setMode(stored)
    } catch {}
  }, [])

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next: ThemeMode = prev === "light" ? "dark" : "light"
      try { localStorage.setItem("oc_theme", next) } catch {}
      return next
    })
  }, [])

  const value = useMemo(() => ({ mode, toggleMode }), [mode, toggleMode])

  return (
    <ThemeModeContext.Provider value={value}>
      {children}
    </ThemeModeContext.Provider>
  )
}
