"use client"

import { useState, useEffect } from "react"
import { Box, Typography, IconButton } from "@mui/material"
import CloseIcon from "@mui/icons-material/Close"

export default function DiscountBanner() {
  const [text, setText] = useState("")
  const [color, setColor] = useState("#1565c0")
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch("/api/banner")
      .then((r) => r.json())
      .then((d) => {
        if (d?.text) { setText(d.text); setColor(d.color || "#1565c0") }
      })
      .catch(() => {})
  }, [])

  if (!text || dismissed) return null

  return (
    <Box
      sx={{
        bgcolor: color,
        color: "#fff",
        py: 0.75,
        px: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        position: "relative",
        zIndex: 1200,
      }}
    >
      <Typography
        variant="body2"
        fontWeight={700}
        sx={{ letterSpacing: 0.5, textAlign: "center", fontSize: { xs: "0.7rem", sm: "0.85rem" } }}
      >
        {text}
      </Typography>
      <IconButton
        size="small"
        onClick={() => setDismissed(true)}
        sx={{ color: "#fff", position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", opacity: 0.8, "&:hover": { opacity: 1 } }}
        aria-label="Dismiss banner"
      >
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  )
}
