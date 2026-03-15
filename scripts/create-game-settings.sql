-- Create game_settings table for admin-configurable values
CREATE TABLE IF NOT EXISTS public.game_settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default rarity price caps
INSERT INTO public.game_settings (key, value) VALUES
  ('rarity_price_caps', '{"Common": 0.04, "Uncommon": 0.10, "Rare": 0.40, "Legendary": 2.00, "Omega": 800}')
ON CONFLICT (key) DO NOTHING;
