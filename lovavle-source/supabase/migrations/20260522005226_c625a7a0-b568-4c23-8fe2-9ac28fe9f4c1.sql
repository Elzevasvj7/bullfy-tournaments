-- 1) Trigger: cuando se borra un torneo, refundar entry fees bloqueados a los participantes
CREATE OR REPLACE FUNCTION public.tournament_refund_locked_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
  fee_usd NUMERIC;
  fee_bm NUMERIC;
  cur_locked_usd NUMERIC;
  cur_locked_bm NUMERIC;
BEGIN
  fee_usd := COALESCE(OLD.entry_fee_usd, 0);
  fee_bm := COALESCE(OLD.entry_fee_bmoney, 0);
  IF fee_usd = 0 AND fee_bm = 0 THEN
    RETURN OLD;
  END IF;

  FOR p IN
    SELECT user_id FROM public.tournament_participants WHERE tournament_id = OLD.id
  LOOP
    SELECT locked_usd, bmoney_locked INTO cur_locked_usd, cur_locked_bm
      FROM public.tournament_wallets WHERE user_id = p.user_id;
    IF fee_usd > 0 THEN
      UPDATE public.tournament_wallets
        SET locked_usd = GREATEST(0, COALESCE(locked_usd,0) - fee_usd),
            balance_usd = COALESCE(balance_usd,0) + LEAST(fee_usd, COALESCE(cur_locked_usd,0))
        WHERE user_id = p.user_id;
    END IF;
    IF fee_bm > 0 THEN
      UPDATE public.tournament_wallets
        SET bmoney_locked = GREATEST(0, COALESCE(bmoney_locked,0) - fee_bm),
            bmoney_balance = COALESCE(bmoney_balance,0) + LEAST(fee_bm, COALESCE(cur_locked_bm,0))
        WHERE user_id = p.user_id;
    END IF;
  END LOOP;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_tournament_refund_on_delete ON public.tournaments;
CREATE TRIGGER trg_tournament_refund_on_delete
BEFORE DELETE ON public.tournaments
FOR EACH ROW EXECUTE FUNCTION public.tournament_refund_locked_on_delete();

-- 2) Limpieza one-shot: recalcular locked basado SOLO en torneos vivos
WITH active_fees AS (
  SELECT
    p.user_id,
    SUM(COALESCE(t.entry_fee_usd, 0)) AS expected_locked_usd,
    SUM(COALESCE(t.entry_fee_bmoney, 0)) AS expected_locked_bm
  FROM public.tournament_participants p
  JOIN public.tournaments t ON t.id = p.tournament_id
  WHERE t.status IN ('draft','scheduled','registration_open','running')
  GROUP BY p.user_id
),
target AS (
  SELECT w.user_id,
    COALESCE(w.balance_usd,0) AS balance_usd,
    COALESCE(w.locked_usd,0) AS locked_usd,
    COALESCE(w.bmoney_balance,0) AS bmoney_balance,
    COALESCE(w.bmoney_locked,0) AS bmoney_locked,
    COALESCE(af.expected_locked_usd,0) AS exp_usd,
    COALESCE(af.expected_locked_bm,0) AS exp_bm
  FROM public.tournament_wallets w
  LEFT JOIN active_fees af ON af.user_id = w.user_id
  WHERE COALESCE(w.bmoney_locked,0) > 0 OR COALESCE(w.locked_usd,0) > 0
)
UPDATE public.tournament_wallets w
SET
  bmoney_balance = t.bmoney_balance + GREATEST(0, t.bmoney_locked - t.exp_bm),
  bmoney_locked = LEAST(t.bmoney_locked, t.exp_bm),
  balance_usd = t.balance_usd + GREATEST(0, t.locked_usd - t.exp_usd),
  locked_usd = LEAST(t.locked_usd, t.exp_usd)
FROM target t
WHERE w.user_id = t.user_id;