import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * Validates that a user_id query param exists and belongs to a Plus member.
 * Returns { userId } on success, or a NextResponse error to return immediately.
 */
export async function requirePlusUser(userId: string | null): Promise<
  { userId: string; error?: never } | { userId?: never; error: NextResponse }
> {
  if (!userId) {
    return {
      error: NextResponse.json(
        { error: "Missing user_id. This endpoint requires an OmegaCases Plus user ID." },
        { status: 401 }
      ),
    }
  }

  const db = createClient()
  const { data: user, error } = await db
    .from("users")
    .select("id, plus")
    .eq("id", userId)
    .single()

  if (error || !user) {
    return {
      error: NextResponse.json(
        { error: "Invalid user_id — user not found." },
        { status: 401 }
      ),
    }
  }

  if (!user.plus) {
    return {
      error: NextResponse.json(
        { error: "This endpoint is restricted to OmegaCases Plus members." },
        { status: 403 }
      ),
    }
  }

  return { userId: user.id }
}
