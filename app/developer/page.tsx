"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import NextLink from "next/link"
import { Plus, Trash2, Copy, CheckCircle, Loader2, Code2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/lib/auth-context"

const ALL_SCOPES = [
  { id: "read_id",       label: "Read User ID" },
  { id: "read_username", label: "Read Username" },
  { id: "read_balance",  label: "Read Balance" },
  { id: "write_balance", label: "Write Balance" },
  { id: "write_cases",   label: "Open Cases on Behalf" },
]

export default function DeveloperPage() {
  const { user } = useAuth()
  const router   = useRouter()

  const [apps,      setApps]      = useState<any[]>([])
  const [selected,  setSelected]  = useState<any>(null)
  const [creating,  setCreating]  = useState(false)
  const [newName,   setNewName]   = useState("")
  const [newScopes, setNewScopes] = useState<string[]>(["read_id", "read_username"])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [copied,    setCopied]    = useState<string | null>(null)

  useEffect(() => {
    if (user === undefined) return
    if (!user) { router.push("/login"); return }
    fetch(`/api/developer/apps?user_id=${user.id}`)
      .then(r => r.json())
      .then(d => { setApps(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [user, router])

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleCreate = async () => {
    if (!newName.trim() || !user) return
    setSaving(true)
    const res = await fetch("/api/developer/apps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id, name: newName.trim(), scopes: newScopes }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.id) {
      setApps(prev => [data, ...prev])
      setSelected(data)
      setCreating(false)
      setNewName("")
      setNewScopes(["read_id", "read_username"])
    }
  }

  const handleDelete = async (app: any) => {
    if (!confirm(`Delete "${app.name}"?`)) return
    await fetch(`/api/developer/apps/${app.id}?user_id=${user?.id}`, { method: "DELETE" })
    setApps(prev => prev.filter(a => a.id !== app.id))
    if (selected?.id === app.id) setSelected(null)
  }

  if (user === undefined || loading) {
    return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-muted-foreground" /></div>
  }

  const authUrl = selected
    ? `https://omegacases.com/oauth/authorize?client_id=${selected.client_id}&redirect_uri=YOUR_REDIRECT_URI&scope=${selected.scopes.join(",")}&state=RANDOM_STATE`
    : ""

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border/60 bg-muted/20 flex flex-col">
        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
          <span className="text-sm font-bold">Applications</span>
          <button
            onClick={() => { setCreating(true); setSelected(null) }}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-1">
          {apps.map(app => (
            <button
              key={app.id}
              onClick={() => { setSelected(app); setCreating(false) }}
              className={`w-full text-left px-4 py-2.5 text-sm truncate transition-colors ${
                selected?.id === app.id
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {app.name}
            </button>
          ))}
          {apps.length === 0 && (
            <p className="px-4 py-3 text-xs text-muted-foreground">No apps yet</p>
          )}
        </nav>

        <div className="p-3 border-t border-border/40">
          <NextLink
            href="/developer/docs"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Code2 size={12} /> API Docs <ExternalLink size={10} className="ml-auto" />
          </NextLink>
        </div>
      </aside>

      {/* Main panel */}
      <main className="flex-1 overflow-y-auto p-8">
        {/* Create form */}
        {creating && (
          <div className="max-w-md">
            <h2 className="text-xl font-bold mb-6">New Application</h2>
            <div className="flex flex-col gap-5">
              <div>
                <label className="text-sm font-semibold block mb-1.5">What is the name of your Application?</label>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCreate()}
                  placeholder="My App"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-sm font-semibold block mb-2">What data will your application use?</label>
                <div className="flex flex-col gap-2.5">
                  {ALL_SCOPES.map(s => (
                    <label key={s.id} className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={newScopes.includes(s.id)}
                        onChange={e =>
                          setNewScopes(prev =>
                            e.target.checked ? [...prev, s.id] : prev.filter(x => x !== s.id)
                          )
                        }
                        className="accent-primary w-3.5 h-3.5"
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 mt-1">
                <Button variant="outline" size="sm" onClick={() => setCreating(false)}>Cancel</Button>
                <Button size="sm" onClick={handleCreate} disabled={saving || !newName.trim()}>
                  {saving && <Loader2 size={13} className="animate-spin mr-1.5" />}
                  Create
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* App detail */}
        {selected && !creating && (
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{selected.name}</h2>
              <button
                onClick={() => handleDelete(selected)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="grid gap-2.5 mb-6">
              {[
                { label: "Client ID",     value: selected.client_id,     key: "cid" },
                { label: "Client Secret", value: selected.client_secret, key: "sec" },
              ].map(({ label, value, key }) => (
                <div key={key} className="flex items-center justify-between gap-4 border border-border rounded-lg px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                    <code className="text-xs font-mono truncate block">{value}</code>
                  </div>
                  <button
                    onClick={() => copy(value, key)}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copied === key ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                </div>
              ))}
            </div>

            <div className="mb-6">
              <p className="text-sm font-semibold mb-2">Granted Scopes</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.scopes.length > 0
                  ? selected.scopes.map((s: string) => (
                      <span key={s} className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded">
                        {s}
                      </span>
                    ))
                  : <span className="text-xs text-muted-foreground">None</span>
                }
              </div>
            </div>

            <Separator className="mb-6" />

            <div>
              <p className="text-sm font-semibold mb-1.5">Authorization URL</p>
              <p className="text-xs text-muted-foreground mb-2">
                Redirect users to this URL to start the OAuth flow:
              </p>
              <div className="relative">
                <pre className="bg-muted border border-border rounded-lg p-3 text-xs font-mono text-foreground whitespace-pre-wrap break-all pr-10">
                  {authUrl}
                </pre>
                <button
                  onClick={() => copy(authUrl, "url")}
                  className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied === "url" ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!selected && !creating && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted-foreground">
            <Code2 size={40} className="opacity-30" />
            <p className="text-sm">Select an app or create a new one</p>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus size={13} className="mr-1.5" /> New Application
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
