import { NextResponse } from "next/server"
import { getCasePrices } from "@/lib/game-settings"

export async function GET() {
  const prices = await getCasePrices()
  return NextResponse.json(prices)
}
