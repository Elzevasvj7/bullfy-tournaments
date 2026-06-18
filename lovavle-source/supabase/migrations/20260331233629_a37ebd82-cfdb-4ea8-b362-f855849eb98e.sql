
-- 1. Allow anonymous users to register as pending in partner_users
CREATE POLICY "Anyone can register as pending"
ON public.partner_users FOR INSERT
TO anon
WITH CHECK (status = 'pending');

-- 2. Create trigger to auto-create stream_lead when partner_user registers
CREATE OR REPLACE FUNCTION public.auto_create_stream_lead_on_partner_register()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _default_stage_id uuid;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT id INTO _default_stage_id FROM public.lead_pipeline_stages WHERE is_default = true LIMIT 1;
    IF _default_stage_id IS NULL THEN
      SELECT id INTO _default_stage_id FROM public.lead_pipeline_stages ORDER BY display_order LIMIT 1;
    END IF;

    INSERT INTO public.stream_leads (nombre, correo, source, partner_portal_id, is_registered_partner, pipeline_stage_id, opportunity_score, stream_count)
    VALUES (NEW.nombre, NEW.email, 'partner_portal', NEW.portal_id, true, _default_stage_id, 30, 0)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_create_stream_lead
AFTER INSERT ON public.partner_users
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_stream_lead_on_partner_register();

-- 3. Allow portal admins (IB owners) to read their own portal's leads
CREATE POLICY "Portal admins can read own portal leads"
ON public.stream_leads FOR SELECT
TO authenticated
USING (
  partner_portal_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM partner_portals pp
    JOIN ibs i ON i.id = pp.ib_id
    WHERE pp.id = stream_leads.partner_portal_id
    AND i.created_by = auth.uid()
  )
);
