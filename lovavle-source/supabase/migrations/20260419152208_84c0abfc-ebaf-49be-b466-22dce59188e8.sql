-- 1. Add slug + auto_approve to live_rooms
ALTER TABLE public.live_rooms
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS auto_approve_join_requests boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS live_rooms_slug_unique
  ON public.live_rooms (slug)
  WHERE slug IS NOT NULL;

-- 2. Bullfy Family invited members table
CREATE TABLE IF NOT EXISTS public.bullfy_family_room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS bullfy_family_room_members_room_idx
  ON public.bullfy_family_room_members(room_id);
CREATE INDEX IF NOT EXISTS bullfy_family_room_members_user_idx
  ON public.bullfy_family_room_members(user_id);

ALTER TABLE public.bullfy_family_room_members ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read (needed to verify access on join)
CREATE POLICY "Anyone can read family room members"
  ON public.bullfy_family_room_members
  FOR SELECT
  USING (true);

-- Only host of the room or admins can manage members
CREATE POLICY "Host or admins can insert family members"
  ON public.bullfy_family_room_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.live_rooms lr
      WHERE lr.id = room_id AND lr.host_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
  );

CREATE POLICY "Host or admins can update family members"
  ON public.bullfy_family_room_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.live_rooms lr
      WHERE lr.id = room_id AND lr.host_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
  );

CREATE POLICY "Host or admins can delete family members"
  ON public.bullfy_family_room_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.live_rooms lr
      WHERE lr.id = room_id AND lr.host_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
  );