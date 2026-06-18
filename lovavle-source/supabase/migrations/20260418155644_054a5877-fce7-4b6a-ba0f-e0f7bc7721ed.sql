-- ============================================
-- 1. ALTER live_rooms (additive, retrocompatible)
-- ============================================
ALTER TABLE public.live_rooms
  ADD COLUMN IF NOT EXISTS room_type text NOT NULL DEFAULT 'broadcast',
  ADD COLUMN IF NOT EXISTS max_participants integer NOT NULL DEFAULT 16,
  ADD COLUMN IF NOT EXISTS recording_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS breakout_parent_id uuid REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS egress_id text;

-- Validación por trigger (no CHECK constraint para flexibilidad)
CREATE OR REPLACE FUNCTION public.validate_room_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.room_type NOT IN ('broadcast', 'meeting', 'webinar_pro') THEN
    RAISE EXCEPTION 'room_type must be broadcast, meeting or webinar_pro';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_room_type_trigger ON public.live_rooms;
CREATE TRIGGER validate_room_type_trigger
BEFORE INSERT OR UPDATE ON public.live_rooms
FOR EACH ROW EXECUTE FUNCTION public.validate_room_type();

-- ============================================
-- 2. live_feature_access table
-- ============================================
CREATE TABLE IF NOT EXISTS public.live_feature_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL,
  role app_role,
  user_id uuid,
  enabled boolean NOT NULL DEFAULT false,
  granted_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_feature_access_target_check CHECK (
    (role IS NOT NULL AND user_id IS NULL) OR
    (role IS NULL AND user_id IS NOT NULL)
  ),
  CONSTRAINT live_feature_access_unique_role UNIQUE NULLS NOT DISTINCT (feature_key, role),
  CONSTRAINT live_feature_access_unique_user UNIQUE NULLS NOT DISTINCT (feature_key, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lfa_feature_role ON public.live_feature_access(feature_key, role);
CREATE INDEX IF NOT EXISTS idx_lfa_feature_user ON public.live_feature_access(feature_key, user_id);

ALTER TABLE public.live_feature_access ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read their own permissions (for hook to work)
CREATE POLICY "Users can view feature access"
ON public.live_feature_access FOR SELECT
TO authenticated
USING (true);

-- Only admins can manage
CREATE POLICY "Admins manage feature access"
ON public.live_feature_access FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

CREATE TRIGGER lfa_updated_at
BEFORE UPDATE ON public.live_feature_access
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 3. live_breakout_assignments table
-- ============================================
CREATE TABLE IF NOT EXISTS public.live_breakout_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_room_id uuid NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  breakout_room_id uuid NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  participant_identity text NOT NULL,
  participant_name text,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid,
  UNIQUE (parent_room_id, participant_identity)
);

CREATE INDEX IF NOT EXISTS idx_lba_parent ON public.live_breakout_assignments(parent_room_id);
CREATE INDEX IF NOT EXISTS idx_lba_breakout ON public.live_breakout_assignments(breakout_room_id);

ALTER TABLE public.live_breakout_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read breakout assignments"
ON public.live_breakout_assignments FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Hosts manage breakout assignments"
ON public.live_breakout_assignments FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.live_rooms WHERE id = parent_room_id AND host_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'global_admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.live_rooms WHERE id = parent_room_id AND host_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'global_admin')
);

-- ============================================
-- 4. live_meeting_polls table
-- ============================================
CREATE TABLE IF NOT EXISTS public.live_meeting_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  votes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lmp_room ON public.live_meeting_polls(room_id);

ALTER TABLE public.live_meeting_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read polls"
ON public.live_meeting_polls FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Hosts manage polls"
ON public.live_meeting_polls FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.live_rooms WHERE id = room_id AND host_id = auth.uid())
);

CREATE POLICY "Hosts update polls"
ON public.live_meeting_polls FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.live_rooms WHERE id = room_id AND host_id = auth.uid())
  OR true -- viewers can vote (votes update)
);

CREATE POLICY "Hosts delete polls"
ON public.live_meeting_polls FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.live_rooms WHERE id = room_id AND host_id = auth.uid())
);

-- ============================================
-- 5. Realtime
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_feature_access;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_breakout_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_meeting_polls;

-- ============================================
-- 6. Seeds: defaults por rol
-- ============================================
-- Admin & Global Admin: todo habilitado
INSERT INTO public.live_feature_access (feature_key, role, enabled)
SELECT f, r::app_role, true
FROM unnest(ARRAY['meeting_mode','webinar_pro_controls','breakout_rooms','recording_egress','live_transcription','polls_in_meeting','whiteboard']) f,
     unnest(ARRAY['admin','global_admin']) r
