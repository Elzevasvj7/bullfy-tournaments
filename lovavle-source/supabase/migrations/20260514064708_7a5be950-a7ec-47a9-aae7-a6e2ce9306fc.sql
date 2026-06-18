-- 1. Extend tournament_users with gamification fields
ALTER TABLE public.tournament_users
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by_code TEXT,
  ADD COLUMN IF NOT EXISTS daily_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_streak_date DATE;

-- Generate referral_code function
CREATE OR REPLACE FUNCTION public.tournament_generate_referral_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_code TEXT;
  attempts INTEGER := 0;
BEGIN
  IF NEW.referral_code IS NOT NULL THEN RETURN NEW; END IF;
  LOOP
    new_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.tournament_users WHERE referral_code = new_code);
    attempts := attempts + 1;
    IF attempts > 10 THEN RAISE EXCEPTION 'Could not generate unique referral_code'; END IF;
  END LOOP;
  NEW.referral_code := new_code;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tournament_users_referral_code ON public.tournament_users;
CREATE TRIGGER trg_tournament_users_referral_code
BEFORE INSERT ON public.tournament_users
FOR EACH ROW EXECUTE FUNCTION public.tournament_generate_referral_code();

-- Backfill existing users
UPDATE public.tournament_users
SET referral_code = upper(substring(md5(id::text || random()::text) from 1 for 8))
WHERE referral_code IS NULL;

-- 2. Points ledger
CREATE TABLE IF NOT EXISTS public.tournament_points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tpl_user ON public.tournament_points_ledger(user_id, created_at DESC);

ALTER TABLE public.tournament_points_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_select_admin" ON public.tournament_points_ledger FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ledger_insert_service" ON public.tournament_points_ledger FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin'));

-- Function: award points (atomic update of bullfy_points + insert ledger)
CREATE OR REPLACE FUNCTION public.tournament_award_points(
  _user_id UUID, _amount INTEGER, _reason TEXT,
  _ref_type TEXT DEFAULT NULL, _ref_id UUID DEFAULT NULL,
  _multiplier NUMERIC DEFAULT 1.0, _metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _final INTEGER;
  _row_id UUID;
BEGIN
  _final := round(_amount * COALESCE(_multiplier, 1.0));
  INSERT INTO public.tournament_points_ledger(user_id, amount, reason, reference_type, reference_id, multiplier, metadata)
  VALUES (_user_id, _final, _reason, _ref_type, _ref_id, COALESCE(_multiplier, 1.0), COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO _row_id;
  UPDATE public.tournament_users
  SET bullfy_points = GREATEST(0, COALESCE(bullfy_points, 0) + _final)
  WHERE id = _user_id;
  RETURN _row_id;
END;
$$;

-- 3. Rewards catalog
CREATE TABLE IF NOT EXISTS public.tournament_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('merch','discount','free_entry','usdt','custom')),
  cost_points INTEGER NOT NULL CHECK (cost_points > 0),
  stock INTEGER,
  image_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  requires_shipping BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rewards_public_read" ON public.tournament_rewards FOR SELECT
  TO anon, authenticated USING (is_active = true);
CREATE POLICY "rewards_admin_all" ON public.tournament_rewards FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin'));

-- 4. Redemptions
CREATE TABLE IF NOT EXISTS public.tournament_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.tournament_rewards(id),
  points_spent INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','shipped','delivered','rejected','cancelled')),
  shipping_address JSONB,
  tracking_number TEXT,
  notes TEXT,
  processed_by UUID,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tr_user ON public.tournament_redemptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tr_status ON public.tournament_redemptions(status);

ALTER TABLE public.tournament_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "redemptions_admin_all" ON public.tournament_redemptions FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin'));

-- 5. Referrals
CREATE TABLE IF NOT EXISTS public.tournament_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','qualified','rewarded')),
  qualified_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  reward_points INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(referred_user_id)
);
CREATE INDEX IF NOT EXISTS idx_tref_referrer ON public.tournament_referrals(referrer_user_id);

ALTER TABLE public.tournament_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals_admin_all" ON public.tournament_referrals FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin'));

-- Trigger: when a new tournament_user has referred_by_code, create referral row
CREATE OR REPLACE FUNCTION public.tournament_link_referral()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ref_user UUID;
BEGIN
  IF NEW.referred_by_code IS NULL OR NEW.referred_by_code = '' THEN RETURN NEW; END IF;
  SELECT id INTO _ref_user FROM public.tournament_users
    WHERE referral_code = upper(NEW.referred_by_code) AND id <> NEW.id LIMIT 1;
  IF _ref_user IS NOT NULL THEN
    INSERT INTO public.tournament_referrals(referrer_user_id, referred_user_id, referral_code, status)
    VALUES (_ref_user, NEW.id, upper(NEW.referred_by_code), 'pending')
    ON CONFLICT (referred_user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tournament_link_referral ON public.tournament_users;
CREATE TRIGGER trg_tournament_link_referral
AFTER INSERT ON public.tournament_users
FOR EACH ROW EXECUTE FUNCTION public.tournament_link_referral();

-- 6. Achievements
CREATE TABLE IF NOT EXISTS public.tournament_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  reward_points INTEGER NOT NULL DEFAULT 0,
  rule JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements_public_read" ON public.tournament_achievements FOR SELECT
  TO anon, authenticated USING (is_active = true);
CREATE POLICY "achievements_admin_all" ON public.tournament_achievements FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.tournament_user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.tournament_achievements(id),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(user_id, achievement_id)
);
CREATE INDEX IF NOT EXISTS idx_tua_user ON public.tournament_user_achievements(user_id);

