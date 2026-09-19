-- OmegaCases: align the database with what the application code actually reads
-- and writes. Run after 001–003. Idempotent: safe to re-run.
--
-- Scripts 001–003 predate several features, so a database built only from them
-- is missing ten tables (battles, battle_rolls, messages, notifications, rolls,
-- trades, trade_items, oauth_apps, oauth_requests, oauth_tokens) and a handful
-- of columns that the app queries by name (users.profile_picture,
-- users.cases_remaining, users.session_token, items.market_price, …). Every
-- table and column below was derived from the queries in app/, lib/ and
-- components/; the installer verifies the result against that same list.

-- ─────────────────────────────────────────────────────────────────────────────
-- Column alignment on tables 001–003 already create
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS profile_picture TEXT,
  ADD COLUMN IF NOT EXISTS cases           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cases_remaining INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plus            BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS admin           BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS balance         NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS zites_balance   NUMERIC(18,4) NOT NULL DEFAULT 0.0000,
  ADD COLUMN IF NOT EXISTS session_token   TEXT,
  ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ NOT NULL DEFAULT now();

-- 001 spells this column "profilepicture"; the app reads "profile_picture".
-- Carry any existing values across, then keep both in sync is not attempted —
-- profile_picture is the one the app uses from here on.
DO $mig$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'profilepicture'
  ) THEN
    UPDATE public.users
       SET profile_picture = profilepicture
     WHERE profile_picture IS NULL AND profilepicture IS NOT NULL;
  END IF;
