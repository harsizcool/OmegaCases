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

  const supabase = await createClient()
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("username", username.trim())
    .single()

  if (!user) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 })
  }

  // Issue a fresh session token on every login
  const sessionToken = generateSessionToken()
  await supabase
    .from("users")
    .update({ session_token: sessionToken })
    .eq("id", user.id)

  const { password: _pw, session_token: _st, ...safeUser } = user
  return NextResponse.json({ user: safeUser, session_token: sessionToken })
}
