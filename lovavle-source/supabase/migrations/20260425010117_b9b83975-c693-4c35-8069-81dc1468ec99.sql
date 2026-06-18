
-- ============================================================
-- FASE 1: Sistema MLM Uni-Nivel Modular para Partner Portal
-- ============================================================

-- ============================================================
-- 1. portal_mlm_config — Configuración global por portal
-- ============================================================
CREATE TABLE public.portal_mlm_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portal_id UUID NOT NULL UNIQUE REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  active_levels INT NOT NULL DEFAULT 3 CHECK (active_levels BETWEEN 1 AND 10),
  refund_window_days INT NOT NULL DEFAULT 7 CHECK (refund_window_days BETWEEN 1 AND 30),
  -- % del total de la venta que va al pool MLM (resto va a portal_owner / platform según revenue_splits)
  mlm_pool_percentage NUMERIC(5,2) NOT NULL DEFAULT 10.00 CHECK (mlm_pool_percentage BETWEEN 0 AND 100),
  -- Política para comisiones huérfanas (sin upline disponible)
  orphan_policy TEXT NOT NULL DEFAULT 'portal_owner' CHECK (orphan_policy IN ('portal_owner', 'platform')),
  -- Fee fijo de retiro (lo retiene Bullfy plataforma)
  withdrawal_fee_usdt NUMERIC(10,2) NOT NULL DEFAULT 1.00,
  min_withdrawal_usdt NUMERIC(10,2) NOT NULL DEFAULT 10.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_mlm_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portal owners view own MLM config"
  ON public.portal_mlm_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs i ON i.id = pp.ib_id
      WHERE pp.id = portal_mlm_config.portal_id
        AND i.created_by = auth.uid()
    )
    OR public.has_role(auth.uid(), 'global_admin')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Portal owners manage own MLM config"
  ON public.portal_mlm_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs i ON i.id = pp.ib_id
      WHERE pp.id = portal_mlm_config.portal_id
        AND i.created_by = auth.uid()
    )
    OR public.has_role(auth.uid(), 'global_admin')
  );

CREATE TRIGGER update_portal_mlm_config_updated_at
  BEFORE UPDATE ON public.portal_mlm_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. portal_mlm_levels — % por nivel
-- ============================================================
CREATE TABLE public.portal_mlm_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portal_id UUID NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  level_number INT NOT NULL CHECK (level_number BETWEEN 1 AND 10),
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (portal_id, level_number)
);

ALTER TABLE public.portal_mlm_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view MLM levels of enabled portals"
  ON public.portal_mlm_levels FOR SELECT
  USING (true);

CREATE POLICY "Portal owners manage MLM levels"
  ON public.portal_mlm_levels FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs i ON i.id = pp.ib_id
      WHERE pp.id = portal_mlm_levels.portal_id
        AND i.created_by = auth.uid()
    )
    OR public.has_role(auth.uid(), 'global_admin')
  );

CREATE TRIGGER update_portal_mlm_levels_updated_at
  BEFORE UPDATE ON public.portal_mlm_levels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger de validación: la suma de % por portal no puede pasar de 100
CREATE OR REPLACE FUNCTION public.validate_mlm_levels_sum()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(percentage), 0) INTO _total
  FROM public.portal_mlm_levels
  WHERE portal_id = NEW.portal_id
    AND enabled = true
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  IF (_total + NEW.percentage) > 100 THEN
    RAISE EXCEPTION 'La suma de porcentajes MLM del portal no puede exceder 100%% (intentado: %)', (_total + NEW.percentage);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_mlm_levels_sum_trigger
  BEFORE INSERT OR UPDATE ON public.portal_mlm_levels
  FOR EACH ROW EXECUTE FUNCTION public.validate_mlm_levels_sum();

-- ============================================================
-- 3. portal_mlm_referrals — Estructura de la red
-- ============================================================
CREATE TABLE public.portal_mlm_referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portal_id UUID NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.partner_users(id) ON DELETE CASCADE,
  sponsor_id UUID REFERENCES public.partner_users(id) ON DELETE SET NULL,
  -- Cadena de upline pre-calculada para queries rápidos (array de partner_user IDs, índice 0 = nivel 1)
  upline_chain UUID[] NOT NULL DEFAULT '{}',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (portal_id, user_id)
);

