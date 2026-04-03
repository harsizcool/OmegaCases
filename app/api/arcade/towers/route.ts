import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  generateServerSeed, hashServerSeed,
  towersLayout, towersMultiplier,
} from "@/lib/arcade-fair"

const DIFFICULTY_CONFIGS = {
  easy:   { cols: 3, bombs: 1 },
  normal: { cols: 2, bombs: 1 },
  hard:   { cols: 3, bombs: 2 },
} as const

async function getSettings(db: any) {
  const keys = [
    "arcade_enabled", "arcade_house_edge", "arcade_min_bet",
    "arcade_max_bet", "arcade_towers_num_rows",
  ]
  const { data } = await db.from("game_settings").select("key,value").in("key", keys)
  const s: Record<string, any> = {}
  for (const row of data ?? []) s[row.key] = row.value
  return {
    enabled:   s.arcade_enabled   ?? true,
    houseEdge: Number(s.arcade_house_edge  ?? 0.01),
    minBet:    Number(s.arcade_min_bet     ?? 0.01),
    maxBet:    Number(s.arcade_max_bet     ?? 100),
    numRows:   Number(s.arcade_towers_num_rows ?? 8),
  }
}

export async function POST(req: Request) {
  const db = await createClient()
  const body = await req.json().catch(() => ({}))
  const { action, user_id } = body
  if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 })

  const settings = await getSettings(db)
  if (!settings.enabled) return NextResponse.json({ error: "Arcade is disabled" }, { status: 503 })

  const { data: user } = await db.from("users").select("id,balance").eq("id", user_id).single()
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  // ── NEW GAME ────────────────────────────────────────────────────────────────
  if (action === "new") {
    const { bet, difficulty = "easy", client_seed = "omegacases" } = body
    const numBet = Number(bet)
    if (!numBet || numBet < settings.minBet || numBet > settings.maxBet)
      return NextResponse.json({ error: `Bet must be $${settings.minBet}–$${settings.maxBet}` }, { status: 400 })
    if (!DIFFICULTY_CONFIGS[difficulty as keyof typeof DIFFICULTY_CONFIGS])
      return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 })
    if (user.balance < numBet)
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })

    // forfeit any existing active towers game
    await db.from("arcade_games")
      .update({ status: "lost", payout: 0, completed_at: new Date().toISOString() })
      .eq("user_id", user_id).eq("game_type", "towers").eq("status", "active")

    const config = DIFFICULTY_CONFIGS[difficulty as keyof typeof DIFFICULTY_CONFIGS]
    const serverSeed = generateServerSeed()
    const bombColumns = towersLayout(serverSeed, client_seed, 0, settings.numRows, config.cols, config.bombs)

    const state = {
      difficulty,
      num_rows: settings.numRows,
      num_cols: config.cols,
      num_bombs: config.bombs,
      current_row: 0,
      bomb_columns: bombColumns, // server-only, stripped before sending
      picks: [] as number[],
    }

    await db.from("users").update({ balance: user.balance - numBet }).eq("id", user_id)
    const { data: game } = await db.from("arcade_games").insert({
      user_id, game_type: "towers", bet: numBet,
      server_seed: serverSeed,
      server_seed_hash: hashServerSeed(serverSeed),
      client_seed, nonce: 0, state, status: "active",
    }).select("id,server_seed_hash").single()

    const { bomb_columns: _hidden, ...publicState } = state
    return NextResponse.json({
      game_id: game.id,
      state: publicState,
      server_seed_hash: game.server_seed_hash,
      multipliers: Array.from({ length: settings.numRows }, (_, i) =>
        towersMultiplier(i + 1, config.cols, config.bombs, settings.houseEdge)
      ),
    })
  }

  // ── STEP ────────────────────────────────────────────────────────────────────
  if (action === "step") {
    const { game_id, column } = body
    if (game_id === undefined || column === undefined)
      return NextResponse.json({ error: "game_id and column required" }, { status: 400 })

    const { data: game } = await db.from("arcade_games")
      .select().eq("id", game_id).eq("user_id", user_id)
      .eq("game_type", "towers").eq("status", "active").single()
    if (!game) return NextResponse.json({ error: "Active game not found" }, { status: 404 })

    const st = game.state as any
    const { current_row, num_cols, num_bombs, bomb_columns, picks, num_rows } = st
    if (column < 0 || column >= num_cols)
      return NextResponse.json({ error: "Invalid column" }, { status: 400 })

    const rowBombs: number[] = bomb_columns[current_row]
    const hitBomb = rowBombs.includes(Number(column))
    const newPicks = [...picks, Number(column)]
    const newRow = current_row + 1

    if (hitBomb) {
      await db.from("arcade_games").update({
        state: { ...st, picks: newPicks, current_row: newRow },
        status: "lost", payout: 0,
        completed_at: new Date().toISOString(),
      }).eq("id", game_id)
      return NextResponse.json({
        hit_bomb: true, row: current_row,
        bomb_columns_row: rowBombs,
        bomb_columns_all: bomb_columns,
        server_seed: game.server_seed,
        payout: 0, status: "lost",
      })
    }

    const multiplier = towersMultiplier(newRow, num_cols, num_bombs, settings.houseEdge)
    const payout = game.bet * multiplier
    const finished = newRow >= num_rows
    const newState = { ...st, picks: newPicks, current_row: newRow }

    if (finished) {
      await db.from("users").update({ balance: user.balance + payout }).eq("id", user_id)
      await db.from("arcade_games").update({
        state: newState, status: "won", payout,
        completed_at: new Date().toISOString(),
      }).eq("id", game_id)
      return NextResponse.json({
        hit_bomb: false, row: current_row,
        bomb_columns_row: rowBombs,
        bomb_columns_all: bomb_columns,
        server_seed: game.server_seed,
        multiplier, payout, status: "won", current_row: newRow,
      })
    }

    await db.from("arcade_games").update({ state: newState }).eq("id", game_id)
    return NextResponse.json({
      hit_bomb: false, row: current_row,
      bomb_columns_row: rowBombs,
      multiplier, payout,
      status: "active", current_row: newRow,
    })
  }

  // ── CASHOUT ─────────────────────────────────────────────────────────────────
  if (action === "cashout") {
    const { game_id } = body
    const { data: game } = await db.from("arcade_games")
      .select().eq("id", game_id).eq("user_id", user_id)
      .eq("game_type", "towers").eq("status", "active").single()
    if (!game) return NextResponse.json({ error: "Active game not found" }, { status: 404 })

    const st = game.state as any
    if (st.current_row === 0)
      return NextResponse.json({ error: "Clear at least one row before cashing out" }, { status: 400 })

    const multiplier = towersMultiplier(st.current_row, st.num_cols, st.num_bombs, settings.houseEdge)
    const payout = game.bet * multiplier

    await db.from("users").update({ balance: user.balance + payout }).eq("id", user_id)
    await db.from("arcade_games").update({
      state: { ...st, finished: true }, status: "cashed_out", payout,
      completed_at: new Date().toISOString(),
    }).eq("id", game_id)

    return NextResponse.json({
      multiplier, payout,
      bomb_columns_all: st.bomb_columns,
      server_seed: game.server_seed,
      status: "cashed_out",
    })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
