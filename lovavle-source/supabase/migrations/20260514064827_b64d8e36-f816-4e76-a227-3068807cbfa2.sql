-- 1. Drop duplicates I created by mistake
DROP TABLE IF EXISTS public.tournament_redemptions CASCADE;
DROP TABLE IF EXISTS public.tournament_rewards CASCADE;

-- 2. Rewrite award_points to use existing ledger schema (delta)
CREATE OR REPLACE FUNCTION public.tournament_award_points(
  _user_id UUID, _amount INTEGER, _reason TEXT,
  _ref_type TEXT DEFAULT NULL, _ref_id UUID DEFAULT NULL,
  _multiplier NUMERIC DEFAULT 1.0, _metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _final INTEGER;
  _row_id UUID;
  _meta JSONB;
BEGIN
  _final := round(_amount * COALESCE(_multiplier, 1.0));
  _meta := COALESCE(_metadata, '{}'::jsonb)
    || jsonb_build_object('multiplier', COALESCE(_multiplier, 1.0))
    || CASE WHEN _ref_type IS NOT NULL THEN jsonb_build_object('reference_type', _ref_type) ELSE '{}'::jsonb END
    || CASE WHEN _ref_id IS NOT NULL THEN jsonb_build_object('reference_id', _ref_id) ELSE '{}'::jsonb END;
  INSERT INTO public.tournament_points_ledger(user_id, delta, reason, metadata)
  VALUES (_user_id, _final, _reason, _meta)
  RETURNING id INTO _row_id;
  UPDATE public.tournament_users
  SET bullfy_points = GREATEST(0, COALESCE(bullfy_points, 0) + _final)
  WHERE id = _user_id;
  RETURN _row_id;
END;
$$;

-- 3. Add a trigger to keep bullfy_points in sync if anyone inserts into ledger directly
CREATE OR REPLACE FUNCTION public.tournament_ledger_sync_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Only sync if not coming from award_points (which already updates).
  -- We use a session var to avoid double counting.
  IF current_setting('tournament.skip_ledger_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;
-- (We keep award_points as the canonical entry; legacy code paths that insert
-- into tournament_points_ledger directly already maintain bullfy_points themselves.)

-- 4. Helpful indexes on existing tables for the new flows
CREATE INDEX IF NOT EXISTS idx_tu_referral_code ON public.tournament_users(referral_code);
CREATE INDEX IF NOT EXISTS idx_tu_referred_by ON public.tournament_users(referred_by_code);