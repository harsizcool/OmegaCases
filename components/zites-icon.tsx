import { Sparkles } from "lucide-react"

export const ZITES_COLOR_CLASS = "text-amber-500"
export const ZITES_COLOR_HEX = "#f59e0b"

/** OmegaZites brand icon: orange sparkles, kept in one place so every usage stays consistent. */
export function ZitesIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return <Sparkles size={size} className={`${ZITES_COLOR_CLASS} ${className}`} />
}
