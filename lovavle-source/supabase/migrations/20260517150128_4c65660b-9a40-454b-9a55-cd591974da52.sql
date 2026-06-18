
-- ============================================
-- FASE 1: unified_identities (índice cruzado)
-- ============================================

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS public.unified_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized citext UNIQUE NOT NULL,
  phone_normalized text,
  display_name text,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  is_duplicate boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unified_identities_phone ON public.unified_identities(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_unified_identities_tags ON public.unified_identities USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_unified_identities_sources ON public.unified_identities USING GIN(sources);

ALTER TABLE public.unified_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and sales can view unified identities"
  ON public.unified_identities FOR SELECT
  USING (
    public.has_role(auth.uid(), 'global_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'admin_ventas')
    OR public.has_role(auth.uid(), 'ventas')
    OR public.has_role(auth.uid(), 'operaciones')
    OR public.has_role(auth.uid(), 'admin_operaciones')
    OR public.has_role(auth.uid(), 'marketing')
  );

CREATE POLICY "Admins can manage unified identities"
  ON public.unified_identities FOR ALL
  USING (public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_unified_identities_updated_at
  BEFORE UPDATE ON public.unified_identities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Upsert helper
CREATE OR REPLACE FUNCTION public.upsert_unified_identity(
  _email text,
  _phone text,
  _display_name text,
  _module text,
  _source_id uuid,
  _tag text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _id uuid;
  _existing public.unified_identities%ROWTYPE;
  _new_source jsonb;
  _src_arr jsonb;
  _already boolean;
BEGIN
  IF _email IS NULL OR length(trim(_email)) = 0 THEN RETURN NULL; END IF;

  _new_source := jsonb_build_object(
    'module', _module,
    'source_id', _source_id,
    'joined_at', now()
  );

  SELECT * INTO _existing FROM public.unified_identities
    WHERE email_normalized = _email::citext LIMIT 1;

  IF _existing.id IS NULL THEN
    INSERT INTO public.unified_identities (email_normalized, phone_normalized, display_name, sources, tags)
    VALUES (
      _email::citext,
      NULLIF(trim(coalesce(_phone,'')), ''),
      _display_name,
      jsonb_build_array(_new_source),
      CASE WHEN _tag IS NOT NULL THEN ARRAY[_tag] ELSE '{}'::text[] END
    )
    RETURNING id INTO _id;
    RETURN _id;
  END IF;

  -- Already in another module with same source? Skip duplicate entry
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(_existing.sources) s
    WHERE s->>'module' = _module AND (s->>'source_id') = _source_id::text
  ) INTO _already;

  IF _already THEN RETURN _existing.id; END IF;

  _src_arr := _existing.sources || jsonb_build_array(_new_source);

  UPDATE public.unified_identities
    SET sources = _src_arr,
        phone_normalized = COALESCE(_existing.phone_normalized, NULLIF(trim(coalesce(_phone,'')), '')),
        display_name = COALESCE(_existing.display_name, _display_name),
        tags = CASE
                 WHEN _tag IS NOT NULL AND NOT (_tag = ANY(_existing.tags))
                   THEN array_append(_existing.tags, _tag)
                 ELSE _existing.tags
               END,
        is_duplicate = (jsonb_array_length(_src_arr) > 1),
        updated_at = now()
    WHERE id = _existing.id;

  RETURN _existing.id;
END;
$$;

-- Trigger: profiles (IB System users)
CREATE OR REPLACE FUNCTION public.sync_unified_identity_from_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.correo IS NOT NULL AND length(trim(NEW.correo)) > 0 THEN
    PERFORM public.upsert_unified_identity(NEW.correo, NULL, NEW.nombre, 'ib_system', NEW.id, 'IB System');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_unified_from_profile ON public.profiles;
CREATE TRIGGER trg_sync_unified_from_profile
  AFTER INSERT OR UPDATE OF correo, nombre ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_unified_identity_from_profile();

-- Trigger: partner_users (portal users)
CREATE OR REPLACE FUNCTION public.sync_unified_identity_from_partner_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IS NOT NULL AND length(trim(NEW.email)) > 0 THEN
    PERFORM public.upsert_unified_identity(NEW.email, NEW.telefono, NEW.nombre, 'partner_portal', NEW.id, 'Partner Portal');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_unified_from_partner_user ON public.partner_users;
CREATE TRIGGER trg_sync_unified_from_partner_user
  AFTER INSERT OR UPDATE OF email, telefono, nombre ON public.partner_users
  FOR EACH ROW EXECUTE FUNCTION public.sync_unified_identity_from_partner_user();

-- Trigger: tournament_users
CREATE OR REPLACE FUNCTION public.sync_unified_identity_from_tournament_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IS NOT NULL AND length(trim(NEW.email)) > 0 THEN
    PERFORM public.upsert_unified_identity(NEW.email, NEW.phone, NEW.full_name, 'tournament', NEW.id, 'Tournament');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_unified_from_tournament_user ON public.tournament_users;
CREATE TRIGGER trg_sync_unified_from_tournament_user
  AFTER INSERT OR UPDATE OF email, phone, full_name ON public.tournament_users
  FOR EACH ROW EXECUTE FUNCTION public.sync_unified_identity_from_tournament_user();

-- ============================================
-- FASE 2: Tournament → stream_leads (CRM) con tag
-- ============================================

ALTER TABLE public.stream_leads
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_stream_leads_tags ON public.stream_leads USING GIN(tags);

CREATE OR REPLACE FUNCTION public.auto_create_stream_lead_on_tournament_register()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _default_stage_id uuid;
  _existing_lead_id uuid;
BEGIN
  -- Find existing lead by email
  SELECT id INTO _existing_lead_id FROM public.stream_leads
    WHERE lower(trim(correo)) = lower(trim(NEW.email))
    LIMIT 1;

  IF _existing_lead_id IS NOT NULL THEN
    -- Add Tournament tag if not present
    UPDATE public.stream_leads
      SET tags = CASE WHEN NOT ('Tournament' = ANY(tags))
                      THEN array_append(tags, 'Tournament')
                      ELSE tags END,
          telefono = COALESCE(telefono, NEW.phone),
          updated_at = now()
      WHERE id = _existing_lead_id;

    UPDATE public.tournament_users SET lead_id = _existing_lead_id WHERE id = NEW.id AND lead_id IS NULL;
    RETURN NEW;
  END IF;

  SELECT id INTO _default_stage_id FROM public.lead_pipeline_stages WHERE is_default = true LIMIT 1;
  IF _default_stage_id IS NULL THEN
    SELECT id INTO _default_stage_id FROM public.lead_pipeline_stages ORDER BY display_order LIMIT 1;
  END IF;

  INSERT INTO public.stream_leads (nombre, correo, telefono, source, pipeline_stage_id, opportunity_score, stream_count, tags)
  VALUES (NEW.full_name, NEW.email, NEW.phone, 'tournament', _default_stage_id, 30, 0, ARRAY['Tournament'])
  RETURNING id INTO _existing_lead_id;

  UPDATE public.tournament_users SET lead_id = _existing_lead_id WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_lead_tournament ON public.tournament_users;
CREATE TRIGGER trg_auto_create_lead_tournament
  AFTER INSERT ON public.tournament_users
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_stream_lead_on_tournament_register();

-- ============================================
-- Backfill existing data
-- ============================================

-- Backfill from profiles
INSERT INTO public.unified_identities (email_normalized, display_name, sources, tags)
SELECT
  p.correo::citext,
  p.nombre,
  jsonb_build_array(jsonb_build_object('module','ib_system','source_id',p.id,'joined_at',COALESCE(p.created_at, now()))),
  ARRAY['IB System']
FROM public.profiles p
WHERE p.correo IS NOT NULL AND length(trim(p.correo)) > 0
ON CONFLICT (email_normalized) DO NOTHING;

-- Backfill from partner_users
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT email, telefono, nombre, id FROM public.partner_users WHERE email IS NOT NULL LOOP
    PERFORM public.upsert_unified_identity(r.email, r.telefono, r.nombre, 'partner_portal', r.id, 'Partner Portal');
  END LOOP;
END $$;

-- Backfill from tournament_users
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT email, phone, full_name, id FROM public.tournament_users WHERE email IS NOT NULL LOOP
    PERFORM public.upsert_unified_identity(r.email, r.phone, r.full_name, 'tournament', r.id, 'Tournament');
  END LOOP;
END $$;
