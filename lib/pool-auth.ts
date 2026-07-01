import { randomBytes, createHash } from "crypto"

/** Generates a fresh pool API key (plaintext, shown once to the operator). */
export function generateApiKey(): string {
  return randomBytes(32).toString("hex")
}

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex")
}

export function apiKeyPrefix(apiKey: string): string {
  return apiKey.slice(0, 8)
}

/**
 * Looks up the pool matching the Authorization: Bearer <api_key> header on a request.
 * Returns null if the header is missing, malformed, or doesn't match any pool.
 */
export async function authenticatePool(db: any, req: Request, poolId: string) {
  const authHeader = req.headers.get("authorization") ?? ""
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) return null

  const apiKey = match[1].trim()
  const { data: pool } = await db.from("mining_pools").select("*").eq("id", poolId).single()
  if (!pool) return null
  if (pool.api_key_hash !== hashApiKey(apiKey)) return null

  return pool
}
