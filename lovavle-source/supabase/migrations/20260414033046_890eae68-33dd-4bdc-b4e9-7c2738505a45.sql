
-- =============================================
-- NEWSLETTER EDITIONS
-- =============================================
CREATE TABLE public.newsletter_editions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','generating','reviewing','approved','sent','verified','failed')),
  environment TEXT NOT NULL DEFAULT 'test' CHECK (environment IN ('test','production')),
  frequency TEXT NOT NULL DEFAULT 'on_demand' CHECK (frequency IN ('daily','weekly','biweekly','monthly','on_demand')),
  target_roles TEXT[] NOT NULL DEFAULT '{}',
  content_json JSONB DEFAULT '{}'::jsonb,
  prediction_question TEXT,
  prediction_options JSONB DEFAULT '[]'::jsonb,
  prediction_correct_answer TEXT,
  verification_evidence JSONB,
  sent_count INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletter_editions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and marketing can manage newsletter editions"
  ON public.newsletter_editions FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'global_admin') OR
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'marketing')
  )
  WITH CHECK (
    has_role(auth.uid(), 'global_admin') OR
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'marketing')
  );

CREATE TRIGGER update_newsletter_editions_updated_at
  BEFORE UPDATE ON public.newsletter_editions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- NEWSLETTER AGENT LOGS
-- =============================================
CREATE TABLE public.newsletter_agent_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  edition_id UUID NOT NULL REFERENCES public.newsletter_editions(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  agent_role TEXT NOT NULL,
  agent_emoji TEXT DEFAULT '🤖',
  action TEXT NOT NULL,
  input_summary TEXT,
  output_summary TEXT,
  revision_requested_by TEXT,
  revision_notes TEXT,
  iteration_number INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletter_agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read agent logs"
  ON public.newsletter_agent_logs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service can insert agent logs"
  ON public.newsletter_agent_logs FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'global_admin') OR
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'marketing')
  );

-- =============================================
-- NEWSLETTER PREDICTIONS (user responses)
-- =============================================
CREATE TABLE public.newsletter_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  edition_id UUID NOT NULL REFERENCES public.newsletter_editions(id) ON DELETE CASCADE,
  user_id UUID,
  user_email TEXT NOT NULL,
  user_name TEXT,
  selected_option TEXT NOT NULL,
  is_correct BOOLEAN,
  points_earned INTEGER DEFAULT 0,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(edition_id, user_email)
);

ALTER TABLE public.newsletter_predictions ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a prediction (public endpoint)
CREATE POLICY "Anyone can submit predictions"
  ON public.newsletter_predictions FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Admins can see all predictions
CREATE POLICY "Admins can read all predictions"
  ON public.newsletter_predictions FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'global_admin') OR
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'marketing')
  );

-- Anon can read for public results landing
CREATE POLICY "Anon can read predictions for results"
  ON public.newsletter_predictions FOR SELECT TO anon
  USING (true);

-- Service can update predictions (set is_correct and points)
CREATE POLICY "Admins can update predictions"
  ON public.newsletter_predictions FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'global_admin') OR
    has_role(auth.uid(), 'admin')
  );

-- =============================================
-- NEWSLETTER PREDICTION RESULTS (verified)
-- =============================================
CREATE TABLE public.newsletter_prediction_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  edition_id UUID NOT NULL REFERENCES public.newsletter_editions(id) ON DELETE CASCADE UNIQUE,
  correct_answer TEXT NOT NULL,
  evidence_urls TEXT[] DEFAULT '{}',
  evidence_summary TEXT NOT NULL,
  total_responses INTEGER DEFAULT 0,
  option_distribution JSONB DEFAULT '{}'::jsonb,
  verified_by_agent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletter_prediction_results ENABLE ROW LEVEL SECURITY;

-- Public read for results landing page
CREATE POLICY "Anyone can read prediction results"
  ON public.newsletter_prediction_results FOR SELECT TO anon, authenticated
  USING (true);

-- Only admins can insert results
CREATE POLICY "Admins can insert prediction results"
  ON public.newsletter_prediction_results FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'global_admin') OR
    has_role(auth.uid(), 'admin')
  );

-- Indexes for performance
CREATE INDEX idx_newsletter_agent_logs_edition ON public.newsletter_agent_logs(edition_id);
CREATE INDEX idx_newsletter_predictions_edition ON public.newsletter_predictions(edition_id);
CREATE INDEX idx_newsletter_editions_status ON public.newsletter_editions(status);
CREATE INDEX idx_newsletter_editions_env ON public.newsletter_editions(environment);
