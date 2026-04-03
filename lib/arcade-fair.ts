import { createHmac, randomBytes, createHash } from "crypto"

export function generateServerSeed(): string {
  return randomBytes(32).toString("hex")
}

export function hashServerSeed(seed: string): string {
  return createHash("sha256").update(seed).digest("hex")
}

/** Provably fair float in [0,1) — HMAC-SHA256(serverSeed, clientSeed:nonce:cursor) */
export function fairFloat(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  cursor: number,
): number {
  const hmac = createHmac("sha256", serverSeed)
  hmac.update(`${clientSeed}:${nonce}:${cursor}`)
  const hex = hmac.digest("hex")
  return parseInt(hex.slice(0, 8), 16) / 0x100000000
}

/** Per-row bomb column indices for Towers, generated via Fisher-Yates shuffle */
export function towersLayout(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  numRows: number,
  numCols: number,
  numBombs: number,
): number[][] {
  return Array.from({ length: numRows }, (_, row) => {
    const cols = Array.from({ length: numCols }, (_, i) => i)
    for (let i = numCols - 1; i > 0; i--) {
      const f = fairFloat(serverSeed, clientSeed, nonce, row * numCols + (numCols - 1 - i))
      const j = Math.floor(f * (i + 1))
      ;[cols[i], cols[j]] = [cols[j], cols[i]]
    }
    return cols.slice(0, numBombs)
  })
}

/** Mine tile indices for Mines game, generated via Fisher-Yates shuffle */
export function minesLayout(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  gridSize: number,
  numMines: number,
): number[] {
  const tiles = Array.from({ length: gridSize }, (_, i) => i)
  for (let i = gridSize - 1; i > 0; i--) {
    const f = fairFloat(serverSeed, clientSeed, nonce, gridSize - 1 - i)
    const j = Math.floor(f * (i + 1))
    ;[tiles[i], tiles[j]] = [tiles[j], tiles[i]]
  }
  return tiles.slice(0, numMines).sort((a, b) => a - b)
}

/** Towers payout multiplier after clearing `rowsCleared` rows */
export function towersMultiplier(
  rowsCleared: number,
  numCols: number,
  numBombs: number,
  houseEdge: number,
): number {
  if (rowsCleared <= 0) return 1
  const perRow = (numCols / (numCols - numBombs)) * (1 - houseEdge)
  return Math.pow(perRow, rowsCleared)
}

/** Mines payout multiplier after revealing `revealed` safe tiles */
export function minesMultiplier(
  revealed: number,
  numMines: number,
  gridSize: number,
  houseEdge: number,
): number {
  if (revealed <= 0) return 1
  let prob = 1
  for (let i = 0; i < revealed; i++) {
    prob *= (gridSize - numMines - i) / (gridSize - i)
  }
  return (1 - houseEdge) / prob
}
