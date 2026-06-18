
-- 1. Add 'bullfy_family' to app_role enum (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'bullfy_family'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'bullfy_family';
  END IF;
END $$;

-- 2. Update validate_room_type to allow 'bullfy_family'
CREATE OR REPLACE FUNCTION public.validate_room_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.room_type NOT IN ('broadcast', 'meeting', 'webinar_pro', 'bullfy_family') THEN
    RAISE EXCEPTION 'room_type must be broadcast, meeting, webinar_pro or bullfy_family';
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Create live_room_invitations table
CREATE TABLE IF NOT EXISTS public.live_room_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  invited_user_id uuid NOT NULL,
  invited_by uuid,
  invited_at timestamptz NOT NULL DEFAULT now(),
  email_sent_at timestamptz,
  UNIQUE(room_id, invited_user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_room_invitations_room ON public.live_room_invitations(room_id);
CREATE INDEX IF NOT EXISTS idx_live_room_invitations_user ON public.live_room_invitations(invited_user_id);

ALTER TABLE public.live_room_invitations ENABLE ROW LEVEL SECURITY;

-- Hosts can see invitations for their own rooms; admins see all
CREATE POLICY "Hosts and admins can view invitations"
ON public.live_room_invitations
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.live_rooms lr WHERE lr.id = room_id AND lr.host_id = auth.uid())
  OR has_role(auth.uid(), 'global_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR invited_user_id = auth.uid()
);

CREATE POLICY "Hosts and admins can create invitations"
ON public.live_room_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.live_rooms lr WHERE lr.id = room_id AND lr.host_id = auth.uid())
  OR has_role(auth.uid(), 'global_admin'::app_role)
);

CREATE POLICY "Hosts and admins can delete invitations"
ON public.live_room_invitations
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.live_rooms lr WHERE lr.id = room_id AND lr.host_id = auth.uid())
  OR has_role(auth.uid(), 'global_admin'::app_role)
);

CREATE POLICY "Hosts and admins can update invitations"
ON public.live_room_invitations
FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.live_rooms lr WHERE lr.id = room_id AND lr.host_id = auth.uid())
  OR has_role(auth.uid(), 'global_admin'::app_role)
);
