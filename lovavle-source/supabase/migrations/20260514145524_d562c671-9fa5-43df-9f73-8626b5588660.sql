
CREATE TABLE IF NOT EXISTS public.tournament_bp_config (
  id int PRIMARY KEY DEFAULT 1,
  join_base_points int NOT NULL DEFAULT 50,
  paid_multiplier numeric NOT NULL DEFAULT 2.0,
  elite_multiplier numeric NOT NULL DEFAULT 3.0,
  elite_entry_fee_threshold numeric NOT NULL DEFAULT 100,
  win_first_place_points int NOT NULL DEFAULT 300,
  daily_streak_base_points int NOT NULL DEFAULT 10,
  referral_first_deposit_points int NOT NULL DEFAULT 250,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT bp_singleton CHECK (id = 1)
);

INSERT INTO public.tournament_bp_config (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.tournament_bp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "global_admin_read_bp_config" ON public.tournament_bp_config
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'global_admin'::public.app_role));

-- Fix: trigger referenced non-existent `tier` column
CREATE OR REPLACE FUNCTION public.tournament_points_on_join()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _entry numeric;
  _type text;
  _cfg RECORD;
  _mult numeric := 1.0;
  _amount int;
BEGIN
  SELECT entry_fee_usd, type::text INTO _entry, _type
    FROM public.tournaments WHERE id = NEW.tournament_id;
  SELECT * INTO _cfg FROM public.tournament_bp_config WHERE id = 1;

  IF _type = 'elite' OR COALESCE(_entry, 0) >= COALESCE(_cfg.elite_entry_fee_threshold, 100) THEN
    _mult := COALESCE(_cfg.elite_multiplier, 3.0);
  ELSIF COALESCE(_entry, 0) > 0 THEN
    _mult := COALESCE(_cfg.paid_multiplier, 2.0);
  END IF;

  _amount := COALESCE(_cfg.join_base_points, 50);
  PERFORM public.tournament_award_points(NEW.user_id, _amount, 'join_tournament', 'tournament', NEW.tournament_id, _mult);
  PERFORM public.tournament_unlock_achievement(NEW.user_id, 'first_tournament');
  RETURN NEW;
END;
$function$;

-- Make win points configurable
CREATE OR REPLACE FUNCTION public.tournament_check_rank_achievements()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _prize numeric;
  _win_pts int;
BEGIN
  IF NEW.final_rank IS NULL OR (TG_OP='UPDATE' AND OLD.final_rank IS NOT DISTINCT FROM NEW.final_rank) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(win_first_place_points, 300) INTO _win_pts
    FROM public.tournament_bp_config WHERE id = 1;

  IF NEW.final_rank = 1 THEN
    PERFORM public.tournament_unlock_achievement(NEW.user_id, 'first_win',
      jsonb_build_object('tournament_id', NEW.tournament_id));
    PERFORM public.tournament_award_points(NEW.user_id, COALESCE(_win_pts, 300), 'Ganaste un torneo',
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
END;
$function$;
