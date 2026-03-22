import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"

function generateSessionToken(): string {
  return randomBytes(48).toString("hex")
}

export async function POST(request: Request) {
  const { username, password } = await request.json()

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 })
  }

  if (username.trim().length < 3 || username.trim().length > 20) {
    return NextResponse.json({ error: "Username must be 3–20 characters" }, { status: 400 })
  }

  const supabase = await createClient()

  // Check username uniqueness
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("username", username.trim())
    .single()

  if (existing) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)
  const sessionToken = generateSessionToken()

  const { data: newUser, error } = await supabase
    .from("users")
    .insert({
      username: username.trim(),
      password: hashed,
      balance: 0,
      admin: false,
      cases: 0,
      session_token: sessionToken,
    })
    .select("*")
    .single()

  if (error) {
    console.error("[register] Supabase insert error:", error.message)
    return NextResponse.json({ error: error.message || "Registration failed" }, { status: 500 })
  }

  const { password: _pw, session_token: _st, ...safeUser } = newUser
  return NextResponse.json({ user: safeUser, session_token: sessionToken })
}
