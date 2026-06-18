
-- ============================================================
-- F5 Lead System 2.0 — Inteligencia y predicción
-- ============================================================

-- 1) lead_scoring_recompute()
CREATE OR REPLACE FUNCTION public.lead_scoring_recompute()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int := 0;
BEGIN
  WITH features AS (
    SELECT
      sl.id,
      sl.opportunity_score AS old_score,
      EXTRACT(EPOCH FROM (now() - sl.created_at))/86400.0 AS days_in_pipeline,
      COALESCE(sl.contact_attempts, 0) AS attempts,
      (SELECT COUNT(*) FROM public.lead_calls lc WHERE lc.lead_id = sl.id) AS call_count,
      (SELECT COUNT(*) FROM public.stream_lead_participations p WHERE p.lead_id = sl.id) AS live_participations,
      (SELECT MAX(lc.created_at) FROM public.lead_calls lc WHERE lc.lead_id = sl.id) AS last_call_at
    FROM public.stream_leads sl
    WHERE sl.status NOT IN ('cerrado','perdido')
  ),
  scored AS (
    SELECT
      id,
      old_score,
      LEAST(100, GREATEST(0,
        50
        + LEAST(20, live_participations * 5)
        + CASE
            WHEN call_count = 0 AND days_in_pipeline > 1 THEN -15
            WHEN call_count > 0 AND last_call_at > now() - interval '3 days' THEN 15
            WHEN call_count > 0 AND last_call_at > now() - interval '7 days' THEN 5
            ELSE 0
          END
        + CASE
            WHEN attempts >= 5 AND call_count = 0 THEN -20
            WHEN attempts >= 3 AND call_count = 0 THEN -10
            ELSE 0
          END
        + CASE
            WHEN days_in_pipeline > 14 THEN -15
            WHEN days_in_pipeline > 7 THEN -5
            ELSE 0
          END
      ))::int AS new_score
    FROM features
  )
  UPDATE public.stream_leads sl
  SET opportunity_score = s.new_score,
      updated_at = now()
  FROM scored s
  WHERE sl.id = s.id
    AND COALESCE(sl.opportunity_score, -1) <> s.new_score;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object('updated', v_updated, 'ran_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.lead_scoring_recompute() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lead_scoring_recompute() TO service_role;

-- 2) lead_conversion_predictions
CREATE TABLE IF NOT EXISTS public.lead_conversion_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.stream_leads(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  probability_close numeric(5,2) NOT NULL DEFAULT 0,
  predicted_close_date date,
  risk_factors text[] DEFAULT '{}',
  recommended_action text,
  model text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_lcp_lead ON public.lead_conversion_predictions(lead_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_lcp_date ON public.lead_conversion_predictions(snapshot_date DESC);

GRANT SELECT ON public.lead_conversion_predictions TO authenticated;
GRANT ALL ON public.lead_conversion_predictions TO service_role;
ALTER TABLE public.lead_conversion_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Closer ve predicciones de sus leads"
ON public.lead_conversion_predictions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'global_admin')
  OR public.has_role(auth.uid(),'admin_ventas')
  OR EXISTS (
    SELECT 1 FROM public.stream_leads sl
    WHERE sl.id = lead_conversion_predictions.lead_id
      AND sl.assigned_to = auth.uid()
  )
);

-- 3) lead_closer_coaching
CREATE TABLE IF NOT EXISTS public.lead_closer_coaching (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_user_id uuid NOT NULL,
  week_start date NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  strengths text[] DEFAULT '{}',
  weaknesses text[] DEFAULT '{}',
  recommendations text[] DEFAULT '{}',
  summary text,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (closer_user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_lcc_user ON public.lead_closer_coaching(closer_user_id, week_start DESC);

GRANT SELECT ON public.lead_closer_coaching TO authenticated;
GRANT ALL ON public.lead_closer_coaching TO service_role;
ALTER TABLE public.lead_closer_coaching ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Closer ve su propio coaching"
ON public.lead_closer_coaching FOR SELECT TO authenticated
USING (
  closer_user_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'global_admin')
  OR public.has_role(auth.uid(),'admin_ventas')
);
