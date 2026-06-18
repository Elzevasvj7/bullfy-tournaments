
-- =========================================================================
-- BULLFY TOURNAMENT: CLANES + VERSUS 1V1 + USUARIOS VERIFICADOS
-- =========================================================================

-- Extender enum de tipo de torneo
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='tournament_type' AND e.enumlabel='clan_war') THEN
    ALTER TYPE tournament_type ADD VALUE 'clan_war';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='tournament_type' AND e.enumlabel='versus') THEN
    ALTER TYPE tournament_type ADD VALUE 'versus';
  END IF;
END $$;

-- ============= USUARIOS: badge verificado + clan activo =============
ALTER TABLE public.tournament_users
  ADD COLUMN IF NOT EXISTS is_verified_user boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_user_at timestamptz,
  ADD COLUMN IF NOT EXISTS clan_id uuid,
  ADD COLUMN IF NOT EXISTS clan_change_available_at timestamptz;

-- ============= TOURNAMENT_CLANS =============
CREATE TABLE IF NOT EXISTS public.tournament_clans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tag text NOT NULL,
  description text,
  logo_url text,
  banner_url text,
  owner_id uuid NOT NULL REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  invite_code text NOT NULL UNIQUE,
  is_verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  verified_payment_id uuid,
  rating integer NOT NULL DEFAULT 1000,
  total_wars integer NOT NULL DEFAULT 0,
  wars_won integer NOT NULL DEFAULT 0,
  total_score numeric NOT NULL DEFAULT 0,
  members_count integer NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clans_tag_format CHECK (tag ~ '^[A-Z0-9]{2,6}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_clans_name_ci ON public.tournament_clans (lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS uq_clans_tag_ci ON public.tournament_clans (lower(tag));
CREATE INDEX IF NOT EXISTS idx_clans_rating ON public.tournament_clans (rating DESC);

ALTER TABLE public.tournament_clans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clans_public_read" ON public.tournament_clans FOR SELECT USING (true);

-- ============= TOURNAMENT_CLAN_MEMBERS =============
CREATE TABLE IF NOT EXISTS public.tournament_clan_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id uuid NOT NULL REFERENCES public.tournament_clans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','officer','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  contribution_score numeric NOT NULL DEFAULT 0,
  wars_played integer NOT NULL DEFAULT 0
);
-- Solo 1 membresía activa por user (left_at IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_clan_members_active_user
  ON public.tournament_clan_members(user_id) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clan_members_clan ON public.tournament_clan_members(clan_id) WHERE left_at IS NULL;

ALTER TABLE public.tournament_clan_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clan_members_public_read" ON public.tournament_clan_members FOR SELECT USING (true);

-- Trigger para mantener members_count
CREATE OR REPLACE FUNCTION public.tournament_clan_update_members_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tournament_clans SET members_count = members_count + 1, updated_at = now() WHERE id = NEW.clan_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.left_at IS NULL AND NEW.left_at IS NOT NULL THEN
      UPDATE tournament_clans SET members_count = GREATEST(0, members_count - 1), updated_at = now() WHERE id = NEW.clan_id;
    ELSIF OLD.left_at IS NOT NULL AND NEW.left_at IS NULL THEN
      UPDATE tournament_clans SET members_count = members_count + 1, updated_at = now() WHERE id = NEW.clan_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.left_at IS NULL THEN
      UPDATE tournament_clans SET members_count = GREATEST(0, members_count - 1), updated_at = now() WHERE id = OLD.clan_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_clan_members_count ON public.tournament_clan_members;
CREATE TRIGGER trg_clan_members_count
AFTER INSERT OR UPDATE OR DELETE ON public.tournament_clan_members
FOR EACH ROW EXECUTE FUNCTION public.tournament_clan_update_members_count();

-- Trigger para sync clan_id en tournament_users
CREATE OR REPLACE FUNCTION public.tournament_clan_sync_user_clan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.left_at IS NULL THEN
    UPDATE tournament_users SET clan_id = NEW.clan_id WHERE id = NEW.user_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.left_at IS NULL AND NEW.left_at IS NOT NULL THEN
    UPDATE tournament_users SET clan_id = NULL, clan_change_available_at = now() + interval '7 days' WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' AND OLD.left_at IS NULL THEN
    UPDATE tournament_users SET clan_id = NULL WHERE id = OLD.user_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_clan_sync_user ON public.tournament_clan_members;
CREATE TRIGGER trg_clan_sync_user
AFTER INSERT OR UPDATE OR DELETE ON public.tournament_clan_members
FOR EACH ROW EXECUTE FUNCTION public.tournament_clan_sync_user_clan();

-- ============= TOURNAMENT_CLAN_WARS =============
CREATE TABLE IF NOT EXISTS public.tournament_clan_wars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES public.tournaments(id) ON DELETE SET NULL,
  challenger_clan_id uuid NOT NULL REFERENCES public.tournament_clans(id) ON DELETE CASCADE,
  defender_clan_id uuid NOT NULL REFERENCES public.tournament_clans(id) ON DELETE CASCADE,
  stake_usd numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','live','finished','expired','cancelled')),
  winner_clan_id uuid REFERENCES public.tournament_clans(id),
  challenger_score numeric,
  defender_score numeric,
  challenger_participants integer DEFAULT 0,
  defender_participants integer DEFAULT 0,
  min_participants integer NOT NULL DEFAULT 3,
  accept_deadline timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  starts_at timestamptz,
  ends_at timestamptz,
  message text,
  created_by_user_id uuid NOT NULL REFERENCES public.tournament_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT different_clans CHECK (challenger_clan_id <> defender_clan_id)
);
CREATE INDEX IF NOT EXISTS idx_clan_wars_status ON public.tournament_clan_wars(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clan_wars_clans ON public.tournament_clan_wars(challenger_clan_id, defender_clan_id);

ALTER TABLE public.tournament_clan_wars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clan_wars_public_read" ON public.tournament_clan_wars FOR SELECT USING (true);

-- ============= TOURNAMENT_VERSUS =============
CREATE TABLE IF NOT EXISTS public.tournament_versus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES public.tournaments(id) ON DELETE SET NULL,
  challenger_id uuid NOT NULL REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  opponent_id uuid REFERENCES public.tournament_users(id) ON DELETE SET NULL,
  opponent_email text,
  opponent_username_hint text,
  invite_token text UNIQUE,
  stake_usd numeric NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL DEFAULT 1440,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','live','finished','expired','cancelled')),
  winner_id uuid REFERENCES public.tournament_users(id),
  challenger_score numeric,
  opponent_score numeric,
  message text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opponent_target CHECK (opponent_id IS NOT NULL OR opponent_email IS NOT NULL),
  CONSTRAINT no_self_versus CHECK (opponent_id IS NULL OR opponent_id <> challenger_id)
);
CREATE INDEX IF NOT EXISTS idx_versus_challenger ON public.tournament_versus(challenger_id, status);
CREATE INDEX IF NOT EXISTS idx_versus_opponent ON public.tournament_versus(opponent_id, status);
CREATE INDEX IF NOT EXISTS idx_versus_token ON public.tournament_versus(invite_token) WHERE invite_token IS NOT NULL;

