"use client"
// v7 — correct emotion SSR with useServerInsertedHTML
import * as React from "react"
import { useServerInsertedHTML } from "next/navigation"
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material"
import createCache from "@emotion/cache"
import { CacheProvider } from "@emotion/react"
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

function buildTheme(mode: "light" | "dark") {
  return createTheme({
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
      fontFamily: '"Roboto","Helvetica","Arial",sans-serif',
      h1: { fontWeight: 700 }, h2: { fontWeight: 700 },
      h3: { fontWeight: 600 }, h4: { fontWeight: 600 },
      h5: { fontWeight: 600 }, h6: { fontWeight: 600 },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiButton: {
        styleOverrides: { root: { textTransform: "none", fontWeight: 600, borderRadius: 8 } },
      },
      MuiCard: {
        styleOverrides: { root: { borderRadius: 12, boxShadow: "0 2px 12px rgba(25,118,210,0.08)" } },
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
      MuiCssBaseline: {
        styleOverrides: (theme: any) => ({
          body: {
            backgroundColor: theme.palette.background.default,
            color: theme.palette.text.primary,
            transition: "background-color 0.2s, color 0.2s",
          },
        }),
      },
    },
  })
}

// Handles emotion SSR style injection correctly in Next.js App Router
function EmotionCacheProvider({ children }: { children: React.ReactNode }) {
  const [{ cache, flush }] = React.useState(() => {
    const cache = createCache({ key: "mui" })
    cache.compat = true
    const prevInsert = cache.insert.bind(cache)
    let inserted: { name: string; isGlobal: boolean }[] = []
    cache.insert = (...args) => {
      const serialized = args[1]
      if (cache.inserted[serialized.name] === undefined) {
        inserted.push({ name: serialized.name, isGlobal: !args[0] })
      }
      return prevInsert(...args)
    }
    function flush() {
      const prevInserted = inserted
      inserted = []
      return prevInserted
    }
    return { cache, flush }
  })

  useServerInsertedHTML(() => {
    const inserted = flush()
    if (!inserted.length) return null
    let styles = ""
    let dataEmotionAttribute = cache.key
    const globals: { name: string; style: string }[] = []
    for (const { name, isGlobal } of inserted) {
      const style = cache.inserted[name]
      if (typeof style !== "boolean") {
        if (isGlobal) {
          globals.push({ name, style })
        } else {
          styles += style
          dataEmotionAttribute += ` ${name}`
        }
      }
    }
    return (
      <React.Fragment>
        {globals.map(({ name, style }) => (
          <style
            key={name}
            data-emotion={`${cache.key}-global ${name}`}
            dangerouslySetInnerHTML={{ __html: style }}
          />
        ))}
        {styles && (
          <style
            data-emotion={dataEmotionAttribute}
            dangerouslySetInnerHTML={{ __html: styles }}
          />
        )}
      </React.Fragment>
    )
  })

  return <CacheProvider value={cache}>{children}</CacheProvider>
}

// Inner component reads next-themes and builds the MUI theme
function ThemeInner({ children }: { children: React.ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => { setMounted(true) }, [])

  // Always light on first render to match server HTML
  const mode: "light" | "dark" = mounted && resolvedTheme === "dark" ? "dark" : "light"
  const theme = React.useMemo(() => buildTheme(mode), [mode])

  const toggleMode = React.useCallback(() => {
    setTheme(mode === "dark" ? "light" : "dark")
  }, [mode, setTheme])

  return (
    <ThemeContext.Provider value={{ mode, toggleMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </ThemeContext.Provider>
  )
}

export default function MuiProvider({ children }: { children: React.ReactNode }) {
  return (
    <EmotionCacheProvider>
      <ThemeInner>{children}</ThemeInner>
    </EmotionCacheProvider>
  )
}
