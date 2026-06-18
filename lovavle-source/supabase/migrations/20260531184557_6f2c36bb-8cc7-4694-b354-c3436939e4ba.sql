-- C7 part 1: expiry notification tracking
ALTER TABLE public.trading_room_subscriptions
  ADD COLUMN IF NOT EXISTS expiry_notified_at timestamptz;

-- C7 part 2: notification dedup log
CREATE TABLE IF NOT EXISTS public.portal_notification_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event      TEXT NOT NULL,
  ref_key    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event, ref_key)
);

ALTER TABLE public.portal_notification_log ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.portal_notification_log TO service_role;