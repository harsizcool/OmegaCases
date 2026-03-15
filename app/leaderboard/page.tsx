"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Container, Box, Typography, Card, CardContent, Avatar,
  CircularProgress, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper,
} from "@mui/material"
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents"

interface LeaderboardEntry {
  id: string
  username: string
  profile_picture: string | null
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

  const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32"]

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <EmojiEventsIcon sx={{ fontSize: 56, color: "#FFD700" }} />
        <Typography variant="h4" fontWeight={700}>
          Leaderboard
        </Typography>
        <Typography color="text.secondary">Top 10 richest inventories by RAP</Typography>
      </Box>

      {loading ? (
        <Box textAlign="center"><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid #e3f2fd" }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "#e3f2fd" }}>
                <TableCell align="center" sx={{ fontWeight: 700, width: 60 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Player</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Inventory RAP</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Items</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry, i) => (
                <TableRow
                  key={entry.id}
                  onClick={() => router.push(`/user/${entry.username}`)}
                  sx={{
                    textDecoration: "none",
                    cursor: "pointer",
                    "&:hover": { bgcolor: "#f0f7ff" },
                    bgcolor: i < 3 ? `${medalColors[i]}11` : "inherit",
                  }}
                >
                  <TableCell align="center">
                    {i < 3 ? (
                      <Typography fontSize={22}>
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                      </Typography>
                    ) : (
                      <Typography fontWeight={700} color="text.secondary">{i + 1}</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      {entry.profile_picture ? (
                        <Avatar src={entry.profile_picture} sx={{ width: 36, height: 36 }} />
                      ) : (
                        <Avatar sx={{ width: 36, height: 36, bgcolor: "primary.main", fontSize: 14 }}>
                          {entry.username[0].toUpperCase()}
                        </Avatar>
                      )}
                      <Typography fontWeight={600}>{entry.username}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography fontWeight={700} color="primary.main">
                      ${entry.rap.toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Chip label={entry.itemCount} size="small" color="primary" variant="outlined" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  )
}
