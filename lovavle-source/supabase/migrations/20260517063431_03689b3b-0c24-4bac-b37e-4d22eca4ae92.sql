-- Avatar fields (nullable, no default change to existing rows)
ALTER TABLE public.tournament_users
  ADD COLUMN IF NOT EXISTS avatar_config jsonb,
  ADD COLUMN IF NOT EXISTS avatar_3d_url text;

-- Equity snapshots history table
CREATE TABLE IF NOT EXISTS public.tournament_equity_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.tournament_participants(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  equity numeric NOT NULL DEFAULT 0,
  score numeric NOT NULL DEFAULT 0,
  profit_pct numeric NOT NULL DEFAULT 0,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tes_participant_time ON public.tournament_equity_snapshots(participant_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_tes_tournament_time ON public.tournament_equity_snapshots(tournament_id, captured_at DESC);

ALTER TABLE public.tournament_equity_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tes_public_read" ON public.tournament_equity_snapshots;
CREATE POLICY "tes_public_read" ON public.tournament_equity_snapshots FOR SELECT USING (true);

-- Trigger: snapshot on equity/score change (additive, does not modify engine)
CREATE OR REPLACE FUNCTION public.tournament_capture_equity_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    OLD.current_equity IS DISTINCT FROM NEW.current_equity OR
    OLD.current_score IS DISTINCT FROM NEW.current_score
  ) THEN
    INSERT INTO public.tournament_equity_snapshots(participant_id, tournament_id, equity, score, profit_pct)
    VALUES (NEW.id, NEW.tournament_id, COALESCE(NEW.current_equity,0), COALESCE(NEW.current_score,0), COALESCE(NEW.profit_pct,0));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tournament_capture_equity_snapshot ON public.tournament_participants;
CREATE TRIGGER trg_tournament_capture_equity_snapshot
AFTER UPDATE ON public.tournament_participants
FOR EACH ROW EXECUTE FUNCTION public.tournament_capture_equity_snapshot();

-- Enable Realtime on tournament_participants (idempotent)
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_participants';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_equity_snapshots';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

ALTER TABLE public.tournament_participants REPLICA IDENTITY FULL;