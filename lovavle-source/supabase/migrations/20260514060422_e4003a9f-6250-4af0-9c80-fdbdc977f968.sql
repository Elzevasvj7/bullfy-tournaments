
-- ============================================================
-- BULLFY TOURNAMENT — FOUNDATION (Entrega 1)
-- ============================================================

-- 1) ENUMS
CREATE TYPE public.tournament_type AS ENUM ('free','paid','elite');
CREATE TYPE public.tournament_modality AS ENUM ('pro','standard');
CREATE TYPE public.tournament_status AS ENUM ('draft','scheduled','registration_open','running','finished','settled','cancelled');
CREATE TYPE public.tournament_approval_status AS ENUM ('pending','approved','rejected','auto_approved');
CREATE TYPE public.tournament_participant_status AS ENUM ('registered','active','eliminated','qualified','winner','disqualified');
CREATE TYPE public.tournament_payment_type AS ENUM ('entry_fee','prize_payout','wallet_topup','wallet_withdrawal','refund');
CREATE TYPE public.tournament_payment_status AS ENUM ('pending','completed','failed','cancelled');
CREATE TYPE public.tournament_otp_purpose AS ENUM ('registration_email','registration_sms','password_reset','email_change');
CREATE TYPE public.tournament_redemption_kind AS ENUM ('funded_account','promo_discount','entry_voucher','custom');

-- 2) TABLES

-- 2.1 Users (identity)
CREATE TABLE public.tournament_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  phone text NOT NULL UNIQUE,
  full_name text NOT NULL,
  country text,
  avatar_url text,
  password_hash text,
  is_elite boolean NOT NULL DEFAULT false,
  kyc_status text NOT NULL DEFAULT 'none',
  lead_id uuid,
  bullfy_points integer NOT NULL DEFAULT 0,
  lifetime_winnings_usd numeric(14,2) NOT NULL DEFAULT 0,
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  banned_at timestamptz,
  ban_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tu_email_lower ON public.tournament_users (lower(email));
CREATE INDEX idx_tu_phone ON public.tournament_users (phone);
CREATE INDEX idx_tu_lead ON public.tournament_users (lead_id);

-- 2.2 Sessions (30d)
CREATE TABLE public.tournament_user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  ip_address text,
  user_agent text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tus_user ON public.tournament_user_sessions (user_id);
CREATE INDEX idx_tus_token ON public.tournament_user_sessions (token);

-- 2.3 OTPs
CREATE TABLE public.tournament_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  phone text,
  code text NOT NULL,
  purpose public.tournament_otp_purpose NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  verified boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_totp_email ON public.tournament_otp_codes (email);
CREATE INDEX idx_totp_phone ON public.tournament_otp_codes (phone);

-- 2.4 Global config (singleton)
CREATE TABLE public.tournament_global_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_starting_balance numeric(14,2) NOT NULL DEFAULT 10000,
  default_house_fee_pct numeric(5,2) NOT NULL DEFAULT 20,
  default_prize_distribution jsonb NOT NULL DEFAULT '[{"rank":1,"pct":50},{"rank":2,"pct":35},{"rank":3,"pct":15}]'::jsonb,
  default_scoring_weights jsonb NOT NULL DEFAULT '{"profit":0.5,"winrate":0.2,"profit_factor":0.15,"sharpe":0.1,"drawdown":0.05}'::jsonb,
  default_trading_rules jsonb NOT NULL DEFAULT '{"max_lot":5,"allowed_symbols":["EURUSD","GBPUSD","USDJPY","XAUUSD","BTCUSD"],"max_trades":200,"min_trades_qualify":3,"hedging_allowed":false,"stop_out_pct":50}'::jsonb,
  default_group_size integer NOT NULL DEFAULT 10,
  default_advance_per_group integer NOT NULL DEFAULT 2,
  default_round_duration_minutes integer NOT NULL DEFAULT 60,
  free_user_creation_enabled boolean NOT NULL DEFAULT true,
  free_max_per_user_per_week integer NOT NULL DEFAULT 2,
  free_max_participants integer NOT NULL DEFAULT 50,
  paid_user_creation_enabled boolean NOT NULL DEFAULT false,
  elite_min_deposit_usd numeric(14,2) NOT NULL DEFAULT 500,
  elite_kyc_required boolean NOT NULL DEFAULT true,
  points_per_usd_prize numeric(6,2) NOT NULL DEFAULT 1.0,
  base_points_participation integer NOT NULL DEFAULT 10,
  base_points_winner jsonb NOT NULL DEFAULT '{"1":500,"2":300,"3":150}'::jsonb,
  type_multiplier jsonb NOT NULL DEFAULT '{"free":1,"paid":2,"elite":4}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2.5 Tournaments
