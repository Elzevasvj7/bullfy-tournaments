-- 1. Add preferred_timezone to profiles, ibs, sub_ibs
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_timezone TEXT NOT NULL DEFAULT 'America/Bogota';
ALTER TABLE public.ibs ADD COLUMN IF NOT EXISTS preferred_timezone TEXT NOT NULL DEFAULT 'America/Bogota';
ALTER TABLE public.sub_ibs ADD COLUMN IF NOT EXISTS preferred_timezone TEXT NOT NULL DEFAULT 'America/Bogota';

-- 2. Add fields to marketing_campaigns
ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS recipient_mode TEXT NOT NULL DEFAULT 'all' CHECK (recipient_mode IN ('all', 'manual')),
  ADD COLUMN IF NOT EXISTS manual_recipients TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reminder_hour INT NOT NULL DEFAULT 9 CHECK (reminder_hour BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS operative_hours_start INT NOT NULL DEFAULT 6 CHECK (operative_hours_start BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS operative_hours_end INT NOT NULL DEFAULT 21 CHECK (operative_hours_end BETWEEN 0 AND 23);

-- 3. Add recipient_email to calendar_events_log
ALTER TABLE public.calendar_events_log
  ADD COLUMN IF NOT EXISTS recipient_email TEXT;

-- Make user_id nullable for manual sends (where there's no system user)
ALTER TABLE public.calendar_events_log ALTER COLUMN user_id DROP NOT NULL;

-- 4. Create relevant_events table
CREATE TABLE IF NOT EXISTS public.relevant_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  timezone TEXT NOT NULL DEFAULT 'America/Bogota',
  relevance_score INT NOT NULL DEFAULT 5 CHECK (relevance_score BETWEEN 1 AND 10),
  selected_reminders INT[] NOT NULL DEFAULT ARRAY[600, 120, 10],
  recipient_mode TEXT NOT NULL DEFAULT 'all' CHECK (recipient_mode IN ('all', 'manual')),
  manual_recipients TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'sent')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notification_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.relevant_events ENABLE ROW LEVEL SECURITY;

-- RLS: Marketing/Admin/Global Admin full CRUD
CREATE POLICY "Marketing/Admin can view all relevant events"
ON public.relevant_events FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'marketing'::app_role) OR
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'global_admin'::app_role) OR
  public.has_role(auth.uid(), 'bullfy_family'::app_role)
);

CREATE POLICY "Marketing/Admin can insert relevant events"
ON public.relevant_events FOR INSERT
TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'marketing'::app_role) OR
   public.has_role(auth.uid(), 'admin'::app_role) OR
   public.has_role(auth.uid(), 'global_admin'::app_role))
  AND auth.uid() = created_by
);

CREATE POLICY "Marketing/Admin can update relevant events"
ON public.relevant_events FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'marketing'::app_role) OR
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'global_admin'::app_role)
);

CREATE POLICY "Marketing/Admin can delete relevant events"
ON public.relevant_events FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'global_admin'::app_role)
);

-- Trigger for updated_at
CREATE TRIGGER update_relevant_events_updated_at
BEFORE UPDATE ON public.relevant_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for upcoming events queries
CREATE INDEX IF NOT EXISTS idx_relevant_events_starts_at ON public.relevant_events(starts_at) WHERE status = 'scheduled';