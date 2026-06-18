
CREATE TABLE public.lead_metrics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL,
  closer_id uuid,
  new_leads int NOT NULL DEFAULT 0,
  contacted_leads int NOT NULL DEFAULT 0,
  won_leads int NOT NULL DEFAULT 0,
  lost_leads int NOT NULL DEFAULT 0,
  conversion_rate numeric(5,2) NOT NULL DEFAULT 0,
  avg_first_contact_minutes numeric(10,2),
  sla_violations int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(snapshot_date, closer_id)
);
CREATE INDEX idx_lead_metrics_daily_date ON public.lead_metrics_daily(snapshot_date);
CREATE INDEX idx_lead_metrics_daily_closer ON public.lead_metrics_daily(closer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_metrics_daily TO authenticated;
GRANT ALL ON public.lead_metrics_daily TO service_role;
ALTER TABLE public.lead_metrics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metrics_admin_all" ON public.lead_metrics_daily FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'admin_ventas'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'admin_ventas'));
CREATE POLICY "metrics_closer_own" ON public.lead_metrics_daily FOR SELECT TO authenticated
  USING (closer_id = auth.uid());

CREATE OR REPLACE FUNCTION public.lead_metrics_aggregate(target_date date DEFAULT (current_date - 1))
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  WITH base AS (
    SELECT
      sl.assigned_to AS closer_id,
      sl.id, sl.created_at, sl.last_contact_at, sl.closed_at,
      sps.is_closed, sps.is_won
    FROM public.stream_leads sl
    LEFT JOIN public.lead_pipeline_stages sps ON sps.id = sl.pipeline_stage_id
  ),
  daily AS (
    SELECT
      closer_id,
      COUNT(*) FILTER (WHERE created_at::date = target_date) AS new_leads,
      COUNT(*) FILTER (WHERE last_contact_at::date = target_date) AS contacted_leads,
      COUNT(*) FILTER (WHERE closed_at::date = target_date AND is_won = true) AS won_leads,
      COUNT(*) FILTER (WHERE closed_at::date = target_date AND is_closed = true AND COALESCE(is_won,false) = false) AS lost_leads,
      AVG(EXTRACT(EPOCH FROM (last_contact_at - created_at))/60.0)
        FILTER (WHERE created_at::date = target_date AND last_contact_at IS NOT NULL) AS avg_min
    FROM base
    GROUP BY closer_id
  ),
  sla AS (
    SELECT closer_id, COUNT(*) AS viol
    FROM public.lead_sla_violations
    WHERE detected_at::date = target_date
    GROUP BY closer_id
  )
  INSERT INTO public.lead_metrics_daily(
    snapshot_date, closer_id, new_leads, contacted_leads, won_leads, lost_leads,
    conversion_rate, avg_first_contact_minutes, sla_violations
  )
  SELECT
    target_date, d.closer_id, d.new_leads, d.contacted_leads, d.won_leads, d.lost_leads,
    CASE WHEN d.new_leads > 0 THEN ROUND(d.won_leads::numeric * 100 / d.new_leads, 2) ELSE 0 END,
    d.avg_min,
    COALESCE(s.viol, 0)
  FROM daily d
  LEFT JOIN sla s ON s.closer_id = d.closer_id
  ON CONFLICT (snapshot_date, closer_id) DO UPDATE SET
    new_leads = EXCLUDED.new_leads,
    contacted_leads = EXCLUDED.contacted_leads,
    won_leads = EXCLUDED.won_leads,
    lost_leads = EXCLUDED.lost_leads,
    conversion_rate = EXCLUDED.conversion_rate,
    avg_first_contact_minutes = EXCLUDED.avg_first_contact_minutes,
    sla_violations = EXCLUDED.sla_violations;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'date', target_date, 'rows', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.lead_top_performers(period_days int DEFAULT 30)
RETURNS TABLE (
  closer_id uuid,
  new_leads bigint,
  won_leads bigint,
  lost_leads bigint,
  conversion_rate numeric,
  avg_first_contact_minutes numeric,
  sla_violations bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    closer_id,
    SUM(new_leads)::bigint,
    SUM(won_leads)::bigint,
    SUM(lost_leads)::bigint,
    CASE WHEN SUM(new_leads) > 0
      THEN ROUND(SUM(won_leads)::numeric * 100 / SUM(new_leads), 2)
      ELSE 0 END,
    ROUND(AVG(avg_first_contact_minutes), 2),
    SUM(sla_violations)::bigint
  FROM public.lead_metrics_daily
  WHERE snapshot_date >= current_date - period_days
    AND closer_id IS NOT NULL
  GROUP BY closer_id
  ORDER BY SUM(won_leads) DESC NULLS LAST;
$$;