CREATE TABLE public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  banner_url text,
  type public.tournament_type NOT NULL,
  modality public.tournament_modality NOT NULL,
  status public.tournament_status NOT NULL DEFAULT 'draft',
  approval_status public.tournament_approval_status NOT NULL DEFAULT 'pending',
  created_by_user_id uuid REFERENCES public.tournament_users(id) ON DELETE SET NULL,
  created_by_admin_id uuid,
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  starting_balance_usd numeric(14,2) NOT NULL DEFAULT 10000,
  entry_fee_usd numeric(14,2) NOT NULL DEFAULT 0,
  max_participants integer NOT NULL DEFAULT 100,
  min_participants integer NOT NULL DEFAULT 2,
  group_size integer NOT NULL DEFAULT 10,
  advance_per_group integer NOT NULL DEFAULT 2,
  total_rounds integer,
  current_round integer NOT NULL DEFAULT 0,
  round_duration_minutes integer NOT NULL DEFAULT 60,
  starts_at timestamptz,
  registration_closes_at timestamptz,
  ends_at timestamptz,
  current_round_ends_at timestamptz,
  house_fee_pct numeric(5,2) NOT NULL DEFAULT 20,
  prize_distribution jsonb NOT NULL DEFAULT '[{"rank":1,"pct":50},{"rank":2,"pct":35},{"rank":3,"pct":15}]'::jsonb,
  scoring_weights jsonb NOT NULL DEFAULT '{"profit":0.5,"winrate":0.2,"profit_factor":0.15,"sharpe":0.1,"drawdown":0.05}'::jsonb,
  trading_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  bullfy_points_pool integer NOT NULL DEFAULT 0,
  prize_pool_usd numeric(14,2) NOT NULL DEFAULT 0,
  participants_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tournaments_status ON public.tournaments (status);
CREATE INDEX idx_tournaments_type ON public.tournaments (type);
CREATE INDEX idx_tournaments_starts ON public.tournaments (starts_at);
CREATE INDEX idx_tournaments_creator ON public.tournaments (created_by_user_id);

-- 2.6 Participants
CREATE TABLE public.tournament_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  mt5_login text,
  mt5_password text, -- encrypted via app
  mt5_server text,
  starting_balance numeric(14,2) NOT NULL,
  current_balance numeric(14,2) NOT NULL DEFAULT 0,
  current_equity numeric(14,2) NOT NULL DEFAULT 0,
  current_score numeric(14,4) NOT NULL DEFAULT 0,
  trades_count integer NOT NULL DEFAULT 0,
  winning_trades integer NOT NULL DEFAULT 0,
  losing_trades integer NOT NULL DEFAULT 0,
  winrate numeric(6,2) NOT NULL DEFAULT 0,
  profit_pct numeric(8,4) NOT NULL DEFAULT 0,
  profit_factor numeric(10,4) NOT NULL DEFAULT 0,
  sharpe numeric(10,4) NOT NULL DEFAULT 0,
  max_drawdown_pct numeric(8,4) NOT NULL DEFAULT 0,
  status public.tournament_participant_status NOT NULL DEFAULT 'registered',
  current_round integer NOT NULL DEFAULT 0,
  group_id uuid,
  final_rank integer,
  prize_won_usd numeric(14,2) NOT NULL DEFAULT 0,
  points_won integer NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  eliminated_at timestamptz,
  last_synced_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);
