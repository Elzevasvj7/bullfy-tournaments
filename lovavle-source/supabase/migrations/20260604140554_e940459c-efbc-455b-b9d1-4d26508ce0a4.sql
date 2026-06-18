
-- F4 Lead System 2.0: Métricas closer + Alertas + Reportes scheduler
-- DB-only. No RLS para closer (frontend usará admin/manager). No frontend en este paso.

-- 1) Vista materializada métricas diarias del closer
DROP MATERIALIZED VIEW IF EXISTS public.closer_metrics_daily;
CREATE MATERIALIZED VIEW public.closer_metrics_daily AS
WITH base AS (
  SELECT
    sl.assigned_to AS closer_id,
    date_trunc('day', sl.assigned_at)::date AS day,
    COUNT(*) FILTER (WHERE sl.assigned_to IS NOT NULL) AS leads_tomados,
    COUNT(*) FILTER (WHERE sl.last_contact_at IS NOT NULL) AS leads_contactados,
    COUNT(*) FILTER (WHERE sl.closed_at IS NOT NULL AND sl.closed_by = sl.assigned_to) AS leads_cerrados,
    AVG(EXTRACT(EPOCH FROM (sl.last_contact_at - sl.assigned_at)))
      FILTER (WHERE sl.last_contact_at IS NOT NULL AND sl.assigned_at IS NOT NULL) AS avg_seconds_to_first_contact,
    COUNT(DISTINCT sl.partner_portal_id) FILTER (WHERE sl.partner_portal_id IS NOT NULL) AS comunidades_trabajadas
  FROM public.stream_leads sl
  WHERE sl.assigned_to IS NOT NULL
    AND sl.assigned_at IS NOT NULL
  GROUP BY sl.assigned_to, date_trunc('day', sl.assigned_at)::date
)
SELECT
  closer_id,
  day,
  leads_tomados,
  leads_contactados,
  leads_cerrados,
  CASE WHEN leads_tomados > 0 THEN ROUND((leads_contactados::numeric / leads_tomados) * 100, 2) ELSE 0 END AS tasa_respuesta_pct,
  CASE WHEN leads_tomados > 0 THEN ROUND((leads_cerrados::numeric / leads_tomados) * 100, 2) ELSE 0 END AS tasa_cierre_pct,
  avg_seconds_to_first_contact,
  comunidades_trabajadas
FROM base;

CREATE UNIQUE INDEX IF NOT EXISTS idx_closer_metrics_daily_pk
  ON public.closer_metrics_daily(closer_id, day);
CREATE INDEX IF NOT EXISTS idx_closer_metrics_daily_day
  ON public.closer_metrics_daily(day DESC);

GRANT SELECT ON public.closer_metrics_daily TO authenticated;
GRANT ALL ON public.closer_metrics_daily TO service_role;

-- 2) Función refresh segura
CREATE OR REPLACE FUNCTION public.refresh_closer_metrics_daily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.closer_metrics_daily;
EXCEPTION WHEN OTHERS THEN
  REFRESH MATERIALIZED VIEW public.closer_metrics_daily;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_closer_metrics_daily() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_closer_metrics_daily() TO service_role;

-- 3) Motor de alertas del Lead System (notifications bell)
--    Genera alertas para closers/managers:
--      a) Lead caliente (score>=70) sin contactar > 15 min
--      b) Comunidad con >=5 leads disponibles sin tomar
--      c) Closer con >=5 seguimientos hoy
CREATE OR REPLACE FUNCTION public.lead_system_alerts_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hot int := 0;
  v_pending int := 0;
  v_followups int := 0;
