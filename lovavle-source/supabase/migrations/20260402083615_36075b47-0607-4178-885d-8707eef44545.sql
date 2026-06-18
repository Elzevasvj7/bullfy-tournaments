
-- 1. Create all tables first
CREATE TABLE public.marketing_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  promo_code TEXT,
  benefits TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.campaign_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  instruction TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'Historia',
  file_urls TEXT[] DEFAULT '{}'::TEXT[],
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.campaign_ib_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  ib_id UUID NOT NULL,
  assigned_by UUID,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, ib_id)
);

CREATE TABLE public.campaign_task_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.campaign_tasks(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES public.campaign_ib_assignments(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, assignment_id)
);

-- 2. Enable RLS
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_ib_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_task_completions ENABLE ROW LEVEL SECURITY;

-- 3. Policies for marketing_campaigns
CREATE POLICY "mktg_admin_manage_campaigns"
ON public.marketing_campaigns FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role));

CREATE POLICY "read_active_campaigns"
ON public.marketing_campaigns FOR SELECT TO authenticated
USING (status IN ('active', 'completed'));

CREATE POLICY "ib_read_assigned_campaigns"
ON public.marketing_campaigns FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.campaign_ib_assignments cia
  JOIN public.profiles p ON p.ib_id = cia.ib_id
  WHERE cia.campaign_id = marketing_campaigns.id
    AND p.id = auth.uid()
));

-- 4. Policies for campaign_tasks
CREATE POLICY "mktg_admin_manage_tasks"
ON public.campaign_tasks FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role));

CREATE POLICY "auth_read_tasks"
ON public.campaign_tasks FOR SELECT TO authenticated
USING (true);

-- 5. Policies for campaign_ib_assignments
CREATE POLICY "mktg_admin_manage_assignments"
ON public.campaign_ib_assignments FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role));

CREATE POLICY "ib_read_own_assignments"
ON public.campaign_ib_assignments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ib_id = campaign_ib_assignments.ib_id
));

-- 6. Policies for campaign_task_completions
CREATE POLICY "mktg_admin_read_completions"
ON public.campaign_task_completions FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role));

CREATE POLICY "ib_insert_own_completions"
ON public.campaign_task_completions FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.campaign_ib_assignments cia
  JOIN public.profiles p ON p.ib_id = cia.ib_id
  WHERE cia.id = campaign_task_completions.assignment_id
    AND p.id = auth.uid()
));

CREATE POLICY "ib_read_own_completions"
ON public.campaign_task_completions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.campaign_ib_assignments cia
  JOIN public.profiles p ON p.ib_id = cia.ib_id
  WHERE cia.id = campaign_task_completions.assignment_id
    AND p.id = auth.uid()
));

CREATE POLICY "ib_delete_own_completions"
ON public.campaign_task_completions FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.campaign_ib_assignments cia
  JOIN public.profiles p ON p.ib_id = cia.ib_id
  WHERE cia.id = campaign_task_completions.assignment_id
    AND p.id = auth.uid()
));

-- 7. Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('campaign-assets', 'campaign-assets', true);

CREATE POLICY "public_read_campaign_assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'campaign-assets');

CREATE POLICY "mktg_upload_campaign_assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'campaign-assets' AND (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role)
));

CREATE POLICY "mktg_delete_campaign_assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'campaign-assets' AND (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role)
));

-- 8. Trigger
CREATE TRIGGER update_marketing_campaigns_updated_at
BEFORE UPDATE ON public.marketing_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
