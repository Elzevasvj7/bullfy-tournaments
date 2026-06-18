CREATE TABLE public.trading_room_plan_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  mode text NOT NULL,
  session_key text,
  session_label text,
  window_start_utc time,
  window_end_utc time,
  active_hours_per_month integer NOT NULL DEFAULT 0,
  metaapi_cost_monthly numeric(12,2) NOT NULL DEFAULT 0,
  target_price_monthly numeric(12,2) NOT NULL DEFAULT 0,
  target_margin_pct numeric(5,2) NOT NULL DEFAULT 70,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trading_room_plan_catalog_mode_check CHECK (mode IN ('stream_only', 'session_window')),
  CONSTRAINT trading_room_plan_catalog_session_key_check CHECK (session_key IS NULL OR session_key IN ('stream_only', 'ny', 'london', 'hk'))
);

CREATE TABLE public.trading_room_ib_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ib_id uuid NOT NULL REFERENCES public.ibs(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  reason text,
  enabled_by uuid,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ib_id)
);

CREATE TABLE public.trading_room_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id uuid NOT NULL REFERENCES public.partner_users(id) ON DELETE CASCADE,
  portal_id uuid NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  ib_id uuid NOT NULL REFERENCES public.ibs(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.trading_room_plan_catalog(id) ON DELETE RESTRICT,
  access_status text NOT NULL DEFAULT 'inactive',
  billing_status text NOT NULL DEFAULT 'pending_setup',
  price_monthly numeric(12,2) NOT NULL DEFAULT 0,
  current_period_start timestamptz,
  current_period_end timestamptz,
  auto_renew boolean NOT NULL DEFAULT true,
  payment_provider text,
  external_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trading_room_subscriptions_access_status_check CHECK (access_status IN ('inactive', 'trial_override', 'active', 'past_due', 'cancelled')),
  CONSTRAINT trading_room_subscriptions_billing_status_check CHECK (billing_status IN ('pending_setup', 'trial_override', 'active', 'past_due', 'cancelled'))
);

CREATE TABLE public.trading_room_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id uuid NOT NULL REFERENCES public.partner_users(id) ON DELETE CASCADE,
  portal_id uuid NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  ib_id uuid NOT NULL REFERENCES public.ibs(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'metaapi',
  broker_server text NOT NULL DEFAULT 'MT5 Bullfy',
  mt_login text,
  account_label text,
  metaapi_account_id text,
  connection_status text NOT NULL DEFAULT 'not_connected',
  deployment_mode text,
  selected_session_key text,
  refreshes_per_day integer NOT NULL DEFAULT 4,
  ai_analysis_frequency text NOT NULL DEFAULT 'weekly',
  last_snapshot_at timestamptz,
  last_analysis_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_user_id),
  CONSTRAINT trading_room_accounts_provider_check CHECK (provider IN ('metaapi')),
  CONSTRAINT trading_room_accounts_connection_status_check CHECK (connection_status IN ('not_connected', 'pending', 'connected', 'paused', 'error')),
  CONSTRAINT trading_room_accounts_selected_session_key_check CHECK (selected_session_key IS NULL OR selected_session_key IN ('stream_only', 'ny', 'london', 'hk')),
  CONSTRAINT trading_room_accounts_ai_analysis_frequency_check CHECK (ai_analysis_frequency IN ('weekly'))
);

CREATE TABLE public.trading_room_order_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.trading_room_accounts(id) ON DELETE CASCADE,
  partner_user_id uuid NOT NULL REFERENCES public.partner_users(id) ON DELETE CASCADE,
  portal_id uuid NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.live_rooms(id) ON DELETE SET NULL,
  side text NOT NULL,
  lot_size numeric(10,2) NOT NULL,
  stop_loss numeric(18,8),
  take_profit numeric(18,8),
  symbol text,
  source text NOT NULL DEFAULT 'dashboard',
  execution_status text NOT NULL DEFAULT 'draft',
  requested_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trading_room_order_intents_side_check CHECK (side IN ('buy', 'sell')),
  CONSTRAINT trading_room_order_intents_source_check CHECK (source IN ('dashboard', 'stream_overlay')),
  CONSTRAINT trading_room_order_intents_execution_status_check CHECK (execution_status IN ('draft', 'queued', 'sent', 'filled', 'rejected', 'cancelled'))
);

CREATE TABLE public.trading_room_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.trading_room_accounts(id) ON DELETE CASCADE,
  snapshot_type text NOT NULL DEFAULT 'scheduled_refresh',
  snapshot_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trading_room_snapshots_snapshot_type_check CHECK (snapshot_type IN ('scheduled_refresh', 'manual_refresh', 'weekly_analysis_input'))
);

CREATE TABLE public.trading_room_analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.trading_room_accounts(id) ON DELETE CASCADE,
  partner_user_id uuid NOT NULL REFERENCES public.partner_users(id) ON DELETE CASCADE,
  analysis_type text NOT NULL DEFAULT 'weekly_strategy_review',
  status text NOT NULL DEFAULT 'pending',
  summary text,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  input_snapshot_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT trading_room_analysis_runs_analysis_type_check CHECK (analysis_type IN ('weekly_strategy_review')),
  CONSTRAINT trading_room_analysis_runs_status_check CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

