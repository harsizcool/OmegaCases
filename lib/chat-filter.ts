/**
 * Public chat word filter.
 * Each matched character is replaced with "#" (Roblox-style).
 * Add more words to BLOCKED_WORDS — the user promised a full list later.
 * Words are matched case-insensitively and catch substrings
 * (e.g. "fuck" catches "fucking", "fucker", etc.).
 */

export const BLOCKED_WORDS: string[] = [
  // ── core ──────────────────────────────────────────────────────────────────
  "fuck", "fucking", "fucker", "fucked", "fucks", "mfucker",
  "motherfucker", "motherfucking",
  "shit", "shitting", "shitter", "shitted", "shits",
  "bitch", "bitches", "bitching", "bitchy",
  "cunt", "cunts",
  "cock", "cocks",
  "dick", "dicks",
  "pussy", "pussies",
  "asshole", "assholes", "arsehole", "arseholes",
  "ass", "arse",
  "bastard", "bastards",
  "whore", "whores",
  "slut", "sluts",
  "prick", "pricks",
  "faggot", "faggots", "fag", "fags",
  // ── slurs ─────────────────────────────────────────────────────────────────
  "nigger", "niggers", "nigga", "niggas",
  "chink", "chinks",
  "spic", "spics",
  "kike", "kikes",
  "wetback",
  "tranny", "trannies",
  // ── misc ──────────────────────────────────────────────────────────────────
  "retard", "retarded", "retards",
]

// Sort by length descending so longer phrases match before shorter substrings
// (e.g. "motherfucker" before "fucker" before "fuck")
const SORTED = [...BLOCKED_WORDS].sort((a, b) => b.length - a.length)

// Build a single regex: alternation of all words, case-insensitive, global
const FILTER_RE = new RegExp(
  SORTED.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "gi"
)

/**
 * Replace each character of every matched word with "#".
 * "You fucking idiot" → "You ####### idiot"
 */
export function filterChat(content: string): string {
  return content.replace(FILTER_RE, (match) => "#".repeat(match.length))
}