CREATE INDEX idx_mlm_referrals_sponsor ON public.portal_mlm_referrals(sponsor_id);
CREATE INDEX idx_mlm_referrals_portal_user ON public.portal_mlm_referrals(portal_id, user_id);
CREATE INDEX idx_mlm_referrals_upline_chain ON public.portal_mlm_referrals USING GIN(upline_chain);

ALTER TABLE public.portal_mlm_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portal owners view all referrals of their portal"
  ON public.portal_mlm_referrals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs i ON i.id = pp.ib_id
      WHERE pp.id = portal_mlm_referrals.portal_id
        AND i.created_by = auth.uid()
    )
    OR public.has_role(auth.uid(), 'global_admin')
    OR public.has_role(auth.uid(), 'admin')
  );

-- Las inserciones se hacen vía edge function (service_role) porque partner_users no son auth.users

-- ============================================================
-- 4. portal_mlm_commissions — Comisiones generadas
-- ============================================================
CREATE TABLE public.portal_mlm_commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portal_id UUID NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.portal_orders(id) ON DELETE SET NULL,
  -- Beneficiario de la comisión (puede ser un partner_user o el portal_owner)
  beneficiary_user_id UUID REFERENCES public.partner_users(id) ON DELETE SET NULL,
  beneficiary_type TEXT NOT NULL CHECK (beneficiary_type IN ('partner_user', 'portal_owner', 'platform')),
  -- Origen: usuario que generó la venta
  source_user_id UUID REFERENCES public.partner_users(id) ON DELETE SET NULL,
  level_number INT, -- NULL si es portal_owner/platform (no MLM)
  percentage NUMERIC(5,2) NOT NULL,
  base_amount NUMERIC(12,2) NOT NULL, -- Monto sobre el cual se calculó
  commission_amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USDT',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'paid', 'reversed', 'cancelled')),
  available_at TIMESTAMPTZ, -- cuando termine la refund window pasa a available
  paid_at TIMESTAMPTZ,
  reversed_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mlm_commissions_beneficiary ON public.portal_mlm_commissions(beneficiary_user_id, status);
CREATE INDEX idx_mlm_commissions_order ON public.portal_mlm_commissions(order_id);
CREATE INDEX idx_mlm_commissions_status_available ON public.portal_mlm_commissions(status, available_at) WHERE status = 'pending';

ALTER TABLE public.portal_mlm_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portal owners view all commissions of their portal"
  ON public.portal_mlm_commissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs i ON i.id = pp.ib_id
      WHERE pp.id = portal_mlm_commissions.portal_id
        AND i.created_by = auth.uid()
    )
    OR public.has_role(auth.uid(), 'global_admin')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER update_portal_mlm_commissions_updated_at
  BEFORE UPDATE ON public.portal_mlm_commissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. portal_user_wallets — eWallet interna por usuario
-- ============================================================
CREATE TABLE public.portal_user_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portal_id UUID NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.partner_users(id) ON DELETE CASCADE,
  pending_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  available_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_earned NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_withdrawn NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Wallet externa USDT TRC20 (única por usuario)
  external_wallet_address TEXT,
  external_wallet_verified_at TIMESTAMPTZ,
  currency TEXT NOT NULL DEFAULT 'USDT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (portal_id, user_id)
);

CREATE INDEX idx_user_wallets_user ON public.portal_user_wallets(user_id);

ALTER TABLE public.portal_user_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portal owners view wallets of their portal"
  ON public.portal_user_wallets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs i ON i.id = pp.ib_id
      WHERE pp.id = portal_user_wallets.portal_id
        AND i.created_by = auth.uid()
    )
    OR public.has_role(auth.uid(), 'global_admin')
  );

CREATE TRIGGER update_portal_user_wallets_updated_at
  BEFORE UPDATE ON public.portal_user_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 6. portal_wallet_transactions — Histórico de movimientos
-- ============================================================
CREATE TABLE public.portal_wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.portal_user_wallets(id) ON DELETE CASCADE,
  portal_id UUID NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.partner_users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'commission_pending',     -- Comisión generada (entra a pending)
    'release_to_available',   -- Pasa de pending a available al cumplir refund window
    'withdrawal_request',     -- Usuario solicita retiro (resta de available)
    'withdrawal_completed',   -- Coinsbuy confirma envío
    'withdrawal_failed',      -- Reintegro a available si falla
    'platform_fee',           -- Fee retenido por Bullfy
    'refund_reversal',        -- Reverso por refund de cliente
    'manual_adjustment'       -- Ajuste manual del admin
  )),
  amount NUMERIC(12,2) NOT NULL,
  balance_after_pending NUMERIC(12,2) NOT NULL,
  balance_after_available NUMERIC(12,2) NOT NULL,
  reference_id UUID, -- commission_id, withdrawal_id, etc.
  reference_type TEXT, -- 'commission', 'withdrawal', etc.
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallet_tx_wallet ON public.portal_wallet_transactions(wallet_id, created_at DESC);
CREATE INDEX idx_wallet_tx_user ON public.portal_wallet_transactions(user_id, created_at DESC);

