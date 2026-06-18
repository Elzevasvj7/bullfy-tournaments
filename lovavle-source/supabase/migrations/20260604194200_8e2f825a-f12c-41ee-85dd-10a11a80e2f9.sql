
-- ============ lead_enrichment ============
CREATE TABLE IF NOT EXISTS public.lead_enrichment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES public.stream_leads(id) ON DELETE CASCADE,
  detected_language text,
  detected_country_code text,
  detected_timezone text,
  detected_currency text,
  detection_source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lead_enrichment TO authenticated;
GRANT ALL ON public.lead_enrichment TO service_role;
ALTER TABLE public.lead_enrichment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_enrichment_admin_all" ON public.lead_enrichment
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_ventas')
  );
CREATE POLICY "lead_enrichment_closer_own" ON public.lead_enrichment
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.stream_leads sl WHERE sl.id = lead_enrichment.lead_id AND sl.assigned_to = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_lead_enrichment_lead ON public.lead_enrichment(lead_id);

-- ============ lead_notifications ============
CREATE TABLE IF NOT EXISTS public.lead_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.stream_leads(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  subject text,
  content text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lead_notifications TO authenticated;
GRANT ALL ON public.lead_notifications TO service_role;
ALTER TABLE public.lead_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_notifications_admin_all" ON public.lead_notifications
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_ventas')
  );