ALTER TABLE public.tournament_versus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "versus_public_read" ON public.tournament_versus FOR SELECT USING (true);

-- ============= TOURNAMENT_USER_VERIFICATIONS =============
CREATE TABLE IF NOT EXISTS public.tournament_user_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  id_front_url text,
  id_back_url text,
  selfie_url text,
  payment_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','refunded')),
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_verif_user ON public.tournament_user_verifications(user_id, status);

ALTER TABLE public.tournament_user_verifications ENABLE ROW LEVEL SECURITY;
-- Solo lectura por edge function (service role bypasses RLS).
CREATE POLICY "user_verif_owner_read" ON public.tournament_user_verifications FOR SELECT USING (false);

-- ============= TOURNAMENT_CLAN_RANKINGS_CACHE =============
CREATE TABLE IF NOT EXISTS public.tournament_clan_rankings_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id uuid NOT NULL REFERENCES public.tournament_clans(id) ON DELETE CASCADE,
  rank integer NOT NULL,
  avg_member_score numeric NOT NULL DEFAULT 0,
  wars_won integer NOT NULL DEFAULT 0,
  rating integer NOT NULL DEFAULT 1000,
  members_count integer NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clan_rankings_rank ON public.tournament_clan_rankings_cache(rank);
ALTER TABLE public.tournament_clan_rankings_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clan_rankings_public_read" ON public.tournament_clan_rankings_cache FOR SELECT USING (true);

-- ============= EXTENSIÓN tournaments para clan/versus refs =============
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS clan_war_id uuid REFERENCES public.tournament_clan_wars(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS versus_id uuid REFERENCES public.tournament_versus(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- ============= UPDATED_AT TRIGGERS =============
DROP TRIGGER IF EXISTS trg_clans_touch ON public.tournament_clans;
CREATE TRIGGER trg_clans_touch BEFORE UPDATE ON public.tournament_clans
FOR EACH ROW EXECUTE FUNCTION public.tournament_touch_updated_at();

DROP TRIGGER IF EXISTS trg_clan_wars_touch ON public.tournament_clan_wars;
CREATE TRIGGER trg_clan_wars_touch BEFORE UPDATE ON public.tournament_clan_wars
FOR EACH ROW EXECUTE FUNCTION public.tournament_touch_updated_at();

DROP TRIGGER IF EXISTS trg_versus_touch ON public.tournament_versus;
CREATE TRIGGER trg_versus_touch BEFORE UPDATE ON public.tournament_versus
FOR EACH ROW EXECUTE FUNCTION public.tournament_touch_updated_at();

DROP TRIGGER IF EXISTS trg_user_verif_touch ON public.tournament_user_verifications;
CREATE TRIGGER trg_user_verif_touch BEFORE UPDATE ON public.tournament_user_verifications
FOR EACH ROW EXECUTE FUNCTION public.tournament_touch_updated_at();
