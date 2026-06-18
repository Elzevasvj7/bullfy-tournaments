
ALTER TABLE public.tournament_bp_config
  ADD COLUMN IF NOT EXISTS win_second_place_points int NOT NULL DEFAULT 150,
  ADD COLUMN IF NOT EXISTS win_third_place_points  int NOT NULL DEFAULT 75;

CREATE OR REPLACE FUNCTION public.tournament_check_rank_achievements()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _prize numeric;
  _win_pts int;
  _p2_pts int;
  _p3_pts int;
BEGIN
  IF NEW.final_rank IS NULL OR (TG_OP='UPDATE' AND OLD.final_rank IS NOT DISTINCT FROM NEW.final_rank) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(win_first_place_points, 300),
         COALESCE(win_second_place_points, 150),
         COALESCE(win_third_place_points, 75)
    INTO _win_pts, _p2_pts, _p3_pts
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
  ELSIF NEW.final_rank = 2 THEN
    PERFORM public.tournament_award_points(NEW.user_id, COALESCE(_p2_pts, 150), 'Podio 2º lugar',
      'tournament_podium', NEW.tournament_id, 1.0,
      jsonb_build_object('tournament_id', NEW.tournament_id, 'rank', 2));
  ELSIF NEW.final_rank = 3 THEN
    PERFORM public.tournament_award_points(NEW.user_id, COALESCE(_p3_pts, 75), 'Podio 3º lugar',
      'tournament_podium', NEW.tournament_id, 1.0,
      jsonb_build_object('tournament_id', NEW.tournament_id, 'rank', 3));
  END IF;

  IF NEW.final_rank BETWEEN 1 AND 3 THEN
    PERFORM public.tournament_unlock_achievement(NEW.user_id, 'top_3',
      jsonb_build_object('tournament_id', NEW.tournament_id, 'rank', NEW.final_rank));
  END IF;

  RETURN NEW;
END;
$function$;