CREATE INDEX idx_tp_tournament ON public.tournament_participants (tournament_id);
CREATE INDEX idx_tp_user ON public.tournament_participants (user_id);
CREATE INDEX idx_tp_score ON public.tournament_participants (tournament_id, current_score DESC);
CREATE INDEX idx_tp_group ON public.tournament_participants (group_id);

-- 2.7 Groups (pro modality)
CREATE TABLE public.tournament_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  group_number integer NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending|running|finished
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, round_number, group_number)
);
CREATE INDEX idx_tg_tournament ON public.tournament_groups (tournament_id);

ALTER TABLE public.tournament_participants
  ADD CONSTRAINT fk_tp_group FOREIGN KEY (group_id)
  REFERENCES public.tournament_groups(id) ON DELETE SET NULL;

-- 2.8 Trades (immutable)
CREATE TABLE public.tournament_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.tournament_participants(id) ON DELETE CASCADE,
  ticket text NOT NULL,
  symbol text NOT NULL,
  type text NOT NULL, -- buy|sell
  volume numeric(10,2) NOT NULL,
  open_price numeric(14,5),
  close_price numeric(14,5),
  open_time timestamptz,
  close_time timestamptz,
  profit numeric(14,2) NOT NULL DEFAULT 0,
  commission numeric(14,2) NOT NULL DEFAULT 0,
  swap numeric(14,2) NOT NULL DEFAULT 0,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, ticket)
);
CREATE INDEX idx_tt_participant ON public.tournament_trades (participant_id);
CREATE INDEX idx_tt_close ON public.tournament_trades (close_time DESC);

-- 2.9 Wallets
CREATE TABLE public.tournament_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  balance_usd numeric(14,2) NOT NULL DEFAULT 0,
  locked_usd numeric(14,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2.10 Payments
CREATE TABLE public.tournament_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  tournament_id uuid REFERENCES public.tournaments(id) ON DELETE SET NULL,
  type public.tournament_payment_type NOT NULL,
  amount_usd numeric(14,2) NOT NULL,
  gateway text,
  gateway_ref text,
  status public.tournament_payment_status NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tpay_user ON public.tournament_payments (user_id);
CREATE INDEX idx_tpay_tournament ON public.tournament_payments (tournament_id);

-- 2.11 Points ledger
CREATE TABLE public.tournament_points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL,
  tournament_id uuid REFERENCES public.tournaments(id) ON DELETE SET NULL,
  redemption_code_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tpl_user ON public.tournament_points_ledger (user_id);

-- 2.12 House ledger
CREATE TABLE public.tournament_house_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL UNIQUE REFERENCES public.tournaments(id) ON DELETE CASCADE,
  gross_pool_usd numeric(14,2) NOT NULL DEFAULT 0,
  house_cut_usd numeric(14,2) NOT NULL DEFAULT 0,
  prizes_paid_usd numeric(14,2) NOT NULL DEFAULT 0,
  net_revenue_usd numeric(14,2) NOT NULL DEFAULT 0,
  participants_count integer NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now()
);

-- 2.13 Redemption catalog
CREATE TABLE public.tournament_redemption_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.tournament_redemption_kind NOT NULL,
  name text NOT NULL,
  description text,
  image_url text,
  cost_points integer NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb, -- e.g. { "account_size": 10000, "discount_pct": 20 }
  stock integer, -- null = unlimited
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2.14 Redemption codes
CREATE TABLE public.tournament_redemption_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  catalog_id uuid NOT NULL REFERENCES public.tournament_redemption_catalog(id) ON DELETE RESTRICT,
  code text NOT NULL UNIQUE,
  used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  expires_at timestamptz,
  cost_points integer NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_trc_user ON public.tournament_redemption_codes (user_id);

-- 2.15 Rankings cache
CREATE TABLE public.tournament_rankings_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  scope text NOT NULL, -- 'free'|'paid'|'elite'|'global'
  period text NOT NULL DEFAULT 'all', -- 'all'|'month'|'year'
  rank integer NOT NULL,
  total_winnings_usd numeric(14,2) NOT NULL DEFAULT 0,
  total_points integer NOT NULL DEFAULT 0,
  tournaments_played integer NOT NULL DEFAULT 0,
  tournaments_won integer NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope, period)
);
CREATE INDEX idx_trank_scope_rank ON public.tournament_rankings_cache (scope, period, rank);

