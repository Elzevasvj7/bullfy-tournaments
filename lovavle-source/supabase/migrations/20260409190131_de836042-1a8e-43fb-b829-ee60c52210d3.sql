
-- Table for configurable alert keywords/phrases
CREATE TABLE public.live_alert_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  category text DEFAULT 'general',
  active boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_alert_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view keywords"
  ON public.live_alert_keywords FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert keywords"
  ON public.live_alert_keywords FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'global_admin')
  );

CREATE POLICY "Admins can update keywords"
  ON public.live_alert_keywords FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'global_admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'global_admin')
  );

CREATE POLICY "Admins can delete keywords"
  ON public.live_alert_keywords FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'global_admin')
  );

CREATE TRIGGER update_live_alert_keywords_updated_at
  BEFORE UPDATE ON public.live_alert_keywords
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table for detected keyword alerts in streams
CREATE TABLE public.live_keyword_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id uuid REFERENCES public.live_alert_keywords(id) ON DELETE SET NULL,
  keyword_text text NOT NULL,
  room_id uuid REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  host_id uuid NOT NULL,
  transcript_excerpt text,
  detected_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_keyword_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view keyword alerts"
  ON public.live_keyword_alerts FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Insert keyword alerts"
  ON public.live_keyword_alerts FOR INSERT TO authenticated
  WITH CHECK (true);
