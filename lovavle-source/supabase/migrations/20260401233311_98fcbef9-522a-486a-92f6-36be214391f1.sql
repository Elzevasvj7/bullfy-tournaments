
-- 1. Lead Notes table
CREATE TABLE public.lead_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.stream_leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  author_name TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lead roles can read notes"
ON public.lead_notes FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'global_admin'::app_role)
  OR has_role(auth.uid(), 'admin_ventas'::app_role)
  OR has_role(auth.uid(), 'ventas'::app_role)
  OR has_role(auth.uid(), 'marketing'::app_role)
);

CREATE POLICY "Lead roles can insert notes"
ON public.lead_notes FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'global_admin'::app_role)
    OR has_role(auth.uid(), 'admin_ventas'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
  )
);

CREATE INDEX idx_lead_notes_lead_id ON public.lead_notes(lead_id);

-- 2. Live Viewer Presence table
CREATE TABLE public.live_viewer_presence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL DEFAULT '',
  correo TEXT,
  telefono TEXT,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER DEFAULT 0,
  stream_lead_id UUID REFERENCES public.stream_leads(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.live_viewer_presence ENABLE ROW LEVEL SECURITY;

-- Anon and authenticated can insert (guests register without auth)
CREATE POLICY "Anyone can insert presence"
ON public.live_viewer_presence FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Anon and authenticated can update their own row (to set left_at)
CREATE POLICY "Anyone can update own presence"
ON public.live_viewer_presence FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Lead/admin roles can read all presence data
CREATE POLICY "Lead roles can read presence"
ON public.live_viewer_presence FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'global_admin'::app_role)
  OR has_role(auth.uid(), 'admin_ventas'::app_role)
  OR has_role(auth.uid(), 'ventas'::app_role)
  OR has_role(auth.uid(), 'marketing'::app_role)
);

-- Anon can read own presence (for updating)
CREATE POLICY "Anon can read own presence"
ON public.live_viewer_presence FOR SELECT
TO anon
USING (true);

CREATE INDEX idx_viewer_presence_room_id ON public.live_viewer_presence(room_id);
CREATE INDEX idx_viewer_presence_lead_id ON public.live_viewer_presence(stream_lead_id);
