
-- Wallets: BMoney balance separado del USD
ALTER TABLE public.tournament_wallets
  ADD COLUMN IF NOT EXISTS bmoney_balance numeric NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS bmoney_locked numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_bmoney_topup_at timestamptz;

-- Torneos: liga + economía
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS league text NOT NULL DEFAULT 'elite',
  ADD COLUMN IF NOT EXISTS entry_fee_bmoney numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allows_funded_mt5 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_funded_equity_usd numeric;

ALTER TABLE public.tournaments
  DROP CONSTRAINT IF EXISTS tournaments_league_check;
ALTER TABLE public.tournaments
  ADD CONSTRAINT tournaments_league_check CHECK (league IN ('bmoney','elite'));

-- Participantes: tipo MT5 + entrada
ALTER TABLE public.tournament_participants
  ADD COLUMN IF NOT EXISTS mt5_kind text NOT NULL DEFAULT 'demo',
  ADD COLUMN IF NOT EXISTS initial_funded_equity_usd numeric,
  ADD COLUMN IF NOT EXISTS entry_currency text NOT NULL DEFAULT 'usd',
  ADD COLUMN IF NOT EXISTS entry_paid numeric NOT NULL DEFAULT 0;

-- Pagos: moneda
ALTER TABLE public.tournament_payments
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'usd';

-- Config global: nuevos parámetros
ALTER TABLE public.tournament_global_config
  ADD COLUMN IF NOT EXISTS bmoney_starting_balance numeric NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS bmoney_topup_threshold numeric NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS bmoney_topup_amount numeric NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS bmoney_topup_cooldown_hours int NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS max_tournaments_per_user_per_day int NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS house_fee_pct_default numeric NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS bp_multiplier_bmoney numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS bp_multiplier_elite numeric NOT NULL DEFAULT 5;

-- Tabla de recargas BMoney
CREATE TABLE IF NOT EXISTS public.tournament_bmoney_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  balance_before numeric NOT NULL,
  balance_after numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bmoney_topups_user ON public.tournament_bmoney_topups(user_id, created_at DESC);

ALTER TABLE public.tournament_bmoney_topups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bmoney_topups_no_client" ON public.tournament_bmoney_topups;
CREATE POLICY "bmoney_topups_no_client"
  ON public.tournament_bmoney_topups
  FOR ALL
  USING (false)
  WITH CHECK (false);
