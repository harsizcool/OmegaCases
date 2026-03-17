"use client"
// cache-bust: single-export-v3
import { Box, Chip, Tooltip, Typography } from "@mui/material"
import AccessTimeIcon from "@mui/icons-material/AccessTime"
import type { Item, Rarity } from "@/lib/types"
import { RARITY_COLORS, RARITY_GLOW } from "@/lib/types"

interface ItemCardProps {
  item: Item
  size?: "sm" | "md" | "lg"
  showPrice?: boolean
  onClick?: () => void
}

export default function ItemCard({ item, size = "md", showPrice = false, onClick }: ItemCardProps) {
  const dims = size === "sm" ? 80 : size === "lg" ? 180 : 120
  const color = RARITY_COLORS[item.rarity as Rarity] ?? "#9e9e9e"
  const glow = RARITY_GLOW?.[item.rarity as Rarity] ?? "none"

  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0.5,
        cursor: onClick ? "pointer" : "default",
        "&:hover": onClick ? { transform: "translateY(-2px)", transition: "transform 0.15s" } : {},
      }}
    >
      <Box sx={{ position: "relative" }}>
        <Box
          sx={{
            width: dims,
            height: dims,
            borderRadius: 2,
            overflow: "hidden",
            border: `2px solid ${color}`,
            boxShadow: glow,
            bgcolor: "#f0f7ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box
            component="img"
            src={item.image_url}
            alt={item.name}
            sx={{ width: "90%", height: "90%", objectFit: "contain" }}
          />
        </Box>
        {item.limited_time && (
          <Tooltip title="Limited time — not available in cases" placement="top" arrow>
            <Box
              sx={{
                position: "absolute",
                top: 4,
                right: 4,
                bgcolor: "rgba(0,0,0,0.6)",
                borderRadius: "50%",
                width: 20,
                height: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AccessTimeIcon sx={{ fontSize: 13, color: "#ffd54f" }} />
            </Box>
          </Tooltip>
        )}
      </Box>

      <Chip
        label={item.rarity}
        size="small"
        sx={{
          bgcolor: color,
          color: "#fff",
          fontSize: "0.65rem",
          height: 18,
          "& .MuiChip-label": { px: 0.8 },
        }}
      />

      <Tooltip title={item.name} placement="top" arrow>
        <Typography
          variant="caption"
          textAlign="center"
          fontWeight={600}
          sx={{
            lineHeight: 1.2,
            maxWidth: dims,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.name}
        </Typography>
      </Tooltip>

      {showPrice && (
        <Typography variant="caption" color="primary.main" fontWeight={700}>
          ${Number(item.market_price).toFixed(2)}
        </Typography>
      )}
    </Box>
  )
}
