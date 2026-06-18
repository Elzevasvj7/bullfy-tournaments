CREATE TABLE IF NOT EXISTS public.bridge_account_snapshot (
  account_id uuid PRIMARY KEY REFERENCES public.trading_room_accounts(id) ON DELETE CASCADE,
  bridge_login text NOT NULL,
  partner_user_id uuid NOT NULL,
  portal_id uuid NOT NULL,
  balance numeric,
  equity numeric,
  margin numeric,
  free_margin numeric,
  open_positions jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload_hash text,
  fetch_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bridge_snapshot_partner ON public.bridge_account_snapshot(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_bridge_snapshot_login ON public.bridge_account_snapshot(bridge_login);

ALTER TABLE public.bridge_account_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "snapshot_public_read" ON public.bridge_account_snapshot;
CREATE POLICY "snapshot_public_read" ON public.bridge_account_snapshot
  FOR SELECT USING (true);

ALTER TABLE public.bridge_account_snapshot REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='bridge_account_snapshot'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.bridge_account_snapshot';
  END IF;
END $$;