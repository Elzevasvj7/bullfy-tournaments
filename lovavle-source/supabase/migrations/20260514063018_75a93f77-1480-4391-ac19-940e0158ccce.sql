
-- 1. KYC documents
CREATE TABLE public.tournament_kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('id_front','id_back','selfie','address_proof')),
  file_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tkyc_user ON public.tournament_kyc_documents(user_id);
CREATE INDEX idx_tkyc_status ON public.tournament_kyc_documents(status);
ALTER TABLE public.tournament_kyc_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kyc_admin_all" ON public.tournament_kyc_documents
  FOR ALL TO authenticated
  USING (is_global_admin() OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (is_global_admin() OR has_role(auth.uid(),'admin'::app_role));

-- 2. Withdrawals
CREATE TABLE public.tournament_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  amount_usd numeric(14,2) NOT NULL CHECK (amount_usd > 0),
  fee_usd numeric(14,2) NOT NULL DEFAULT 0,
  net_usd numeric(14,2) NOT NULL,
  wallet_address text NOT NULL,
  network text NOT NULL DEFAULT 'TRC20',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','rejected','cancelled')),
  tx_hash text,
  processed_by uuid,
  processed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tw_user ON public.tournament_withdrawals(user_id);
CREATE INDEX idx_tw_status ON public.tournament_withdrawals(status);
ALTER TABLE public.tournament_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tw_admin_all" ON public.tournament_withdrawals
  FOR ALL TO authenticated
  USING (is_global_admin() OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (is_global_admin() OR has_role(auth.uid(),'admin'::app_role));

-- 3. Admin audit
CREATE TABLE public.tournament_admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_taa_admin ON public.tournament_admin_audit(admin_user_id);
CREATE INDEX idx_taa_target ON public.tournament_admin_audit(target_type, target_id);
ALTER TABLE public.tournament_admin_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "taa_admin_read" ON public.tournament_admin_audit
  FOR SELECT TO authenticated
  USING (is_global_admin() OR has_role(auth.uid(),'admin'::app_role));

-- 4. Extend tournament_payments and tournament_users
ALTER TABLE public.tournament_payments
  ADD COLUMN IF NOT EXISTS gateway_session_id text,
  ADD COLUMN IF NOT EXISTS gateway_payment_url text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_tpay_session ON public.tournament_payments(gateway_session_id);

ALTER TABLE public.tournament_users
  ADD COLUMN IF NOT EXISTS kyc_submitted_at timestamptz;

-- 5. Storage bucket KYC (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tournament-kyc', 'tournament-kyc', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "kyc_admin_storage_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'tournament-kyc' AND (is_global_admin() OR has_role(auth.uid(),'admin'::app_role)));

-- 6. Update timestamps triggers
CREATE TRIGGER trg_tkyc_updated BEFORE UPDATE ON public.tournament_kyc_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tw_updated BEFORE UPDATE ON public.tournament_withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Auto-create CRM lead when tournament_user is created
CREATE OR REPLACE FUNCTION public.tournament_user_to_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage uuid;
  v_lead_id uuid;
  v_existing uuid;
BEGIN
  -- Reuse if email already a lead
  SELECT id INTO v_existing FROM public.stream_leads
   WHERE lower(correo) = lower(NEW.email) LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE public.tournament_users SET lead_id = v_existing WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT id INTO v_stage FROM public.lead_pipeline_stages
   WHERE is_default = true ORDER BY display_order LIMIT 1;

  INSERT INTO public.stream_leads (nombre, correo, telefono, source, pipeline_stage_id, opportunity_score, notes)
  VALUES (NEW.full_name, NEW.email, NEW.phone, 'tournament', v_stage, 25, 'Lead generado por Bullfy Tournament')
  RETURNING id INTO v_lead_id;

  UPDATE public.tournament_users SET lead_id = v_lead_id WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tu_to_lead AFTER INSERT ON public.tournament_users
  FOR EACH ROW EXECUTE FUNCTION public.tournament_user_to_lead();

-- 8. Admin audit helper
CREATE OR REPLACE FUNCTION public.log_tournament_admin_action(
  _action text, _target_type text, _target_id uuid, _payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.tournament_admin_audit (admin_user_id, action, target_type, target_id, payload)
  VALUES (COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), _action, _target_type, _target_id, _payload)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
