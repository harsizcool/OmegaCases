-- Buyer protection: the marketplace fee a buyer pays on top of the asking price.
-- Stored as a fraction, so 0.05 is 5%. Admins change it from the admin panel.
--
-- The application falls back to 5% when this row is absent, so seeding it is
-- about making the current value visible and editable rather than about the
-- site working. ON CONFLICT DO NOTHING so re-running never resets a rate an
-- admin has chosen.
INSERT INTO public.game_settings (key, value)
VALUES ('buyer_protection_rate', '0.05')
ON CONFLICT (key) DO NOTHING;