BEGIN
  -- a) Hot leads asignados sin contactar (>15m, score>=70)
  WITH hot AS (
    SELECT sl.id, sl.assigned_to, sl.nombre
    FROM public.stream_leads sl
    WHERE sl.assigned_to IS NOT NULL
      AND sl.opportunity_score >= 70
      AND sl.last_contact_at IS NULL
      AND sl.taken_at IS NOT NULL
      AND sl.taken_at < now() - interval '15 minutes'
      AND sl.closed_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = sl.assigned_to
          AND n.reference_id = sl.id
          AND n.type = 'lead_hot_uncontacted'
          AND n.created_at > now() - interval '4 hours'
      )
  ), ins AS (
    INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
    SELECT assigned_to, 'lead_hot_uncontacted', 'Lead caliente sin contactar',
           'El lead "' || nombre || '" tiene score alto y lleva >15 min sin contacto.',
           id, 'stream_lead'
    FROM hot
    RETURNING 1
  )
  SELECT count(*) INTO v_hot FROM ins;

  -- b) Comunidades con muchos leads disponibles -> avisa a closers asignados a esa comunidad
  WITH backlog AS (
    SELECT sl.partner_portal_id, count(*) AS pendientes
    FROM public.stream_leads sl
    WHERE sl.assigned_to IS NULL
      AND sl.partner_portal_id IS NOT NULL
      AND sl.closed_at IS NULL
      AND sl.created_at > now() - interval '7 days'
    GROUP BY sl.partner_portal_id
    HAVING count(*) >= 5
  ), targets AS (
    SELECT cca.closer_user_id AS user_id, b.partner_portal_id, b.pendientes,
           pp.name AS portal_name
    FROM backlog b
    JOIN public.closer_community_assignments cca ON cca.portal_id = b.partner_portal_id
    JOIN public.partner_portals pp ON pp.id = b.partner_portal_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = cca.closer_user_id
        AND n.reference_id = b.partner_portal_id
        AND n.type = 'community_backlog'
        AND n.created_at > now() - interval '6 hours'
    )
  ), ins2 AS (
    INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
    SELECT user_id, 'community_backlog', 'Comunidad con leads pendientes',
           portal_name || ' tiene ' || pendientes || ' leads disponibles sin tomar.',
           partner_portal_id, 'partner_portal'
    FROM targets
    RETURNING 1
  )
  SELECT count(*) INTO v_pending FROM ins2;

  -- c) Closers con muchos seguimientos hoy
  WITH heavy AS (
    SELECT sl.assigned_to AS user_id, count(*) AS cnt
    FROM public.stream_leads sl
    WHERE sl.assigned_to IS NOT NULL
      AND sl.closed_at IS NULL
      AND date_trunc('day', coalesce(sl.last_contact_at, sl.taken_at)) = date_trunc('day', now())
    GROUP BY sl.assigned_to
    HAVING count(*) >= 5
  ), ins3 AS (
    INSERT INTO public.notifications (user_id, type, title, message, reference_type)
    SELECT user_id, 'closer_daily_load', 'Carga diaria alta',
           'Tienes ' || cnt || ' leads activos hoy. Prioriza seguimientos.',
           'closer_metrics'
    FROM heavy
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = heavy.user_id
        AND n.type = 'closer_daily_load'
        AND n.created_at > now() - interval '8 hours'
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_followups FROM ins3;

  RETURN jsonb_build_object(
    'hot_uncontacted', v_hot,
    'community_backlog', v_pending,
    'closer_load', v_followups,
    'ran_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lead_system_alerts_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lead_system_alerts_tick() TO service_role;

-- 4) Reporte mensual: snapshot resumen por closer y comunidad
CREATE TABLE IF NOT EXISTS public.lead_monthly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(period_start, period_end)
);

GRANT SELECT ON public.lead_monthly_reports TO authenticated;
GRANT ALL ON public.lead_monthly_reports TO service_role;

ALTER TABLE public.lead_monthly_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read monthly reports" ON public.lead_monthly_reports;
CREATE POLICY "Admins read monthly reports"
ON public.lead_monthly_reports FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'global_admin')
  OR public.has_role(auth.uid(), 'admin_ventas')
);

CREATE OR REPLACE FUNCTION public.generate_lead_monthly_report(_period_start date DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start date;
  v_end date;
  v_payload jsonb;
  v_id uuid;
BEGIN
  v_start := COALESCE(_period_start, date_trunc('month', now() - interval '1 month')::date);
  v_end := (v_start + interval '1 month - 1 day')::date;

  WITH by_closer AS (
    SELECT
      sl.assigned_to AS closer_id,
      p.nombre AS closer_nombre,
      count(*) AS tomados,
      count(*) FILTER (WHERE sl.last_contact_at IS NOT NULL) AS contactados,
      count(*) FILTER (WHERE sl.closed_at IS NOT NULL AND sl.closed_by = sl.assigned_to) AS cerrados
    FROM public.stream_leads sl
    LEFT JOIN public.profiles p ON p.id = sl.assigned_to
    WHERE sl.assigned_at::date BETWEEN v_start AND v_end
      AND sl.assigned_to IS NOT NULL
    GROUP BY sl.assigned_to, p.nombre
  ),
  by_community AS (
    SELECT
      sl.partner_portal_id,
      pp.name AS portal_name,
      count(*) AS leads,
      count(*) FILTER (WHERE sl.closed_at IS NOT NULL) AS cerrados,
      count(*) FILTER (WHERE sl.assigned_to IS NULL) AS sin_tomar
    FROM public.stream_leads sl
    LEFT JOIN public.partner_portals pp ON pp.id = sl.partner_portal_id
    WHERE sl.created_at::date BETWEEN v_start AND v_end
      AND sl.partner_portal_id IS NOT NULL
    GROUP BY sl.partner_portal_id, pp.name
  ),
  totals AS (
    SELECT
      count(*) AS total_leads,
      count(*) FILTER (WHERE closed_at IS NOT NULL) AS total_cerrados,
      count(*) FILTER (WHERE assigned_to IS NULL) AS total_sin_tomar,
      count(*) FILTER (WHERE source = 'tournament') AS total_torneo
    FROM public.stream_leads
    WHERE created_at::date BETWEEN v_start AND v_end
  )
  SELECT jsonb_build_object(
    'totals', (SELECT to_jsonb(totals) FROM totals),
    'by_closer', COALESCE((SELECT jsonb_agg(to_jsonb(by_closer)) FROM by_closer), '[]'::jsonb),
    'by_community', COALESCE((SELECT jsonb_agg(to_jsonb(by_community)) FROM by_community), '[]'::jsonb)
  ) INTO v_payload;

  INSERT INTO public.lead_monthly_reports (period_start, period_end, payload)
  VALUES (v_start, v_end, v_payload)
  ON CONFLICT (period_start, period_end)
  DO UPDATE SET payload = EXCLUDED.payload, created_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_lead_monthly_report(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_lead_monthly_report(date) TO service_role;
