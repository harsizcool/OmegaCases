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

// Use service role key for server-side API routes — bypasses RLS cookie issues
export function createClient() {
  return createSupabaseClient(
    PUBLIC_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    INTERNAL_URL ? { global: { fetch: internalFetch } } : undefined
  )
}