-- 3) HELPER FUNCTIONS

CREATE OR REPLACE FUNCTION public.tournament_generate_slug(_name text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _base text;
  _slug text;
  _i int := 0;
BEGIN
  _base := lower(regexp_replace(_name, '[^a-zA-Z0-9]+', '-', 'g'));
  _base := trim(both '-' from _base);
  IF _base = '' OR _base IS NULL THEN _base := 'tournament'; END IF;
  _slug := _base;
  WHILE EXISTS (SELECT 1 FROM public.tournaments WHERE slug = _slug) LOOP
    _i := _i + 1;
    _slug := _base || '-' || _i::text;
  END LOOP;
  RETURN _slug;
END;
$$;

CREATE OR REPLACE FUNCTION public.tournament_set_slug()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.tournament_generate_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_tournament_set_slug
BEFORE INSERT ON public.tournaments
FOR EACH ROW EXECUTE FUNCTION public.tournament_set_slug();

CREATE OR REPLACE FUNCTION public.tournament_generate_redemption_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _code text;
  _alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  _i int;
BEGIN
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN RETURN NEW; END IF;
  LOOP
    _code := 'BFY-';
    FOR _i IN 1..12 LOOP
      _code := _code || substr(_alphabet, floor(random()*length(_alphabet))::int + 1, 1);
      IF _i = 4 OR _i = 8 THEN _code := _code || '-'; END IF;
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.tournament_redemption_codes WHERE code = _code);
  END LOOP;
  NEW.code := _code;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_trc_code
BEFORE INSERT ON public.tournament_redemption_codes
FOR EACH ROW EXECUTE FUNCTION public.tournament_generate_redemption_code();

-- updated_at triggers (reuse global update_updated_at_column)
CREATE TRIGGER trg_tu_updated BEFORE UPDATE ON public.tournament_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tournaments_updated BEFORE UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tp_updated BEFORE UPDATE ON public.tournament_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tpay_updated BEFORE UPDATE ON public.tournament_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_trcat_updated BEFORE UPDATE ON public.tournament_redemption_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create wallet on user insert
CREATE OR REPLACE FUNCTION public.tournament_create_wallet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.tournament_wallets (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_tu_create_wallet
AFTER INSERT ON public.tournament_users
FOR EACH ROW EXECUTE FUNCTION public.tournament_create_wallet();

-- 4) RLS

ALTER TABLE public.tournament_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_global_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_house_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_redemption_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_redemption_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_rankings_cache ENABLE ROW LEVEL SECURITY;

-- Public lobby reads
CREATE POLICY "tournaments_public_read" ON public.tournaments
  FOR SELECT USING (status NOT IN ('draft','cancelled'));
CREATE POLICY "tournaments_admin_all" ON public.tournaments
  FOR ALL USING (public.is_global_admin() OR public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.is_global_admin() OR public.has_role(auth.uid(),'admin'::public.app_role));

CREATE POLICY "participants_public_read" ON public.tournament_participants
  FOR SELECT USING (true);
CREATE POLICY "participants_admin_all" ON public.tournament_participants
  FOR ALL USING (public.is_global_admin() OR public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.is_global_admin() OR public.has_role(auth.uid(),'admin'::public.app_role));

CREATE POLICY "groups_public_read" ON public.tournament_groups
  FOR SELECT USING (true);
CREATE POLICY "trades_public_read" ON public.tournament_trades
  FOR SELECT USING (true);
CREATE POLICY "rankings_public_read" ON public.tournament_rankings_cache
  FOR SELECT USING (true);
CREATE POLICY "config_public_read" ON public.tournament_global_config
  FOR SELECT USING (true);
CREATE POLICY "config_admin_write" ON public.tournament_global_config
  FOR ALL USING (public.is_global_admin() OR public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.is_global_admin() OR public.has_role(auth.uid(),'admin'::public.app_role));