ON CONFLICT DO NOTHING;

-- Marketing: meeting + transcription + polls
INSERT INTO public.live_feature_access (feature_key, role, enabled)
SELECT f, 'marketing'::app_role, true
FROM unnest(ARRAY['meeting_mode','live_transcription','polls_in_meeting']) f
ON CONFLICT DO NOTHING;

-- BD, Operaciones, Dealing, Ventas: solo broadcast (todas en false)
INSERT INTO public.live_feature_access (feature_key, role, enabled)
SELECT f, r::app_role, false
FROM unnest(ARRAY['meeting_mode','webinar_pro_controls','breakout_rooms','recording_egress','live_transcription','polls_in_meeting','whiteboard']) f,
     unnest(ARRAY['bd','operaciones','admin_operaciones','dealing','ventas','admin_ventas']) r
ON CONFLICT DO NOTHING;

-- IB Externo: solo broadcast (todas en false)
INSERT INTO public.live_feature_access (feature_key, role, enabled)
SELECT f, 'ib_externo'::app_role, false
FROM unnest(ARRAY['meeting_mode','webinar_pro_controls','breakout_rooms','recording_egress','live_transcription','polls_in_meeting','whiteboard']) f
ON CONFLICT DO NOTHING;

-- ============================================
-- 7. Helper function: check feature access
-- ============================================
CREATE OR REPLACE FUNCTION public.has_live_feature_access(_user_id uuid, _feature_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_override boolean;
  _role_access boolean;
BEGIN
  -- 1. Check user override first (highest priority)
  SELECT enabled INTO _user_override
  FROM public.live_feature_access
  WHERE user_id = _user_id AND feature_key = _feature_key
  LIMIT 1;

  IF _user_override IS NOT NULL THEN
    RETURN _user_override;
  END IF;

  -- 2. Check by any role the user has (if any role grants access, allow)
  SELECT bool_or(lfa.enabled) INTO _role_access
  FROM public.user_roles ur
  JOIN public.live_feature_access lfa ON lfa.role = ur.role
  WHERE ur.user_id = _user_id AND lfa.feature_key = _feature_key;

  RETURN COALESCE(_role_access, false);
END;
$$;

-- ============================================
-- 8. Notification trigger: feature access changes for IB users
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_feature_access_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _feature_label text;
  _action text;
BEGIN
  -- Only notify for user-specific overrides (not role-wide)
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  _feature_label := CASE NEW.feature_key
    WHEN 'meeting_mode' THEN 'Modo Reunión (Zoom)'
    WHEN 'webinar_pro_controls' THEN 'Controles Webinar Pro'
    WHEN 'breakout_rooms' THEN 'Salas de Breakout'
    WHEN 'recording_egress' THEN 'Grabación en Servidor'
    WHEN 'live_transcription' THEN 'Transcripción en Vivo'
    WHEN 'polls_in_meeting' THEN 'Encuestas en Meeting'
    WHEN 'whiteboard' THEN 'Pizarra Compartida'
    ELSE NEW.feature_key
  END;

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.enabled IS DISTINCT FROM NEW.enabled) THEN
    _action := CASE WHEN NEW.enabled THEN 'habilitada' ELSE 'deshabilitada' END;

    INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
    VALUES (
      NEW.user_id,
      'live_feature_access',
      'Permiso de video actualizado',
      'La función "' || _feature_label || '" fue ' || _action || ' para tu cuenta.',
      NEW.id::text,
      'live_feature_access'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_feature_access_change_trigger ON public.live_feature_access;
CREATE TRIGGER notify_feature_access_change_trigger
AFTER INSERT OR UPDATE ON public.live_feature_access
FOR EACH ROW EXECUTE FUNCTION public.notify_feature_access_change();

-- ============================================
-- 9. Cleanup: close breakouts when parent ends
-- ============================================
CREATE OR REPLACE FUNCTION public.close_breakouts_on_parent_end()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ended' AND OLD.status <> 'ended' THEN
    UPDATE public.live_rooms
    SET status = 'ended', ended_at = now(), updated_at = now()
    WHERE breakout_parent_id = NEW.id AND status <> 'ended';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS close_breakouts_trigger ON public.live_rooms;
CREATE TRIGGER close_breakouts_trigger
AFTER UPDATE ON public.live_rooms
FOR EACH ROW EXECUTE FUNCTION public.close_breakouts_on_parent_end();