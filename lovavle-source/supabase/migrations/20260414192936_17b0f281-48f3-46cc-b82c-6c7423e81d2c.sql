
-- Breaking News queue table
CREATE TABLE public.breaking_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  headline TEXT NOT NULL,
  summary TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT,
  urgency_score INTEGER NOT NULL DEFAULT 5 CHECK (urgency_score >= 1 AND urgency_score <= 10),
  proposed_by TEXT NOT NULL, -- agent name: Marcus Chen or Vanessa Drake
  proposed_by_emoji TEXT DEFAULT '🔍',
  category TEXT NOT NULL DEFAULT 'financial', -- financial or gossip
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, discarded, sent
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.breaking_news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read breaking_news"
  ON public.breaking_news FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update breaking_news"
  ON public.breaking_news FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Service role can insert breaking_news"
  ON public.breaking_news FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Service role insert auth breaking_news"
  ON public.breaking_news FOR INSERT TO authenticated WITH CHECK (true);

-- Agent learning log table
CREATE TABLE public.agent_learning_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  edition_id UUID REFERENCES public.newsletter_editions(id) ON DELETE SET NULL,
  agent_name TEXT NOT NULL,
  metric_type TEXT NOT NULL, -- open_rate, click_rate, prediction_accuracy, style_correction, manual_edit
  metric_value NUMERIC,
  lesson_learned TEXT,
  context_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_learning_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read agent_learning_log"
  ON public.agent_learning_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert agent_learning_log"
  ON public.agent_learning_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Anon can insert agent_learning_log"
  ON public.agent_learning_log FOR INSERT TO anon WITH CHECK (true);

-- Add gossip_mode column to newsletter_editions
ALTER TABLE public.newsletter_editions 
  ADD COLUMN IF NOT EXISTS gossip_mode BOOLEAN DEFAULT false;

-- Enable realtime for breaking_news
ALTER PUBLICATION supabase_realtime ADD TABLE public.breaking_news;
