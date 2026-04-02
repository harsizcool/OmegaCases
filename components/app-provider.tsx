"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { AuthProvider } from "@/lib/auth-context"

interface ThemeContextValue {
  mode: "light" | "dark"
  toggleMode: () => void
}

export const ThemeContext = React.createContext<ThemeContextValue>({
  mode: "light",
  toggleMode: () => {},
})

export function useThemeMode() {
  return React.useContext(ThemeContext)
}

function ThemeInner({ children }: { children: React.ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => { setMounted(true) }, [])

  const mode: "light" | "dark" = mounted && resolvedTheme === "dark" ? "dark" : "light"

  const toggleMode = React.useCallback(() => {
    setTheme(mode === "dark" ? "light" : "dark")
  }, [mode, setTheme])

  return (
    <ThemeContext.Provider value={{ mode, toggleMode }}>
      <AuthProvider>{children}</AuthProvider>
    </ThemeContext.Provider>
  )
}

export default function AppProvider({ children }: { children: React.ReactNode }) {
  return <ThemeInner>{children}</ThemeInner>
}
