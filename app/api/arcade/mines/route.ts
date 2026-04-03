import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  generateServerSeed, hashServerSeed,
  minesLayout, minesMultiplier,
} from "@/lib/arcade-fair"

const GRID_SIZE = 25

async function getSettings(db: any) {
  const { data } = await db.from("game_settings").select("key,value")
    .in("key", ["arcade_enabled", "arcade_house_edge", "arcade_min_bet", "arcade_max_bet"])
  const s: Record<string, any> = {}
  for (const row of data ?? []) s[row.key] = row.value
  return {
    enabled:   s.arcade_enabled   ?? true,
    houseEdge: Number(s.arcade_house_edge ?? 0.01),
    minBet:    Number(s.arcade_min_bet    ?? 0.01),
    maxBet:    Number(s.arcade_max_bet    ?? 100),
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
    const { bet, num_mines = 3, client_seed = "omegacases" } = body
    const numBet = Number(bet)
    const numMines = Math.max(1, Math.min(24, Number(num_mines)))
    if (!numBet || numBet < settings.minBet || numBet > settings.maxBet)
      return NextResponse.json({ error: `Bet must be $${settings.minBet}–$${settings.maxBet}` }, { status: 400 })
    if (user.balance < numBet)
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })

    // forfeit existing active mines game
    await db.from("arcade_games")
      .update({ status: "lost", payout: 0, completed_at: new Date().toISOString() })
      .eq("user_id", user_id).eq("game_type", "mines").eq("status", "active")

    const serverSeed = generateServerSeed()
    const minePositions = minesLayout(serverSeed, client_seed, 0, GRID_SIZE, numMines)

    const state = {
      num_mines: numMines,
      grid_size: GRID_SIZE,
      mine_positions: minePositions, // server-only
      revealed: [] as number[],
    }

    await db.from("users").update({ balance: user.balance - numBet }).eq("id", user_id)
    const { data: game } = await db.from("arcade_games").insert({
      user_id, game_type: "mines", bet: numBet,
      server_seed: serverSeed,
      server_seed_hash: hashServerSeed(serverSeed),
      client_seed, nonce: 0, state, status: "active",
    }).select("id,server_seed_hash").single()

    return NextResponse.json({
      game_id: game.id,
      server_seed_hash: game.server_seed_hash,
      num_mines: numMines,
      grid_size: GRID_SIZE,
      revealed: [],
      multiplier: 1,
      payout: numBet,
    })
  }

  // ── REVEAL ──────────────────────────────────────────────────────────────────
  if (action === "reveal") {
    const { game_id, tile } = body
    if (game_id === undefined || tile === undefined)
      return NextResponse.json({ error: "game_id and tile required" }, { status: 400 })

    const { data: game } = await db.from("arcade_games")
      .select().eq("id", game_id).eq("user_id", user_id)
      .eq("game_type", "mines").eq("status", "active").single()
    if (!game) return NextResponse.json({ error: "Active game not found" }, { status: 404 })

    const st = game.state as any
    const { mine_positions, revealed, num_mines, grid_size } = st
    const tileIdx = Number(tile)

    if (tileIdx < 0 || tileIdx >= grid_size)
      return NextResponse.json({ error: "Invalid tile" }, { status: 400 })
    if (revealed.includes(tileIdx))
      return NextResponse.json({ error: "Tile already revealed" }, { status: 400 })

    const hitMine = mine_positions.includes(tileIdx)

    if (hitMine) {
      await db.from("arcade_games").update({
        state: { ...st, revealed: [...revealed, tileIdx] },
        status: "lost", payout: 0,
        completed_at: new Date().toISOString(),
      }).eq("id", game_id)
      return NextResponse.json({
        hit_mine: true, tile: tileIdx,
        mine_positions,
        server_seed: game.server_seed,
        payout: 0, status: "lost",
      })
    }

    const newRevealed = [...revealed, tileIdx]
    const safeCount = grid_size - num_mines
    const multiplier = minesMultiplier(newRevealed.length, num_mines, grid_size, settings.houseEdge)
    const payout = game.bet * multiplier
    const allSafeRevealed = newRevealed.length >= safeCount

    const newState = { ...st, revealed: newRevealed }
    if (allSafeRevealed) {
      await db.from("users").update({ balance: user.balance + payout }).eq("id", user_id)
      await db.from("arcade_games").update({
        state: newState, status: "won", payout,
        completed_at: new Date().toISOString(),
      }).eq("id", game_id)
      return NextResponse.json({
        hit_mine: false, tile: tileIdx,
        revealed: newRevealed,
        mine_positions,
        server_seed: game.server_seed,
        multiplier, payout, status: "won",
      })
    }

    await db.from("arcade_games").update({ state: newState }).eq("id", game_id)
    return NextResponse.json({
      hit_mine: false, tile: tileIdx,
      revealed: newRevealed,
      multiplier, payout,
      status: "active",
    })
  }

  // ── CASHOUT ─────────────────────────────────────────────────────────────────
  if (action === "cashout") {
    const { game_id } = body
    const { data: game } = await db.from("arcade_games")
      .select().eq("id", game_id).eq("user_id", user_id)
      .eq("game_type", "mines").eq("status", "active").single()
    if (!game) return NextResponse.json({ error: "Active game not found" }, { status: 404 })

    const st = game.state as any
    if (st.revealed.length === 0)
      return NextResponse.json({ error: "Reveal at least one tile before cashing out" }, { status: 400 })

    const multiplier = minesMultiplier(st.revealed.length, st.num_mines, st.grid_size, settings.houseEdge)
    const payout = game.bet * multiplier

    await db.from("users").update({ balance: user.balance + payout }).eq("id", user_id)
    await db.from("arcade_games").update({
      state: st, status: "cashed_out", payout,
      completed_at: new Date().toISOString(),
    }).eq("id", game_id)

    return NextResponse.json({
      multiplier, payout,
      mine_positions: st.mine_positions,
      server_seed: game.server_seed,
      status: "cashed_out",
    })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
