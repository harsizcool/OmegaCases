import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

// When the site is self-hosted, the data API is served on the same origin as
// the site itself — which this process cannot call, because that origin resolves
// back to this very server. The setup program sets SUPABASE_INTERNAL_URL to the
// proxy's address inside the container network so server-side requests have
// somewhere real to go. It is unset on a hosted Supabase project, where the
// public URL is already reachable from here.
const INTERNAL_URL = process.env.SUPABASE_INTERNAL_URL?.replace(/\/$/, "")

// Requests are rewritten onto the internal origin, but the client is still
// constructed with the public one, so getPublicUrl() keeps producing links that
// work in a browser.
function internalFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
  if (url.startsWith(PUBLIC_URL)) {
    const rewritten = INTERNAL_URL + url.slice(PUBLIC_URL.length)
    return fetch(typeof input === "string" || input instanceof URL ? rewritten : new Request(rewritten, input), init)
  }
  return fetch(input as RequestInfo, init)
}

// A request from this process to its own address cannot work, and the failure
// that follows is a confusing one — a 404 of HTML where JSON was expected. When
// the setup looks like that, say so once, plainly, in the server log.
//
// It is only a warning, not a refusal: the same address does work from outside a
// container, where the proxy in front of the site answers these paths, which is
// the case when running the site directly with npm.
let warned = false
function warnIfUnreachable() {
  if (warned || INTERNAL_URL) return
  warned = true
  const host = (() => {
    try {
      return new URL(PUBLIC_URL).hostname
    } catch {
      return ""
    }
  })()
  if (host !== "localhost" && host !== "127.0.0.1" && host !== "::1") return

  console.warn(
    `[omegacases] SUPABASE_INTERNAL_URL is not set, so this server will look for ` +
      `its data at ${PUBLIC_URL} — its own address. Inside a container nothing ` +
      `answers there, and signing up, logging in and every other write will fail. ` +
      `Run "setup update" to rebuild with the current settings.`
  )
}

// Use service role key for server-side API routes — bypasses RLS cookie issues
export function createClient() {
  warnIfUnreachable()
  return createSupabaseClient(
    PUBLIC_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    INTERNAL_URL ? { global: { fetch: internalFetch } } : undefined
  )
}
