-- ============================================================
-- Google Calendar Integration — Base infrastructure
-- ============================================================

-- 1. Connections table: stores OAuth tokens per user
CREATE TABLE public.google_calendar_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('internal', 'ib_externo')),
  google_email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['https://www.googleapis.com/auth/calendar.events'],
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  active BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, google_email)
);

CREATE INDEX idx_gcal_connections_user ON public.google_calendar_connections(user_id);
CREATE INDEX idx_gcal_connections_active ON public.google_calendar_connections(active) WHERE active = true;

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

-- 2. Events log table
CREATE TABLE public.calendar_events_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  connection_id UUID REFERENCES public.google_calendar_connections(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('campaign_task', 'lead_followup', 'ops_deadline', 'manual', 'other')),
  source_id UUID,
  google_event_id TEXT,
  google_event_link TEXT,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'updated', 'cancelled', 'failed', 'ics_fallback')),
  last_action TEXT,
  error_message TEXT,
  delivery_method TEXT NOT NULL DEFAULT 'google_api' CHECK (delivery_method IN ('google_api', 'ics_email')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cal_events_user ON public.calendar_events_log(user_id);
CREATE INDEX idx_cal_events_source ON public.calendar_events_log(source_type, source_id);
CREATE INDEX idx_cal_events_status ON public.calendar_events_log(status);

ALTER TABLE public.calendar_events_log ENABLE ROW LEVEL SECURITY;

-- 3. Trigger for updated_at
CREATE TRIGGER update_gcal_connections_updated_at
BEFORE UPDATE ON public.google_calendar_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cal_events_log_updated_at
BEFORE UPDATE ON public.calendar_events_log
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. RLS Policies — google_calendar_connections
CREATE POLICY "Users can view their own calendar connections"
ON public.google_calendar_connections
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar connections"
ON public.google_calendar_connections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar connections"
ON public.google_calendar_connections
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar connections"
ON public.google_calendar_connections
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all calendar connections"
ON public.google_calendar_connections
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'global_admin'::app_role)
);

CREATE POLICY "Admins can manage all calendar connections"
ON public.google_calendar_connections
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'global_admin'::app_role)
);

-- 5. RLS Policies — calendar_events_log
CREATE POLICY "Users can view their own calendar events log"
ON public.calendar_events_log
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar events log"
ON public.calendar_events_log
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar events log"
ON public.calendar_events_log
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all calendar events log"
ON public.calendar_events_log
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'global_admin'::app_role)
);

CREATE POLICY "Admins can manage all calendar events log"
ON public.calendar_events_log
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'global_admin'::app_role)
);