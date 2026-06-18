
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS trading_enabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS trading_disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cleanup_at timestamptz,
  ADD COLUMN IF NOT EXISTS cleanup_done boolean NOT NULL DEFAULT false;

ALTER TABLE public.tournament_participants
  ADD COLUMN IF NOT EXISTS mt5_suspended boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS final_balance numeric,
  ADD COLUMN IF NOT EXISTS final_equity numeric,
  ADD COLUMN IF NOT EXISTS final_pnl numeric,
  ADD COLUMN IF NOT EXISTS final_pnl_pct numeric,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS mt5_deleted_at timestamptz;

CREATE TABLE IF NOT EXISTS public.tournament_deals_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.tournament_participants(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  mt5_login text,
  account_state jsonb,
  deals jsonb,
  positions jsonb,
  taken_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(participant_id)
);

ALTER TABLE public.tournament_deals_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own tournament snapshots"
ON public.tournament_deals_snapshot
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tournament_participants p
    JOIN public.tournament_user_sessions s ON s.user_id = p.user_id
    WHERE p.id = tournament_deals_snapshot.participant_id
  )
);

CREATE INDEX IF NOT EXISTS idx_tournaments_cleanup
  ON public.tournaments(cleanup_at) WHERE cleanup_done = false;
CREATE INDEX IF NOT EXISTS idx_tournament_snapshot_participant
  ON public.tournament_deals_snapshot(participant_id);
