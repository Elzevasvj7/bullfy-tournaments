-- Entrega 5: Social - Public profiles + Live chat

-- 1. Username + public profile flag
ALTER TABLE public.tournament_users
  ADD COLUMN IF NOT EXISTS username text UNIQUE,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS public_profile boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_tournament_users_username ON public.tournament_users(lower(username));

-- 2. Auto-generate username from email/full_name if missing
CREATE OR REPLACE FUNCTION public.tournament_generate_username()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _base text;
  _candidate text;
  _suffix int := 0;
BEGIN
  IF NEW.username IS NOT NULL AND NEW.username <> '' THEN RETURN NEW; END IF;

  _base := lower(regexp_replace(
    COALESCE(split_part(NEW.full_name, ' ', 1), split_part(NEW.email, '@', 1), 'player'),
    '[^a-z0-9]', '', 'g'
  ));
  IF length(_base) < 3 THEN _base := 'player' || _base; END IF;
  IF length(_base) > 20 THEN _base := substring(_base, 1, 20); END IF;

  _candidate := _base;
  WHILE EXISTS (SELECT 1 FROM public.tournament_users WHERE lower(username) = lower(_candidate)) LOOP
    _suffix := _suffix + 1;
    _candidate := _base || _suffix::text;
    IF _suffix > 9999 THEN
      _candidate := _base || floor(random()*100000)::text;
      EXIT;
    END IF;
  END LOOP;

  NEW.username := _candidate;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_tournament_generate_username ON public.tournament_users;
CREATE TRIGGER trg_tournament_generate_username
  BEFORE INSERT ON public.tournament_users
  FOR EACH ROW EXECUTE FUNCTION public.tournament_generate_username();

-- Backfill usernames for existing users
UPDATE public.tournament_users
  SET username = lower(regexp_replace(split_part(email, '@', 1), '[^a-z0-9]', '', 'g')) || substring(id::text, 1, 4)
  WHERE username IS NULL;

-- 3. Tournament chat
CREATE TABLE IF NOT EXISTS public.tournament_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 280),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_by uuid,
  deleted_at timestamptz,
  reply_to_id uuid REFERENCES public.tournament_chat_messages(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tournament_chat_tournament ON public.tournament_chat_messages(tournament_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tournament_chat_user ON public.tournament_chat_messages(user_id);

ALTER TABLE public.tournament_chat_messages ENABLE ROW LEVEL SECURITY;

-- Public read for non-deleted messages (chat is part of the public tournament experience)
CREATE POLICY "Anyone can read tournament chat"
  ON public.tournament_chat_messages FOR SELECT
  USING (is_deleted = false);

-- Inserts/updates handled exclusively via edge functions with service role
-- (tournament users don't have Supabase auth.uid)

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_chat_messages;

-- 4. Simple per-user rate limit table
CREATE TABLE IF NOT EXISTS public.tournament_chat_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  tournament_id uuid REFERENCES public.tournaments(id) ON DELETE CASCADE,
  reason text,
  muted_until timestamptz,
  muted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tournament_chat_mutes_user ON public.tournament_chat_mutes(user_id, tournament_id);
ALTER TABLE public.tournament_chat_mutes ENABLE ROW LEVEL SECURITY;