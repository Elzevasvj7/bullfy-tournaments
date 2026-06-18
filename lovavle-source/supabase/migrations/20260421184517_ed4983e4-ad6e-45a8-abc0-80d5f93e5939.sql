ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_leads;
ALTER TABLE public.stream_leads REPLICA IDENTITY FULL;