"use client"

import { Clock } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
    <div
      onClick={onClick}
      className={`flex flex-col items-center gap-1 ${onClick ? "cursor-pointer hover:-translate-y-0.5 transition-transform duration-150" : ""}`}
    >
      <div className="relative">
        <div
          style={{ width: dims, height: dims, borderColor: color, boxShadow: glow }}
          className="rounded-lg overflow-hidden border-2 bg-blue-50 dark:bg-slate-800 flex items-center justify-center"
        >
          <img
            src={item.image_url}
            alt={item.name}
            style={{ width: "90%", height: "90%" }}
            className="object-contain"
          />
        </div>
        {item.limited_time && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="absolute top-1 right-1 bg-black/60 rounded-full w-5 h-5 flex items-center justify-center">
                  <Clock size={11} className="text-yellow-300" />
                </div>
              </TooltipTrigger>
              <TooltipContent>Limited time — not available in cases</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <span
        className="text-white text-[0.65rem] font-semibold px-1.5 py-0.5 rounded-full"
        style={{ backgroundColor: color }}
      >
        {item.rarity}
      </span>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="text-xs font-semibold text-center leading-tight overflow-hidden text-ellipsis whitespace-nowrap block"
              style={{ maxWidth: dims }}
            >
              {item.name}
            </span>
          </TooltipTrigger>
          <TooltipContent>{item.name}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {showPrice && (
        <span className="text-xs font-bold text-primary">
          ${Number(item.market_price).toFixed(2)}
        </span>
      )}
    </div>
  )
}
