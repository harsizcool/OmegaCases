import { NextResponse } from "next/server"
import { getBannerSettings } from "@/lib/game-settings"

export const revalidate = 60

export async function GET() {
  const banner = await getBannerSettings()
  return NextResponse.json(banner ?? { text: "", color: "#1565c0" })
}
