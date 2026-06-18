
DROP POLICY IF EXISTS "read_active_campaigns" ON public.marketing_campaigns;

CREATE POLICY "read_active_campaigns" ON public.marketing_campaigns
FOR SELECT TO authenticated
USING (status IN ('active', 'completed', 'stopped'));
