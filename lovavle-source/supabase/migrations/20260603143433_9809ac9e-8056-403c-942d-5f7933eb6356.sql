-- Phase 2 Lead System performance: indexes on hot query paths

-- stream_leads: Kanban orders by opportunity_score and filters by stage/assignee
CREATE INDEX IF NOT EXISTS idx_stream_leads_pipeline_stage_id ON public.stream_leads (pipeline_stage_id);
CREATE INDEX IF NOT EXISTS idx_stream_leads_opportunity_score ON public.stream_leads (opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_stream_leads_assigned_to ON public.stream_leads (assigned_to);
CREATE INDEX IF NOT EXISTS idx_stream_leads_partner_portal_id ON public.stream_leads (partner_portal_id);

-- Detail dialog sub-queries
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_created ON public.lead_activities (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_created ON public.lead_notes (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_viewer_presence_lead_joined ON public.live_viewer_presence (stream_lead_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_stream_lead_participations_lead_joined ON public.stream_lead_participations (lead_id, joined_at DESC);