CREATE POLICY "lead_notifications_closer_own" ON public.lead_notifications
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.stream_leads sl WHERE sl.id = lead_notifications.lead_id AND sl.assigned_to = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_lead_notifications_lead ON public.lead_notifications(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_notifications_status ON public.lead_notifications(status);

-- ============ lead_enrichment_recompute() ============
-- Deriva idioma/país/timezone/divisa a partir del prefijo internacional del teléfono.
CREATE OR REPLACE FUNCTION public.lead_enrichment_recompute()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_processed integer := 0;
  v_lead RECORD;
  v_phone text;
  v_lang text;
  v_country text;
  v_tz text;
  v_curr text;
BEGIN
  FOR v_lead IN
    SELECT sl.id, sl.telefono, sl.language
    FROM public.stream_leads sl
    LEFT JOIN public.lead_enrichment le ON le.lead_id = sl.id
    WHERE le.id IS NULL OR le.updated_at < now() - interval '7 days'
    LIMIT 500
  LOOP
    v_phone := regexp_replace(coalesce(v_lead.telefono, ''), '[^0-9+]', '', 'g');
    v_lang := NULL; v_country := NULL; v_tz := NULL; v_curr := NULL;

    -- Heurísticas por prefijo (cobertura LATAM/ES/EN principales)
    IF v_phone LIKE '+57%' OR v_phone LIKE '57%' THEN
      v_lang := 'es'; v_country := 'CO'; v_tz := 'America/Bogota'; v_curr := 'COP';
    ELSIF v_phone LIKE '+52%' OR v_phone LIKE '52%' THEN
      v_lang := 'es'; v_country := 'MX'; v_tz := 'America/Mexico_City'; v_curr := 'MXN';
    ELSIF v_phone LIKE '+54%' THEN
      v_lang := 'es'; v_country := 'AR'; v_tz := 'America/Argentina/Buenos_Aires'; v_curr := 'ARS';
    ELSIF v_phone LIKE '+56%' THEN
      v_lang := 'es'; v_country := 'CL'; v_tz := 'America/Santiago'; v_curr := 'CLP';
    ELSIF v_phone LIKE '+51%' THEN
      v_lang := 'es'; v_country := 'PE'; v_tz := 'America/Lima'; v_curr := 'PEN';
    ELSIF v_phone LIKE '+58%' THEN
      v_lang := 'es'; v_country := 'VE'; v_tz := 'America/Caracas'; v_curr := 'VES';
    ELSIF v_phone LIKE '+593%' THEN
      v_lang := 'es'; v_country := 'EC'; v_tz := 'America/Guayaquil'; v_curr := 'USD';
    ELSIF v_phone LIKE '+591%' THEN
      v_lang := 'es'; v_country := 'BO'; v_tz := 'America/La_Paz'; v_curr := 'BOB';
    ELSIF v_phone LIKE '+595%' THEN
      v_lang := 'es'; v_country := 'PY'; v_tz := 'America/Asuncion'; v_curr := 'PYG';
    ELSIF v_phone LIKE '+598%' THEN
      v_lang := 'es'; v_country := 'UY'; v_tz := 'America/Montevideo'; v_curr := 'UYU';
    ELSIF v_phone LIKE '+506%' THEN
      v_lang := 'es'; v_country := 'CR'; v_tz := 'America/Costa_Rica'; v_curr := 'CRC';
    ELSIF v_phone LIKE '+507%' THEN
      v_lang := 'es'; v_country := 'PA'; v_tz := 'America/Panama'; v_curr := 'PAB';
    ELSIF v_phone LIKE '+503%' THEN
      v_lang := 'es'; v_country := 'SV'; v_tz := 'America/El_Salvador'; v_curr := 'USD';
    ELSIF v_phone LIKE '+502%' THEN
      v_lang := 'es'; v_country := 'GT'; v_tz := 'America/Guatemala'; v_curr := 'GTQ';
    ELSIF v_phone LIKE '+504%' THEN
      v_lang := 'es'; v_country := 'HN'; v_tz := 'America/Tegucigalpa'; v_curr := 'HNL';
    ELSIF v_phone LIKE '+505%' THEN
      v_lang := 'es'; v_country := 'NI'; v_tz := 'America/Managua'; v_curr := 'NIO';
    ELSIF v_phone LIKE '+34%' THEN
      v_lang := 'es'; v_country := 'ES'; v_tz := 'Europe/Madrid'; v_curr := 'EUR';
    ELSIF v_phone LIKE '+1%' THEN
      v_lang := 'en'; v_country := 'US'; v_tz := 'America/New_York'; v_curr := 'USD';
    ELSIF v_phone LIKE '+44%' THEN
      v_lang := 'en'; v_country := 'GB'; v_tz := 'Europe/London'; v_curr := 'GBP';
    ELSIF v_phone LIKE '+55%' THEN
      v_lang := 'pt'; v_country := 'BR'; v_tz := 'America/Sao_Paulo'; v_curr := 'BRL';
    ELSIF v_phone LIKE '+351%' THEN
      v_lang := 'pt'; v_country := 'PT'; v_tz := 'Europe/Lisbon'; v_curr := 'EUR';
    END IF;

    -- Si no hubo match por teléfono, conservar el idioma del lead si existe
    IF v_lang IS NULL AND v_lead.language IS NOT NULL THEN
      v_lang := v_lead.language;
    END IF;

    INSERT INTO public.lead_enrichment(lead_id, detected_language, detected_country_code, detected_timezone, detected_currency, detection_source, updated_at)
    VALUES (v_lead.id, v_lang, v_country, v_tz, v_curr, CASE WHEN v_country IS NOT NULL THEN 'phone_prefix' ELSE 'fallback' END, now())
    ON CONFLICT (lead_id) DO UPDATE
      SET detected_language = EXCLUDED.detected_language,
          detected_country_code = EXCLUDED.detected_country_code,
          detected_timezone = EXCLUDED.detected_timezone,
          detected_currency = EXCLUDED.detected_currency,
          detection_source = EXCLUDED.detection_source,
          updated_at = now();

    -- Refleja idioma en el lead si no estaba seteado
    IF v_lang IS NOT NULL AND (v_lead.language IS NULL OR v_lead.language = '') THEN
      UPDATE public.stream_leads SET language = v_lang WHERE id = v_lead.id;
    END IF;

    v_processed := v_processed + 1;
  END LOOP;

  RETURN v_processed;
END;
$$;

REVOKE ALL ON FUNCTION public.lead_enrichment_recompute() FROM public;
GRANT EXECUTE ON FUNCTION public.lead_enrichment_recompute() TO service_role;

CREATE TRIGGER trg_lead_enrichment_updated_at
  BEFORE UPDATE ON public.lead_enrichment
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
