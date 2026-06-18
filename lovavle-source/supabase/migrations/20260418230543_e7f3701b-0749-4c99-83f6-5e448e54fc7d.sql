-- 1. Add allow_anyone_with_link to live_rooms
ALTER TABLE public.live_rooms
ADD COLUMN IF NOT EXISTS allow_anyone_with_link boolean NOT NULL DEFAULT false;

-- 2. Create join requests table
CREATE TABLE IF NOT EXISTS public.live_room_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  requester_name text NOT NULL,
  requester_email text,
  requester_session_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ljr_room_status ON public.live_room_join_requests(room_id, status);
CREATE INDEX IF NOT EXISTS idx_ljr_session ON public.live_room_join_requests(requester_session_id);

ALTER TABLE public.live_room_join_requests ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies

-- Anyone can create a join request (guest knock)
CREATE POLICY "Anyone can create join request"
ON public.live_room_join_requests
FOR INSERT
TO public
WITH CHECK (true);

-- Anyone can read by session_id (guest checks own request)
CREATE POLICY "Anyone can read join requests"
ON public.live_room_join_requests
FOR SELECT
TO public
USING (true);

-- Host of the room or global_admin/admin can update (approve/reject)
CREATE POLICY "Host or admin can update join requests"
ON public.live_room_join_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.live_rooms lr
    WHERE lr.id = live_room_join_requests.room_id
    AND (lr.host_id = auth.uid() OR public.has_role(auth.uid(), 'global_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.live_rooms lr
    WHERE lr.id = live_room_join_requests.room_id
    AND (lr.host_id = auth.uid() OR public.has_role(auth.uid(), 'global_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Host or admin can delete
CREATE POLICY "Host or admin can delete join requests"
ON public.live_room_join_requests
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.live_rooms lr
    WHERE lr.id = live_room_join_requests.room_id
    AND (lr.host_id = auth.uid() OR public.has_role(auth.uid(), 'global_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

-- 4. Enable Realtime
ALTER TABLE public.live_room_join_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_room_join_requests;