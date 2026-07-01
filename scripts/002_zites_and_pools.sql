-- OmegaCases: Zites currency, mining rework, and mining pools
-- Idempotent: safe to run multiple times against a live Supabase database.
-- Ordering matters: mining_pools must exist before mining_blocks (FK), so pools/members/
-- heartbeats are created first, then mining_blocks is rebuilt, then the shares audit table.

-- ─────────────────────────────────────────────────────────────────────────────
-- Zites balance on users
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS zites_balance NUMERIC(18,4) NOT NULL DEFAULT 0.0000;

-- ─────────────────────────────────────────────────────────────────────────────
-- Mining pools
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mining_pools (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  host                  TEXT NOT NULL,
  port                  INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
  ip_version            TEXT NOT NULL DEFAULT 'auto' CHECK (ip_version IN ('ipv4','ipv6','auto')),
  description           TEXT,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','testing','active','offline','banned')),
  api_key_hash          TEXT NOT NULL,
  api_key_prefix        TEXT NOT NULL,
  last_heartbeat_at     TIMESTAMPTZ,
  uptime_pct_24h        NUMERIC(5,2) DEFAULT 0,
  uptime_pct_7d         NUMERIC(5,2) DEFAULT 0,
  total_shares_reported BIGINT NOT NULL DEFAULT 0,
  blocks_found          INTEGER NOT NULL DEFAULT 0,
  member_count          INTEGER NOT NULL DEFAULT 0,
  banned_reason         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mining_pools_status ON public.mining_pools(status);
CREATE INDEX IF NOT EXISTS idx_mining_pools_owner ON public.mining_pools(owner_id);

ALTER TABLE public.mining_pools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mining_pools_select_all" ON public.mining_pools;
CREATE POLICY "mining_pools_select_all" ON public.mining_pools FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Pool membership
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mining_pool_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id   UUID NOT NULL REFERENCES public.mining_pools(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pool_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_pool_members_user ON public.mining_pool_members(user_id);

ALTER TABLE public.mining_pool_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pool_members_select_all" ON public.mining_pool_members;
CREATE POLICY "pool_members_select_all" ON public.mining_pool_members FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Pool heartbeat / liveness log (rolling, feeds uptime %)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mining_pool_heartbeats (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id    UUID NOT NULL REFERENCES public.mining_pools(id) ON DELETE CASCADE,
  ok         BOOLEAN NOT NULL,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pool_heartbeats_pool_time ON public.mining_pool_heartbeats(pool_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Mining blocks (rebuilt fresh; table was already emptied before this migration)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.mining_blocks;
CREATE TABLE public.mining_blocks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  height        INTEGER NOT NULL UNIQUE,
  hash          TEXT NOT NULL,
  nonce         BIGINT NOT NULL,
  miner_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  previous_hash TEXT NOT NULL,
  target        TEXT NOT NULL,
  reward_zites  NUMERIC(18,4) NOT NULL,
  pool_id       UUID NULL REFERENCES public.mining_pools(id) ON DELETE SET NULL,
  found_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mining_blocks_pool ON public.mining_blocks(pool_id);
CREATE INDEX IF NOT EXISTS idx_mining_blocks_found_at ON public.mining_blocks(found_at DESC);

ALTER TABLE public.mining_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mining_blocks_select_all" ON public.mining_blocks;
CREATE POLICY "mining_blocks_select_all" ON public.mining_blocks FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Per-block share/reward split audit trail (pool blocks only)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mining_pool_shares (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id       UUID NOT NULL REFERENCES public.mining_blocks(id) ON DELETE CASCADE,
  pool_id        UUID NOT NULL REFERENCES public.mining_pools(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  shares         BIGINT NOT NULL CHECK (shares >= 0),
  zites_credited NUMERIC(18,4) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pool_shares_block ON public.mining_pool_shares(block_id);
CREATE INDEX IF NOT EXISTS idx_pool_shares_user ON public.mining_pool_shares(user_id);

ALTER TABLE public.mining_pool_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pool_shares_select_all" ON public.mining_pool_shares;
CREATE POLICY "pool_shares_select_all" ON public.mining_pool_shares FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Reset mining chain state for the new 10-block difficulty interval
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.game_settings (key, value) VALUES
  ('mining_target', '"00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"'),
  ('mining_height', '0'),
  ('mining_last_adj_height', '0')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ─────────────────────────────────────────────────────────────────────────────
-- Zites order book
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.zites_orders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  side               TEXT NOT NULL CHECK (side IN ('buy','sell')),
  order_type         TEXT NOT NULL CHECK (order_type IN ('market','limit')),
  price              NUMERIC(12,4),
  quantity           NUMERIC(18,4) NOT NULL CHECK (quantity > 0),
  remaining_quantity NUMERIC(18,4) NOT NULL CHECK (remaining_quantity >= 0),
  status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','partial','filled','cancelled')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_zites_orders_buy_book
  ON public.zites_orders (price DESC, created_at ASC) WHERE side = 'buy' AND status IN ('open','partial');
CREATE INDEX IF NOT EXISTS idx_zites_orders_sell_book
  ON public.zites_orders (price ASC, created_at ASC) WHERE side = 'sell' AND status IN ('open','partial');
CREATE INDEX IF NOT EXISTS idx_zites_orders_user ON public.zites_orders(user_id);

ALTER TABLE public.zites_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "zites_orders_select_all" ON public.zites_orders;
CREATE POLICY "zites_orders_select_all" ON public.zites_orders FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Zites trade execution log (drives average price / recent-trades ticker)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.zites_trades (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buy_order_id  UUID NOT NULL REFERENCES public.zites_orders(id) ON DELETE CASCADE,
  sell_order_id UUID NOT NULL REFERENCES public.zites_orders(id) ON DELETE CASCADE,
  buyer_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  seller_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  price         NUMERIC(12,4) NOT NULL,
  quantity      NUMERIC(18,4) NOT NULL,
  executed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_zites_trades_time ON public.zites_trades(executed_at DESC);

ALTER TABLE public.zites_trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "zites_trades_select_all" ON public.zites_trades;
CREATE POLICY "zites_trades_select_all" ON public.zites_trades FOR SELECT USING (true);

INSERT INTO public.game_settings (key, value) VALUES
  ('zites_last_price', '0.05')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Atomic Zites trade execution (used by the order-matching engine so a fill's
-- order updates + both balance updates + trade insert happen in one transaction)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.execute_zites_trade(
  p_buy_order_id  UUID,
  p_sell_order_id UUID,
  p_buyer_id      UUID,
  p_seller_id     UUID,
  p_price         NUMERIC,
  p_quantity      NUMERIC
) RETURNS VOID AS $$
DECLARE
  buyer_balance  NUMERIC;
  seller_zites   NUMERIC;
  cost           NUMERIC := p_price * p_quantity;
BEGIN
  SELECT balance INTO buyer_balance FROM public.users WHERE id = p_buyer_id FOR UPDATE;
  SELECT zites_balance INTO seller_zites FROM public.users WHERE id = p_seller_id FOR UPDATE;

  IF buyer_balance < cost THEN
    RAISE EXCEPTION 'Buyer has insufficient balance';
  END IF;
  IF seller_zites < p_quantity THEN
    RAISE EXCEPTION 'Seller has insufficient Zites';
  END IF;

  UPDATE public.users SET balance = balance - cost WHERE id = p_buyer_id;
  UPDATE public.users SET zites_balance = zites_balance + p_quantity WHERE id = p_buyer_id;
  UPDATE public.users SET balance = balance + cost WHERE id = p_seller_id;
  UPDATE public.users SET zites_balance = zites_balance - p_quantity WHERE id = p_seller_id;

  UPDATE public.zites_orders
    SET remaining_quantity = remaining_quantity - p_quantity,
        status = CASE WHEN remaining_quantity - p_quantity <= 0 THEN 'filled' ELSE 'partial' END,
        updated_at = now()
    WHERE id = p_buy_order_id;

  UPDATE public.zites_orders
    SET remaining_quantity = remaining_quantity - p_quantity,
        status = CASE WHEN remaining_quantity - p_quantity <= 0 THEN 'filled' ELSE 'partial' END,
        updated_at = now()
    WHERE id = p_sell_order_id;

  INSERT INTO public.zites_trades (buy_order_id, sell_order_id, buyer_id, seller_id, price, quantity)
    VALUES (p_buy_order_id, p_sell_order_id, p_buyer_id, p_seller_id, p_price, p_quantity);

  INSERT INTO public.game_settings (key, value)
    VALUES ('zites_last_price', to_jsonb(p_price))
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
END;
$$ LANGUAGE plpgsql;
