-- OmegaCases full schema

-- public.users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  profilepicture TEXT DEFAULT NULL,
  balance NUMERIC(12,2) DEFAULT 0.00,
  admin BOOLEAN DEFAULT FALSE,
  cases INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add cases column if it doesn't exist already (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='cases'
  ) THEN
    ALTER TABLE public.users ADD COLUMN cases INTEGER DEFAULT 0;
  END IF;
END
$$;

-- Items
CREATE TABLE IF NOT EXISTS public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('Common','Uncommon','Rare','Legendary','Omega')),
  likelihood NUMERIC(8,4) NOT NULL DEFAULT 10.0, -- percentage e.g. 40.0 = 40%
  market_price NUMERIC(12,2) DEFAULT 0.00,
  rap NUMERIC(12,2) DEFAULT 0.00, -- recent average price
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User inventory
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  obtained_at TIMESTAMPTZ DEFAULT NOW()
);

-- Marketplace listings
CREATE TABLE IF NOT EXISTS public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  price NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales history (for price charts)
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  price NUMERIC(12,2) NOT NULL,
  sold_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deposits
CREATE TABLE IF NOT EXISTS public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  payment_id TEXT,
  amount_usd NUMERIC(12,2),
  crypto TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Withdrawals
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount_usd NUMERIC(12,2) NOT NULL,
  fee_usd NUMERIC(12,2) NOT NULL,
  net_usd NUMERIC(12,2) NOT NULL,
  crypto TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processed','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: disable for service_role (server-side), enable policies for users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- Since we use custom auth (not Supabase Auth), we use service_role key on server
-- and anon key policies are permissive for reads where needed:

-- Users: public read, no write from anon
CREATE POLICY IF NOT EXISTS "users_select_all" ON public.users FOR SELECT USING (true);

-- Items: public read
CREATE POLICY IF NOT EXISTS "items_select_all" ON public.items FOR SELECT USING (true);

-- Inventory: public read
CREATE POLICY IF NOT EXISTS "inventory_select_all" ON public.inventory FOR SELECT USING (true);

-- Listings: public read
CREATE POLICY IF NOT EXISTS "listings_select_all" ON public.listings FOR SELECT USING (true);

-- Sales: public read
CREATE POLICY IF NOT EXISTS "sales_select_all" ON public.sales FOR SELECT USING (true);

-- Insert a few sample items to get started
INSERT INTO public.items (name, image_url, rarity, likelihood, market_price, rap)
VALUES
  ('Rusty Blade', 'https://placehold.co/200x200/cccccc/666666?text=Rusty+Blade', 'Common', 40.0, 0.25, 0.25),
  ('Iron Dagger', 'https://placehold.co/200x200/cccccc/666666?text=Iron+Dagger', 'Common', 30.0, 0.50, 0.50),
  ('Shadow Knife', 'https://placehold.co/200x200/4488ff/ffffff?text=Shadow+Knife', 'Uncommon', 15.0, 1.20, 1.20),
  ('Neon Saber', 'https://placehold.co/200x200/00ccff/ffffff?text=Neon+Saber', 'Rare', 8.0, 5.00, 5.00),
  ('Dragon Fang', 'https://placehold.co/200x200/ffaa00/ffffff?text=Dragon+Fang', 'Legendary', 6.0, 25.00, 25.00),
  ('Omega Blade', 'https://placehold.co/200x200/ff2200/ffffff?text=Omega+Blade', 'Omega', 1.0, 150.00, 150.00)
ON CONFLICT DO NOTHING;
