import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import bcrypt from "bcryptjs"

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

  const { password: _pw, ...safeUser } = user
  return NextResponse.json({ user: safeUser })
}
