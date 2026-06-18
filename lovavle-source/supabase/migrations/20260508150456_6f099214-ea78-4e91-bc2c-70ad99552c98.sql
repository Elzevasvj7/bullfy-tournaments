CREATE INDEX IF NOT EXISTS idx_stream_leads_pipeline_stage ON public.stream_leads (pipeline_stage_id);
CREATE INDEX IF NOT EXISTS idx_stream_leads_opportunity_score ON public.stream_leads (opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_stream_leads_assigned_to ON public.stream_leads (assigned_to);
CREATE INDEX IF NOT EXISTS idx_stream_leads_partner_portal ON public.stream_leads (partner_portal_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON public.lead_activities (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_created_at ON public.lead_activities (created_at DESC);