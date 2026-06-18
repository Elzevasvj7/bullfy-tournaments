-- Per-host saved preferences for waiting-room configuration.
-- Lets streamers/portal admins reuse their last waiting-room setup across new rooms.
CREATE TABLE IF NOT EXISTS public.live_host_waiting_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  waiting_mode text NOT NULL DEFAULT 'template',
  waiting_template_id uuid REFERENCES public.live_waiting_templates(id) ON DELETE SET NULL,
  waiting_bg_path text,
  waiting_bg_type text,
  waiting_title text,
  waiting_subtitle text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_host_waiting_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own waiting prefs select"
  ON public.live_host_waiting_preferences FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users manage their own waiting prefs insert"
  ON public.live_host_waiting_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage their own waiting prefs update"
  ON public.live_host_waiting_preferences FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users manage their own waiting prefs delete"
  ON public.live_host_waiting_preferences FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER set_live_host_waiting_prefs_updated_at
  BEFORE UPDATE ON public.live_host_waiting_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();