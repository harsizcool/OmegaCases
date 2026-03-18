"use client"

import * as React from "react"
import { createTheme, ThemeProvider, CssBaseline } from "@mui/material"
import { CacheProvider } from "@emotion/react"
import createCache from "@emotion/cache"
import { useServerInsertedHTML } from "next/navigation"
import { AuthProvider } from "@/lib/auth-context"

// ─── Theme Context ─────────────────────────────────────────────────────────────
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

// ─── Emotion Cache ─────────────────────────────────────────────────────────────
function NextAppDirEmotionCacheProvider({ children }: { children: React.ReactNode }) {
  const [{ cache, flush }] = React.useState(() => {
    const emotionCache = createCache({ key: "css" })
    emotionCache.compat = true
    const prevInsert = emotionCache.insert.bind(emotionCache)
    let inserted: string[] = []
    emotionCache.insert = (...args) => {
      const serialized = args[1]
      if (emotionCache.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name)
      }
      return prevInsert(...args)
    }
    const flushFn = () => {
      const prevInserted = inserted
      inserted = []
      return prevInserted
    }
    return { cache: emotionCache, flush: flushFn }
  })

  useServerInsertedHTML(() => {
    const names = flush()
    if (names.length === 0) return null
    let styles = ""
    for (const name of names) {
      styles += cache.inserted[name]
    }
    return (
      <style
        key={cache.key}
        data-emotion={`${cache.key} ${names.join(" ")}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    )
  })

  return <CacheProvider value={cache}>{children}</CacheProvider>
}

// ─── Inner provider (needs useState so must be client) ─────────────────────────
function ThemedApp({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<"light" | "dark">("light")

  // Persist preference in localStorage (Plus users only — but we read it regardless
  // so the toggle works even before the user object loads)
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("omegacases_theme") as "light" | "dark" | null
      if (saved) setMode(saved)
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
            paper: mode === "light" ? "#f8fbff" : "#132233",
          },
          text: {
            primary: mode === "light" ? "#0d1b2a" : "#e8f0fe",
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

// ─── Public export ──────────────────────────────────────────────────────────────
export default function MuiProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAppDirEmotionCacheProvider>
      <ThemedApp>{children}</ThemedApp>
    </NextAppDirEmotionCacheProvider>
  )
}
