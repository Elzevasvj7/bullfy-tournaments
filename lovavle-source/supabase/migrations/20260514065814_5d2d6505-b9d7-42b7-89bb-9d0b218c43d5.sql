-- Tournament Gamification Triggers (uses 'completed' status for payments)

CREATE OR REPLACE FUNCTION public.tournament_check_rank_achievements()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _prize numeric;
BEGIN
  IF NEW.final_rank IS NULL OR (TG_OP='UPDATE' AND OLD.final_rank IS NOT DISTINCT FROM NEW.final_rank) THEN
    RETURN NEW;
  END IF;

  IF NEW.final_rank = 1 THEN
    PERFORM public.tournament_unlock_achievement(NEW.user_id, 'first_win',
      jsonb_build_object('tournament_id', NEW.tournament_id));
    PERFORM public.tournament_award_points(NEW.user_id, 300, 'Ganaste un torneo',
      'tournament_win', NEW.tournament_id, 1.0,
      jsonb_build_object('tournament_id', NEW.tournament_id, 'rank', 1));
    _prize := COALESCE(NEW.prize_won_usd, 0);
    IF _prize > 0 THEN
      UPDATE public.tournament_users
        SET lifetime_winnings_usd = COALESCE(lifetime_winnings_usd, 0) + _prize
        WHERE id = NEW.user_id;
    END IF;
  END IF;

  IF NEW.final_rank BETWEEN 1 AND 3 THEN
    PERFORM public.tournament_unlock_achievement(NEW.user_id, 'top_3',
      jsonb_build_object('tournament_id', NEW.tournament_id, 'rank', NEW.final_rank));
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_tournament_rank_achievements ON public.tournament_participants;
CREATE TRIGGER trg_tournament_rank_achievements
  AFTER INSERT OR UPDATE OF final_rank ON public.tournament_participants
  FOR EACH ROW EXECUTE FUNCTION public.tournament_check_rank_achievements();

CREATE OR REPLACE FUNCTION public.tournament_check_count_achievements()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _count int;
BEGIN
  SELECT COUNT(*) INTO _count FROM public.tournament_participants WHERE user_id = NEW.user_id;
  IF _count >= 10 THEN
    PERFORM public.tournament_unlock_achievement(NEW.user_id, 'ten_tournaments',
      jsonb_build_object('count', _count));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_tournament_count_achievements ON public.tournament_participants;
CREATE TRIGGER trg_tournament_count_achievements
  AFTER INSERT ON public.tournament_participants
  FOR EACH ROW EXECUTE FUNCTION public.tournament_check_count_achievements();

CREATE OR REPLACE FUNCTION public.tournament_check_kyc_achievement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.kyc_status = 'approved' AND (OLD.kyc_status IS DISTINCT FROM 'approved') THEN
    PERFORM public.tournament_unlock_achievement(NEW.id, 'kyc_verified',
      jsonb_build_object('approved_at', now()));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_tournament_kyc_achievement ON public.tournament_users;
CREATE TRIGGER trg_tournament_kyc_achievement
  AFTER UPDATE OF kyc_status ON public.tournament_users
  FOR EACH ROW EXECUTE FUNCTION public.tournament_check_kyc_achievement();

CREATE OR REPLACE FUNCTION public.tournament_check_deposit_achievement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _prior int;
  _ref RECORD;
  _reward int := 250;
BEGIN
  IF NEW.type <> 'deposit' OR NEW.status <> 'completed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO _prior
    FROM public.tournament_payments
    WHERE user_id = NEW.user_id AND type = 'deposit'
      AND status = 'completed' AND id <> NEW.id;

  IF _prior = 0 THEN
    PERFORM public.tournament_unlock_achievement(NEW.user_id, 'first_deposit',
      jsonb_build_object('amount_usd', NEW.amount_usd, 'payment_id', NEW.id));

    SELECT * INTO _ref FROM public.tournament_referrals
      WHERE referred_user_id = NEW.user_id AND status = 'pending' LIMIT 1;

    IF FOUND THEN
      UPDATE public.tournament_referrals
        SET status = 'qualified', qualified_at = now(),
            rewarded_at = now(), reward_points = _reward
        WHERE id = _ref.id;

      PERFORM public.tournament_award_points(_ref.referrer_user_id, _reward,
        'Tu referido hizo su primer depósito',
        'referral', _ref.id, 1.0,
        jsonb_build_object('referred_user_id', NEW.user_id,
          'payment_id', NEW.id, 'amount_usd', NEW.amount_usd));

      PERFORM public.tournament_unlock_achievement(_ref.referrer_user_id, 'first_referral',
        jsonb_build_object('referred_user_id', NEW.user_id));
    END IF;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_tournament_deposit_achievement ON public.tournament_payments;
CREATE TRIGGER trg_tournament_deposit_achievement
  AFTER INSERT OR UPDATE OF status ON public.tournament_payments
  FOR EACH ROW EXECUTE FUNCTION public.tournament_check_deposit_achievement();