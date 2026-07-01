-- Fixes for two race conditions found in code review of the mining/Zites work:
--
-- 1. Solo mining and pool payout credits did a plain read-then-write on
--    users.zites_balance, so two concurrent credits to the same user could
--    silently drop one (lost update).
-- 2. Solo and pool block submission each independently read/advanced
--    mining_height and mining_target with no lock spanning the sequence, so
--    a difficulty retarget could double-apply if two blocks landed on the
--    same retarget boundary close together.
--
-- Run this after scripts/002_zites_and_pools.sql. Safe to re-run (CREATE OR REPLACE).

-- Atomic balance increment: a single UPDATE statement takes an implicit row
-- lock for its duration, so concurrent calls serialize instead of racing.
CREATE OR REPLACE FUNCTION public.credit_zites_balance(p_user_id UUID, p_amount NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
  new_balance NUMERIC;
BEGIN
  UPDATE public.users
    SET zites_balance = zites_balance + p_amount
    WHERE id = p_user_id
    RETURNING zites_balance INTO new_balance;
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql;

-- Atomically claims a block: locks the mining_height row, verifies the caller's
-- expected height is still current, inserts the block, and advances height, all
-- within one transaction. Raises 'height_mismatch' if another submission already
-- claimed/advanced past this height (caller should treat that like the old
-- insert-conflict 409 case).
CREATE OR REPLACE FUNCTION public.claim_mining_block(
  p_expected_height INTEGER,
  p_hash            TEXT,
  p_nonce           BIGINT,
  p_miner_id        UUID,
  p_previous_hash   TEXT,
  p_target          TEXT,
  p_reward_zites    NUMERIC,
  p_pool_id         UUID
) RETURNS TABLE(new_height INTEGER, block_id UUID) AS $$
DECLARE
  locked_height INTEGER;
  inserted_id UUID;
  next_height INTEGER;
BEGIN
  SELECT (value::text)::integer INTO locked_height
    FROM public.game_settings WHERE key = 'mining_height' FOR UPDATE;

  IF locked_height IS DISTINCT FROM p_expected_height THEN
    RAISE EXCEPTION 'height_mismatch';
  END IF;

  INSERT INTO public.mining_blocks
    (height, hash, nonce, miner_id, previous_hash, target, reward_zites, pool_id, found_at)
  VALUES
    (p_expected_height, p_hash, p_nonce, p_miner_id, p_previous_hash, p_target, p_reward_zites, p_pool_id, now())
  RETURNING id INTO inserted_id;

  next_height := p_expected_height + 1;
  UPDATE public.game_settings
    SET value = to_jsonb(next_height), updated_at = now()
    WHERE key = 'mining_height';

  RETURN QUERY SELECT next_height, inserted_id;
END;
$$ LANGUAGE plpgsql;

-- Atomically applies (or skips) a difficulty retarget for a given boundary
-- height. Locks the mining_last_adj_height row; if it already equals the
-- height being processed, the retarget was already applied by a concurrent
-- submission and this call is a safe no-op (returns false).
CREATE OR REPLACE FUNCTION public.apply_difficulty_retarget(
  p_new_adj_height INTEGER,
  p_new_target     TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  locked_last_adj INTEGER;
BEGIN
  SELECT (value::text)::integer INTO locked_last_adj
    FROM public.game_settings WHERE key = 'mining_last_adj_height' FOR UPDATE;

  IF locked_last_adj = p_new_adj_height THEN
    RETURN FALSE;
  END IF;

  UPDATE public.game_settings SET value = to_jsonb(p_new_target), updated_at = now() WHERE key = 'mining_target';
  UPDATE public.game_settings SET value = to_jsonb(p_new_adj_height), updated_at = now() WHERE key = 'mining_last_adj_height';

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
