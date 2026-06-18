-- 1. Columnas IP en tournament_users
ALTER TABLE public.tournament_users
  ADD COLUMN IF NOT EXISTS signup_ip text,
  ADD COLUMN IF NOT EXISTS last_login_ip text,
  ADD COLUMN IF NOT EXISTS last_device_fingerprint text;

CREATE INDEX IF NOT EXISTS idx_tu_signup_ip ON public.tournament_users(signup_ip) WHERE signup_ip IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tu_last_login_ip ON public.tournament_users(last_login_ip) WHERE last_login_ip IS NOT NULL;

-- 2. Tabla fraud flags
CREATE TABLE public.tournament_fraud_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES public.tournaments(id) ON DELETE CASCADE,
  flag_type text NOT NULL CHECK (flag_type IN ('multi_account_ip','copy_trading','hedge','rule_violation','suspicious_pattern','manual')),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','dismissed','confirmed')),
  user_ids uuid[] NOT NULL DEFAULT '{}',
  participant_ids uuid[] NOT NULL DEFAULT '{}',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tff_tournament ON public.tournament_fraud_flags(tournament_id);
CREATE INDEX idx_tff_status ON public.tournament_fraud_flags(status);
CREATE INDEX idx_tff_users ON public.tournament_fraud_flags USING GIN(user_ids);

ALTER TABLE public.tournament_fraud_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage fraud flags"
ON public.tournament_fraud_flags FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

CREATE TRIGGER trg_tournament_fraud_flags_updated_at
BEFORE UPDATE ON public.tournament_fraud_flags
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Tabla disputes
CREATE TABLE public.tournament_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  tournament_id uuid REFERENCES public.tournaments(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('disqualification','prize_not_paid','wrong_rank','technical_issue','kyc_rejected','other')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_review','resolved','rejected')),
  subject text NOT NULL,
  description text NOT NULL,
  evidence_urls text[] DEFAULT '{}',
  admin_response text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_td_user ON public.tournament_disputes(user_id);
CREATE INDEX idx_td_status ON public.tournament_disputes(status);
CREATE INDEX idx_td_tournament ON public.tournament_disputes(tournament_id) WHERE tournament_id IS NOT NULL;

ALTER TABLE public.tournament_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage disputes"
ON public.tournament_disputes FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

CREATE TRIGGER trg_tournament_disputes_updated_at
BEFORE UPDATE ON public.tournament_disputes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Trigger auto-descalificación por max_drawdown
CREATE OR REPLACE FUNCTION public.tournament_check_dd_violation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _max_dd numeric;
  _t_status text;
BEGIN
  IF NEW.max_drawdown_pct IS NULL OR NEW.status = 'disqualified' THEN
    RETURN NEW;
  END IF;

  SELECT (trading_rules->>'max_drawdown_pct')::numeric, status::text
    INTO _max_dd, _t_status
    FROM public.tournaments WHERE id = NEW.tournament_id;

  IF _max_dd IS NULL OR _max_dd <= 0 THEN
    RETURN NEW;
  END IF;

  IF _t_status NOT IN ('running','registration_open') THEN
    RETURN NEW;
  END IF;

  IF NEW.max_drawdown_pct >= _max_dd THEN
    NEW.status := 'disqualified';
    NEW.eliminated_at := now();

    INSERT INTO public.tournament_fraud_flags (
      tournament_id, flag_type, severity, status,
      user_ids, participant_ids, evidence, description
    ) VALUES (
      NEW.tournament_id, 'rule_violation', 'high', 'confirmed',
      ARRAY[NEW.user_id], ARRAY[NEW.id],
      jsonb_build_object('rule','max_drawdown_pct','limit',_max_dd,'observed',NEW.max_drawdown_pct),
      'Descalificación automática: drawdown ' || NEW.max_drawdown_pct::text || '% supera límite ' || _max_dd::text || '%'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tournament_check_dd_violation
BEFORE UPDATE OF max_drawdown_pct ON public.tournament_participants
FOR EACH ROW EXECUTE FUNCTION public.tournament_check_dd_violation();

-- 5. Helper para detectar multi-cuenta por IP (lo llama edge function vía RPC indirecto)
CREATE OR REPLACE FUNCTION public.tournament_detect_ip_collisions()
RETURNS TABLE (
  tournament_id uuid,
  ip text,
  user_ids uuid[],
  participant_ids uuid[]
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
  SELECT 
    p.tournament_id,
    u.last_login_ip AS ip,
    array_agg(DISTINCT u.id) AS user_ids,
    array_agg(DISTINCT p.id) AS participant_ids
  FROM public.tournament_participants p
  JOIN public.tournament_users u ON u.id = p.user_id
  JOIN public.tournaments t ON t.id = p.tournament_id
  WHERE u.last_login_ip IS NOT NULL
    AND t.status IN ('running','registration_open','finished')
    AND p.joined_at > now() - interval '30 days'
  GROUP BY p.tournament_id, u.last_login_ip
  HAVING count(DISTINCT u.id) > 1;
$$;