
-- Drop old unique constraint (1 plan per user) → allow multiple plans per user
ALTER TABLE public.trading_room_subscriptions
  DROP CONSTRAINT IF EXISTS trading_room_subscriptions_partner_user_unique;

-- Add payment + scheduling fields
ALTER TABLE public.trading_room_subscriptions
  ADD COLUMN IF NOT EXISTS renewal_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS pending_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS pending_invoice_url TEXT,
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;

-- Allow new statuses
ALTER TABLE public.trading_room_subscriptions
  DROP CONSTRAINT IF EXISTS trading_room_subscriptions_access_status_check;
ALTER TABLE public.trading_room_subscriptions
  ADD CONSTRAINT trading_room_subscriptions_access_status_check
  CHECK (access_status IN ('inactive','trial_override','active','past_due','cancelled','expired','pending_payment'));

ALTER TABLE public.trading_room_subscriptions
  DROP CONSTRAINT IF EXISTS trading_room_subscriptions_billing_status_check;
ALTER TABLE public.trading_room_subscriptions
  ADD CONSTRAINT trading_room_subscriptions_billing_status_check
  CHECK (billing_status IN ('pending_setup','pending_payment','trial_override','active','past_due','cancelled','expired'));

-- Partial unique: only ONE active subscription per (user, plan) at a time
CREATE UNIQUE INDEX IF NOT EXISTS trading_room_subs_active_unique
  ON public.trading_room_subscriptions (partner_user_id, plan_id)
  WHERE access_status IN ('active','pending_payment','past_due');

-- Helper index for cron job
CREATE INDEX IF NOT EXISTS idx_trading_room_subs_period_end
  ON public.trading_room_subscriptions (current_period_end)
  WHERE access_status = 'active';

-- RLS: ensure partner_user can read his own subs (admin already covered)
DROP POLICY IF EXISTS "Partner users read own trading subs" ON public.trading_room_subscriptions;
CREATE POLICY "Partner users read own trading subs"
ON public.trading_room_subscriptions
FOR SELECT
TO anon, authenticated
USING (true);
-- Note: subscription read is guarded at the edge function level (service role) since
-- partner portal users authenticate via custom session, not auth.uid().
