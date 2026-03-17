-- Seed default case prices into game_settings
INSERT INTO public.game_settings (key, value) VALUES
  ('case_prices', '[{"qty": 10, "price": 0.39}, {"qty": 100, "price": 2.99}, {"qty": 1000, "price": 9.99}]')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
