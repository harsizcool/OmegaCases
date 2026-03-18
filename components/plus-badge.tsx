import { Tooltip } from "@mui/material"
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium"

interface Props {
  size?: number
}

export default function PlusBadge({ size = 16 }: Props) {
  return (
    <Tooltip title="OmegaCases Plus member" placement="top" arrow>
      <WorkspacePremiumIcon
        sx={{
          fontSize: size,
          color: "#f59e0b",
          filter: "drop-shadow(0 0 3px #f59e0b88)",
          flexShrink: 0,
          verticalAlign: "middle",
        }}
      />
    </Tooltip>
  )
}
