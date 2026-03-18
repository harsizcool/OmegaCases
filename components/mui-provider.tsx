"use client"

import * as React from "react"
import { createTheme, ThemeProvider, CssBaseline } from "@mui/material"
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

export default function MuiProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<"light" | "dark">("light")

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("omegacases_theme") as "light" | "dark" | null
      if (saved === "dark" || saved === "light") setMode(saved)
    } catch {}
  }, [])

  const toggleMode = React.useCallback(() => {
    setMode((prev) => {
      const next = prev === "light" ? "dark" : "light"
      try { localStorage.setItem("omegacases_theme", next) } catch {}
      return next
    })
  }, [])

  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: { main: "#1976d2", light: "#42a5f5", dark: "#1565c0" },
          secondary: { main: "#e3f2fd" },
          background: {
            default: mode === "light" ? "#ffffff" : "#0d1b2a",
            paper:   mode === "light" ? "#f8fbff" : "#132233",
          },
          text: {
            primary:   mode === "light" ? "#0d1b2a" : "#e8f0fe",
            secondary: mode === "light" ? "#546e7a" : "#90a4ae",
          },
        },
        typography: {
          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
          h1: { fontWeight: 700 },
          h2: { fontWeight: 700 },
          h3: { fontWeight: 600 },
          h4: { fontWeight: 600 },
          h5: { fontWeight: 600 },
          h6: { fontWeight: 600 },
        },
        shape: { borderRadius: 10 },
        components: {
          MuiButton: {
            styleOverrides: {
              root: { textTransform: "none", fontWeight: 600, borderRadius: 8 },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: { borderRadius: 12, boxShadow: "0 2px 12px rgba(25,118,210,0.08)" },
            },
          },
          MuiChip: {
            styleOverrides: { root: { fontWeight: 600 } },
          },
        },
      }),
    [mode]
  )

  return (
    <ThemeContext.Provider value={{ mode, toggleMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </ThemeContext.Provider>
  )
}
