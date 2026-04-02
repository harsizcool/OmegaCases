"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trophy } from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import PlusBadge from "@/components/plus-badge"

interface LeaderboardEntry {
  id: string
  username: string
  profile_picture: string | null
  plus: boolean
  rap: number
  itemCount: number
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/leaderboard")
      const data = await res.json()
      setEntries(Array.isArray(data) ? data : [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <Trophy size={48} className="mx-auto mb-2 text-yellow-400" />
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <p className="text-muted-foreground">Top 10 richest inventories by RAP</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-14 text-center font-bold">#</TableHead>
                <TableHead className="font-bold">Player</TableHead>
                <TableHead className="text-right font-bold">Inventory RAP</TableHead>
                <TableHead className="text-right font-bold">Items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry, i) => (
                <TableRow
                  key={entry.id}
                  className="cursor-pointer hover:bg-primary/5 transition-colors"
                  style={{ backgroundColor: i < 3 ? `${["#FFD700", "#C0C0C0", "#CD7F32"][i]}11` : undefined }}
                  onClick={() => router.push(`/user/${entry.username}`)}
                >
                  <TableCell className="text-center">
                    {i < 3 ? (
                      <span className="text-xl">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                    ) : (
                      <span className="font-bold text-muted-foreground">{i + 1}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-9 h-9">
                        {entry.profile_picture && <AvatarImage src={entry.profile_picture} />}
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                          {entry.username[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-semibold">{entry.username}</span>
                      {entry.plus && <PlusBadge />}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-bold text-primary">
                    ${entry.rap.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-semibold border border-primary text-primary rounded-full px-2 py-0.5">
                      {entry.itemCount}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
