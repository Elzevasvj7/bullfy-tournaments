
-- Add tracking columns to experience_leads
ALTER TABLE public.experience_leads
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_by uuid,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz,
  ADD COLUMN IF NOT EXISTS discarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS notas_bd text;

-- Create bitácora table for lead history
CREATE TABLE public.experience_lead_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.experience_leads(id) ON DELETE CASCADE,
  action text NOT NULL,
  details text,
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.experience_lead_history ENABLE ROW LEVEL SECURITY;

-- BD and Admin BD can read history
CREATE POLICY "Authenticated can read lead history"
  ON public.experience_lead_history
  FOR SELECT TO authenticated
  USING (true);

-- Only service role or admin_bd can insert history (we'll insert via edge function or directly)
CREATE POLICY "Authenticated can insert lead history"
  ON public.experience_lead_history
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin_bd'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'global_admin'::app_role)
    OR has_role(auth.uid(), 'bd'::app_role)
  );