ALTER TABLE public.tournament_user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_achievements_admin_all" ON public.tournament_user_achievements FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin'));

-- Function: unlock achievement (idempotent, awards points if new)
CREATE OR REPLACE FUNCTION public.tournament_unlock_achievement(_user_id UUID, _code TEXT, _metadata JSONB DEFAULT '{}'::jsonb)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ach RECORD;
  _inserted BOOLEAN := false;
BEGIN
  SELECT id, reward_points INTO _ach FROM public.tournament_achievements WHERE code = _code AND is_active = true;
  IF _ach.id IS NULL THEN RETURN false; END IF;
  INSERT INTO public.tournament_user_achievements(user_id, achievement_id, metadata)
  VALUES (_user_id, _ach.id, COALESCE(_metadata, '{}'::jsonb))
  ON CONFLICT (user_id, achievement_id) DO NOTHING
  RETURNING true INTO _inserted;
  IF _inserted AND _ach.reward_points > 0 THEN
    PERFORM public.tournament_award_points(_user_id, _ach.reward_points, 'achievement:' || _code, 'achievement', _ach.id);
  END IF;
  RETURN COALESCE(_inserted, false);
END;
$$;

-- 7. Triggers automáticos: puntos por participar y ganar
CREATE OR REPLACE FUNCTION public.tournament_points_on_join()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _t RECORD;
  _mult NUMERIC := 1.0;
  _amount INTEGER;
BEGIN
  SELECT tier, entry_fee_usd INTO _t FROM public.tournaments WHERE id = NEW.tournament_id;
  IF _t.tier = 'elite' THEN _mult := 3.0;
  ELSIF COALESCE(_t.entry_fee_usd, 0) > 0 THEN _mult := 2.0;
  END IF;
  _amount := 50; -- base por inscripción
  PERFORM public.tournament_award_points(NEW.user_id, _amount, 'join_tournament', 'tournament', NEW.tournament_id, _mult);
  PERFORM public.tournament_unlock_achievement(NEW.user_id, 'first_tournament');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tournament_points_join ON public.tournament_participants;
CREATE TRIGGER trg_tournament_points_join
AFTER INSERT ON public.tournament_participants
FOR EACH ROW EXECUTE FUNCTION public.tournament_points_on_join();

-- Daily streak helper (called from edge function on login)
CREATE OR REPLACE FUNCTION public.tournament_check_daily_streak(_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _u RECORD;
  _today DATE := (now() AT TIME ZONE 'UTC')::date;
  _new_streak INTEGER;
  _awarded INTEGER := 0;
BEGIN
  SELECT daily_streak, last_streak_date INTO _u FROM public.tournament_users WHERE id = _user_id;
  IF _u.last_streak_date = _today THEN
    RETURN jsonb_build_object('streak', _u.daily_streak, 'awarded', 0, 'already', true);
  END IF;
  IF _u.last_streak_date = _today - 1 THEN _new_streak := COALESCE(_u.daily_streak,0) + 1;
  ELSE _new_streak := 1;
  END IF;
  _awarded := 10 + (LEAST(_new_streak, 30) - 1) * 2; -- 10,12,14...
  UPDATE public.tournament_users SET daily_streak = _new_streak, last_streak_date = _today WHERE id = _user_id;
  PERFORM public.tournament_award_points(_user_id, _awarded, 'daily_streak', 'streak', NULL, 1.0,
    jsonb_build_object('streak', _new_streak));
  IF _new_streak = 7 THEN PERFORM public.tournament_unlock_achievement(_user_id, 'streak_7'); END IF;
  IF _new_streak = 30 THEN PERFORM public.tournament_unlock_achievement(_user_id, 'streak_30'); END IF;
  RETURN jsonb_build_object('streak', _new_streak, 'awarded', _awarded, 'already', false);
END;
$$;

-- 8. Seed achievements iniciales
INSERT INTO public.tournament_achievements(code, name, description, icon, reward_points, sort_order) VALUES
  ('first_tournament', 'Primera Batalla', 'Te inscribiste a tu primer torneo', 'flag', 100, 10),
  ('first_win', 'Primera Victoria', 'Ganaste tu primer torneo', 'trophy', 500, 20),
  ('top_3', 'Podio', 'Terminaste en top 3', 'award', 200, 30),
  ('streak_7', 'Racha Semanal', '7 días seguidos en la app', 'zap', 150, 40),
  ('streak_30', 'Imparable', '30 días seguidos en la app', 'zap', 1000, 50),
  ('first_referral', 'Reclutador', 'Tu primer referido completó registro', 'users', 200, 60),
  ('elite_join', 'Élite', 'Te inscribiste a un torneo Élite', 'star', 500, 70),
  ('kyc_verified', 'Verificado', 'KYC aprobado', 'check-circle', 100, 80),
  ('first_deposit', 'Comprometido', 'Hiciste tu primer depósito', 'dollar-sign', 100, 90),
  ('ten_tournaments', 'Veterano', 'Participaste en 10 torneos', 'shield', 750, 100)
ON CONFLICT (code) DO NOTHING;

-- 9. Trigger updated_at en rewards
CREATE OR REPLACE FUNCTION public.tournament_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_rewards_updated_at ON public.tournament_rewards;
CREATE TRIGGER trg_rewards_updated_at BEFORE UPDATE ON public.tournament_rewards
FOR EACH ROW EXECUTE FUNCTION public.tournament_touch_updated_at();