END
$mig$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON public.users (username);
CREATE INDEX IF NOT EXISTS idx_users_session_token ON public.users (session_token);

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS image_url       TEXT,
  ADD COLUMN IF NOT EXISTS rarity          TEXT,
  ADD COLUMN IF NOT EXISTS likelihood      NUMERIC(12,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS market_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rap             NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS limited_time    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS first_unboxed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS obtained_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_inventory_user ON public.inventory (user_id);

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS inventory_id UUID REFERENCES public.inventory(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS sold_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_listings_status ON public.listings (status);

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS buyer_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS price     NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS sold_at   TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS payment_id TEXT,
  ADD COLUMN IF NOT EXISTS order_id   TEXT,
  ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS crypto     TEXT,
  ADD COLUMN IF NOT EXISTS status     TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_deposits_payment_id ON public.deposits (payment_id);

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS amount_usd     NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS fee_usd        NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_usd        NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS crypto         TEXT,
  ADD COLUMN IF NOT EXISTS wallet_address TEXT,
  ADD COLUMN IF NOT EXISTS status         TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ NOT NULL DEFAULT now();

-- ─────────────────────────────────────────────────────────────────────────────
-- Case battles
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.battles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joiner_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  joiner2_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  joiner3_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  winner_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  case_count   INTEGER NOT NULL CHECK (case_count > 0),
  exclusive    BOOLEAN NOT NULL DEFAULT FALSE,
  max_players  INTEGER NOT NULL DEFAULT 2 CHECK (max_players BETWEEN 2 AND 4),
  status       TEXT NOT NULL DEFAULT 'waiting'
                 CHECK (status IN ('waiting','in_progress','completed','cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_battles_status_created ON public.battles (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_battles_creator ON public.battles (creator_id);

CREATE TABLE IF NOT EXISTS public.battle_rolls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id   UUID NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id     UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  round       INTEGER NOT NULL DEFAULT 0,
  roll_index  INTEGER NOT NULL DEFAULT 0,
  rap         NUMERIC(12,2) NOT NULL DEFAULT 0,
  "float"     DOUBLE PRECISION,
  server_seed TEXT,
  client_seed TEXT,
  nonce       BIGINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_battle_rolls_battle ON public.battle_rolls (battle_id, roll_index);

-- ─────────────────────────────────────────────────────────────────────────────
-- Chat / DMs and notifications
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'dm' CHECK (type IN ('dm','public')),
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_public   ON public.messages (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_dm_pair  ON public.messages (sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread   ON public.messages (receiver_id, read) WHERE type = 'dm';

CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications (user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Provably-fair roll log
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rolls (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id          UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  server_seed      TEXT,
  server_seed_hash TEXT,
  client_seed      TEXT DEFAULT 'omegacases',
  nonce            BIGINT NOT NULL DEFAULT 0,
  "float"          DOUBLE PRECISION,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rolls_created ON public.rolls (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rolls_user    ON public.rolls (user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Player-to-player trading
-- The FK names matter: the app embeds with
-- users!trades_sender_id_fkey / users!trades_receiver_id_fkey, which is
-- exactly what Postgres names these constraints by default.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trades (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_balance   NUMERIC(12,2) NOT NULL DEFAULT 0,
  receiver_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','accepted','declined','cancelled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trades_sender   ON public.trades (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_receiver ON public.trades (receiver_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.trade_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id     UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  side         TEXT NOT NULL CHECK (side IN ('sender','receiver'))
);
CREATE INDEX IF NOT EXISTS idx_trade_items_trade ON public.trade_items (trade_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- External app authorisation (the /ext/auth flow and OAuth-style apps)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.oauth_apps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  client_id     TEXT NOT NULL UNIQUE,
  client_secret TEXT NOT NULL,
  scopes        TEXT[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.oauth_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id       UUID NOT NULL REFERENCES public.oauth_apps(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE,
  scopes       TEXT[] NOT NULL DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_token ON public.oauth_tokens (token);

-- id is the short request id minted in app/api/oauth/init (8 chars), not a UUID.
CREATE TABLE IF NOT EXISTS public.oauth_requests (
  id           TEXT PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  callback_url TEXT NOT NULL,
  redirect_url TEXT,
  get_user_id  BOOLEAN NOT NULL DEFAULT FALSE,
  get_username BOOLEAN NOT NULL DEFAULT FALSE,
  get_balance  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row level security: reads go through the anon key, writes all happen in API
-- routes with the service role key (which bypasses RLS), so public tables get
-- a read policy and the private ones get none.
-- ─────────────────────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  t TEXT;
  readable TEXT[] := ARRAY['battles','battle_rolls','messages','rolls','trades','trade_items','oauth_apps'];
  private  TEXT[] := ARRAY['notifications','oauth_tokens','oauth_requests'];
BEGIN
  FOREACH t IN ARRAY readable || private LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;

  FOREACH t IN ARRAY readable LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_all', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (true)', t || '_select_all', t);
  END LOOP;
END
$mig$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime: the live feeds subscribe to postgres_changes on these tables, so
-- they have to be in the supabase_realtime publication. REPLICA IDENTITY FULL
-- lets the server evaluate the app's column filters (receiver_id=eq.…,
-- type=eq.public) on updates and deletes as well as inserts.
-- ─────────────────────────────────────────────────────────────────────────────
-- On a self-hosted Supabase stack the publication belongs to supabase_admin,
-- and the role running migrations is not a superuser, so adding a table to it
-- can be refused. Live feeds are worth having but not worth failing the whole
-- migration over: a refusal is reported and the rest carries on. The installer
-- prints which tables ended up published.
DO $mig$
DECLARE
  t TEXT;
  live TEXT[] := ARRAY['battles','messages','rolls','zites_trades','mining_blocks'];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      CREATE PUBLICATION supabase_realtime;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'could not create the supabase_realtime publication: %', SQLERRM;
      RETURN;
    END;
  END IF;

  FOREACH t IN ARRAY live LOOP
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    );

    BEGIN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'could not set replica identity on %: %', t, SQLERRM;
    END;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'could not publish % for live updates: %', t, SQLERRM;
      END;
    END IF;
  END LOOP;
END
$mig$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants for the PostgREST roles. On a self-hosted stack these roles exist but
-- own nothing, so without this the anon key sees an empty schema.
-- ─────────────────────────────────────────────────────────────────────────────
-- A hosted Supabase project has these grants already; a self-hosted stack may
-- not, and there the migrating role may not own the public schema either. Each
-- grant is therefore attempted on its own and a refusal is reported.
DO $mig$
DECLARE
  stmt TEXT;
  statements TEXT[] := ARRAY[
    'GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role',
    'GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated',
    'GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role',
    'GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role',
    'GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role',
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon, authenticated',
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role',
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role'
  ];
BEGIN
  -- Nothing to grant to roles that do not exist: this database is not serving
  -- PostgREST.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    RAISE NOTICE 'the anon role does not exist; skipping the API grants';
    RETURN;
  END IF;

  FOREACH stmt IN ARRAY statements LOOP
    BEGIN
      EXECUTE stmt;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skipped: % (%)', stmt, SQLERRM;
    END;
  END LOOP;
END
$mig$;