ALTER TABLE public.portal_wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portal owners view wallet transactions of their portal"
  ON public.portal_wallet_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs i ON i.id = pp.ib_id
      WHERE pp.id = portal_wallet_transactions.portal_id
        AND i.created_by = auth.uid()
    )
    OR public.has_role(auth.uid(), 'global_admin')
  );

-- ============================================================
-- 7. portal_withdrawal_requests — Solicitudes de retiro
-- ============================================================
CREATE TABLE public.portal_withdrawal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portal_id UUID NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.partner_users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES public.portal_user_wallets(id) ON DELETE CASCADE,
  request_number TEXT UNIQUE,
  amount_requested NUMERIC(12,2) NOT NULL CHECK (amount_requested > 0),
  fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_net NUMERIC(12,2) NOT NULL, -- amount_requested - fee_amount
  currency TEXT NOT NULL DEFAULT 'USDT',
  network TEXT NOT NULL DEFAULT 'TRC20' CHECK (network = 'TRC20'),
  destination_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',     -- Esperando proceso
    'processing',  -- Enviado a Coinsbuy
    'completed',   -- Confirmado en blockchain
    'failed',      -- Falló (se reintegra)
    'cancelled'    -- Cancelado por el usuario
  )),
  -- Tracking Coinsbuy
  coinsbuy_payout_id TEXT,
  coinsbuy_tx_hash TEXT,
  coinsbuy_response JSONB,
  failure_reason TEXT,
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_withdrawal_user ON public.portal_withdrawal_requests(user_id, created_at DESC);
CREATE INDEX idx_withdrawal_status ON public.portal_withdrawal_requests(status, created_at);

ALTER TABLE public.portal_withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portal owners view withdrawals of their portal"
  ON public.portal_withdrawal_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs i ON i.id = pp.ib_id
      WHERE pp.id = portal_withdrawal_requests.portal_id
        AND i.created_by = auth.uid()
    )
    OR public.has_role(auth.uid(), 'global_admin')
  );

CREATE TRIGGER update_portal_withdrawal_requests_updated_at
  BEFORE UPDATE ON public.portal_withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generación de request_number tipo WD-XXXXXX por portal
CREATE OR REPLACE FUNCTION public.generate_withdrawal_request_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _seq INT;
BEGIN
  IF NEW.request_number IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(request_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
      INTO _seq
      FROM public.portal_withdrawal_requests
      WHERE portal_id = NEW.portal_id;
    NEW.request_number := 'WD-' || LPAD(_seq::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_withdrawal_request_number_trigger
  BEFORE INSERT ON public.portal_withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.generate_withdrawal_request_number();

-- ============================================================
-- 8. Función helper: get_user_upline (recorrido de la red)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_upline(
  _user_id UUID,
  _portal_id UUID,
  _max_levels INT DEFAULT 10
)
RETURNS TABLE (
  level_number INT,
  upline_user_id UUID
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _chain UUID[];
  _i INT;
BEGIN
  SELECT upline_chain INTO _chain
  FROM public.portal_mlm_referrals
  WHERE user_id = _user_id AND portal_id = _portal_id
  LIMIT 1;

  IF _chain IS NULL THEN
    RETURN;
  END IF;

  FOR _i IN 1..LEAST(array_length(_chain, 1), _max_levels) LOOP
    level_number := _i;
    upline_user_id := _chain[_i];
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

-- ============================================================
-- 9. Función helper: get_or_create_wallet
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_or_create_user_wallet(
  _portal_id UUID,
  _user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wallet_id UUID;
BEGIN
  SELECT id INTO _wallet_id
  FROM public.portal_user_wallets
  WHERE portal_id = _portal_id AND user_id = _user_id
  LIMIT 1;

  IF _wallet_id IS NULL THEN
    INSERT INTO public.portal_user_wallets (portal_id, user_id)
    VALUES (_portal_id, _user_id)
    RETURNING id INTO _wallet_id;
  END IF;

  RETURN _wallet_id;
END;
$$;
