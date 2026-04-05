"use client"

import NextLink from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft } from "lucide-react"

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "oauth",    label: "OAuth" },
  { id: "tokens",   label: "Tokens" },
  { id: "spend",    label: "Spend Balance" },
  { id: "cases",    label: "Open Cases" },
  { id: "public",   label: "Public API" },
]

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-[calc(100vh-56px)]">
      <aside className="w-52 shrink-0 border-r border-border/60 bg-muted/20 flex flex-col">
        <div className="px-4 py-3 border-b border-border/40">
          <NextLink href="/developer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={12} /> Developer
          </NextLink>
        </div>
        <nav className="flex-1 py-2 flex flex-col gap-0.5 px-2">
          <p className="px-2 py-1 text-[0.6rem] font-bold text-muted-foreground uppercase tracking-wider">Docs</p>
          {SECTIONS.map(s => {
            const active = pathname === `/developer/docs/${s.id}`
            return (
              <NextLink
                key={s.id}
                href={`/developer/docs/${s.id}`}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  active
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {s.label}
              </NextLink>
            )
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
