import { createClient } from "@/lib/supabase/server"

/**
 * Confirms a request came from a signed-in admin.
 *
 * The session token is required as well as the id. Checking only that a supplied
 * user_id belongs to an admin — which the older admin routes do — is enough when
 * the worst outcome is an edited label, but not for anything that creates
 * balance or destroys player data: a user id is not a secret, and anyone who saw
 * an admin's would be able to use it. The token is.
 */
export async function requireAdmin(actor_id: unknown, session_token: unknown) {
  if (
    typeof actor_id !== "string" ||
    typeof session_token !== "string" ||
    !actor_id ||
    !session_token
  ) {
    return { error: "Not signed in", status: 401 as const }
  }

  const supabase = await createClient()
  const { data: actor } = await supabase
    .from("users")
    .select("id, username, admin, session_token")
    .eq("id", actor_id)
    .single()

  if (!actor || actor.session_token !== session_token) {
    return { error: "Not signed in", status: 401 as const }
  }
  if (!actor.admin) {
    return { error: "Unauthorized", status: 403 as const }
  }
  return { actor, supabase }
}
