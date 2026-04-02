import { Crown } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface Props {
  size?: number
}

export default function PlusBadge({ size = 16 }: Props) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Crown
            size={size}
            className="shrink-0 align-middle"
            style={{ color: "#f59e0b", filter: "drop-shadow(0 0 3px #f59e0b88)" }}
          />
        </TooltipTrigger>
        <TooltipContent>OmegaCases Plus member</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