ALTER TABLE public.trading_room_plan_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_room_ib_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_room_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_room_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_room_order_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_room_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_room_analysis_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trading room plans are viewable by everyone"
ON public.trading_room_plan_catalog
FOR SELECT
USING (true);

CREATE POLICY "Admins manage trading room plans"
ON public.trading_room_plan_catalog
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Admins view IB trading room overrides"
ON public.trading_room_ib_overrides
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Global admins manage IB trading room overrides"
ON public.trading_room_ib_overrides
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'global_admin'))
WITH CHECK (public.has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Admins view trading room subscriptions"
ON public.trading_room_subscriptions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'operaciones'));

CREATE POLICY "Admins manage trading room subscriptions"
ON public.trading_room_subscriptions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Admins view trading room accounts"
ON public.trading_room_accounts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'operaciones'));

CREATE POLICY "Admins manage trading room accounts"
ON public.trading_room_accounts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Admins view trading room order intents"
ON public.trading_room_order_intents
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'operaciones'));

CREATE POLICY "Admins manage trading room order intents"
ON public.trading_room_order_intents
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Admins view trading room snapshots"
ON public.trading_room_snapshots
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'operaciones'));

CREATE POLICY "Admins manage trading room snapshots"
ON public.trading_room_snapshots
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Admins view trading room analysis runs"
ON public.trading_room_analysis_runs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'operaciones'));

CREATE POLICY "Admins manage trading room analysis runs"
ON public.trading_room_analysis_runs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

CREATE INDEX idx_trading_room_subscriptions_partner_user ON public.trading_room_subscriptions(partner_user_id);
CREATE INDEX idx_trading_room_subscriptions_ib ON public.trading_room_subscriptions(ib_id);
CREATE INDEX idx_trading_room_accounts_partner_user ON public.trading_room_accounts(partner_user_id);
CREATE INDEX idx_trading_room_accounts_ib ON public.trading_room_accounts(ib_id);
CREATE INDEX idx_trading_room_orders_account_requested ON public.trading_room_order_intents(account_id, requested_at DESC);
CREATE INDEX idx_trading_room_snapshots_account_created ON public.trading_room_snapshots(account_id, created_at DESC);
CREATE INDEX idx_trading_room_analysis_runs_account_created ON public.trading_room_analysis_runs(account_id, created_at DESC);

CREATE TRIGGER update_trading_room_plan_catalog_updated_at
BEFORE UPDATE ON public.trading_room_plan_catalog
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trading_room_ib_overrides_updated_at
BEFORE UPDATE ON public.trading_room_ib_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trading_room_subscriptions_updated_at
BEFORE UPDATE ON public.trading_room_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trading_room_accounts_updated_at
BEFORE UPDATE ON public.trading_room_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trading_room_order_intents_updated_at
BEFORE UPDATE ON public.trading_room_order_intents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.trading_room_plan_catalog (
  plan_code, display_name, mode, session_key, session_label, window_start_utc, window_end_utc,
  active_hours_per_month, metaapi_cost_monthly, target_price_monthly, target_margin_pct, sort_order, notes
)
VALUES
  ('stream_only', 'Stream Only', 'stream_only', 'stream_only', 'Solo durante stream en vivo', NULL, NULL, 70, 4.86, 8.26, 70, 1, 'Activa la conexión únicamente durante streams autorizados.'),
  ('session_ny', 'Sesión NY', 'session_window', 'ny', 'Sesión New York', '13:00:00', '17:00:00', 80, 5.25, 8.93, 70, 2, 'Ventana diaria enfocada en New York.'),
  ('session_london', 'Sesión Londres', 'session_window', 'london', 'Sesión Londres', '07:00:00', '11:00:00', 80, 5.25, 8.93, 70, 3, 'Ventana diaria enfocada en Londres.'),
  ('session_hk', 'Sesión HK', 'session_window', 'hk', 'Sesión Hong Kong', '01:00:00', '05:00:00', 80, 5.25, 8.93, 70, 4, 'Ventana diaria enfocada en Hong Kong.')
ON CONFLICT (plan_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  mode = EXCLUDED.mode,
  session_key = EXCLUDED.session_key,
  session_label = EXCLUDED.session_label,
  window_start_utc = EXCLUDED.window_start_utc,
  window_end_utc = EXCLUDED.window_end_utc,
  active_hours_per_month = EXCLUDED.active_hours_per_month,
  metaapi_cost_monthly = EXCLUDED.metaapi_cost_monthly,
  target_price_monthly = EXCLUDED.target_price_monthly,
  target_margin_pct = EXCLUDED.target_margin_pct,
  sort_order = EXCLUDED.sort_order,
  notes = EXCLUDED.notes,
  updated_at = now();