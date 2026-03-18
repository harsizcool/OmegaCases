"use client"

import { useState } from "react"
import { Box, Typography, IconButton } from "@mui/material"
import CloseIcon from "@mui/icons-material/Close"

export default function DiscountBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <Box
      sx={{
        bgcolor: "#1565c0",
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
        CASES ARE AT A TEMPORARY DISCOUNT! GET THEM BEFORE IT RESETS
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