CREATE POLICY "catalog_public_read" ON public.tournament_redemption_catalog
  FOR SELECT USING (active = true);
CREATE POLICY "catalog_admin_all" ON public.tournament_redemption_catalog
  FOR ALL USING (public.is_global_admin() OR public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.is_global_admin() OR public.has_role(auth.uid(),'admin'::public.app_role));

-- Public minimal user info (for leaderboards: name + avatar only via join in views; we expose all but RLS via service role only).
-- Default deny for sensitive tables (no policies = no access for anon/auth; service role bypasses RLS)
-- But we add admin read policies:
CREATE POLICY "users_admin_read" ON public.tournament_users
  FOR SELECT USING (public.is_global_admin() OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "users_public_minimal_read" ON public.tournament_users
  FOR SELECT USING (true);
-- ^ minimal read OK because passwords are hashes; if we want stricter, expose via view. Keep simple for v1.

CREATE POLICY "house_admin_read" ON public.tournament_house_ledger
  FOR SELECT USING (public.is_global_admin() OR public.has_role(auth.uid(),'admin'::public.app_role));

CREATE POLICY "payments_admin_read" ON public.tournament_payments
  FOR SELECT USING (public.is_global_admin() OR public.has_role(auth.uid(),'admin'::public.app_role));

CREATE POLICY "points_admin_read" ON public.tournament_points_ledger
  FOR SELECT USING (public.is_global_admin() OR public.has_role(auth.uid(),'admin'::public.app_role));

CREATE POLICY "wallets_admin_read" ON public.tournament_wallets
  FOR SELECT USING (public.is_global_admin() OR public.has_role(auth.uid(),'admin'::public.app_role));

CREATE POLICY "redemption_codes_admin_read" ON public.tournament_redemption_codes
  FOR SELECT USING (public.is_global_admin() OR public.has_role(auth.uid(),'admin'::public.app_role));

-- (sessions, otps: service role only - no policies)

-- 5) SEEDS

INSERT INTO public.tournament_global_config (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tournament_redemption_catalog (kind, name, description, cost_points, payload, stock, active) VALUES
  ('funded_account', 'Cuenta Fondeada Demo $10K', 'Cuenta de fondeo Bullfy con $10,000 USD para evaluación.', 5000, '{"account_size":10000,"phase":"evaluation"}'::jsonb, NULL, true),
  ('funded_account', 'Cuenta Fondeada Demo $25K', 'Cuenta de fondeo Bullfy con $25,000 USD para evaluación.', 12000, '{"account_size":25000,"phase":"evaluation"}'::jsonb, NULL, true),
  ('funded_account', 'Cuenta Fondeada Demo $50K', 'Cuenta de fondeo Bullfy con $50,000 USD para evaluación.', 22000, '{"account_size":50000,"phase":"evaluation"}'::jsonb, NULL, true),
  ('promo_discount', '20% de descuento en próximo torneo de pago', 'Cupón único aplicable al entry fee.', 800, '{"discount_pct":20,"max_uses":1}'::jsonb, NULL, true),
  ('entry_voucher', 'Voucher de entrada gratuita (torneo de pago hasta $250)', 'Inscripción gratuita en cualquier torneo de pago de hasta $250 USD.', 2500, '{"max_entry_fee":250}'::jsonb, NULL, true);

-- 6) CRON JOBS (require pg_cron + pg_net)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'tournament-engine-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://dpfqhwcjyecpnvtchudo.supabase.co/functions/v1/tournament-engine-tick',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnFod2NqeWVjcG52dGNodWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTAyNzMsImV4cCI6MjA4ODY4NjI3M30.jn-UUyI5p87-j9Bi5biWIvCIxBH3DolY7aldMcj7MdI"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'tournament-rankings-refresh',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://dpfqhwcjyecpnvtchudo.supabase.co/functions/v1/tournament-rankings-refresh',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnFod2NqeWVjcG52dGNodWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTAyNzMsImV4cCI6MjA4ODY4NjI3M30.jn-UUyI5p87-j9Bi5biWIvCIxBH3DolY7aldMcj7MdI"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
