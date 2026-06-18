
-- Table for stream analysis results
CREATE TABLE public.live_stream_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  host_id UUID NOT NULL,
  transcript TEXT,
  topics TEXT[] DEFAULT '{}',
  faqs TEXT[] DEFAULT '{}',
  objections TEXT[] DEFAULT '{}',
  products_mentioned TEXT[] DEFAULT '{}',
  summary TEXT,
  processing_status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id)
);

ALTER TABLE public.live_stream_analysis ENABLE ROW LEVEL SECURITY;

-- Authenticated users with sales/admin roles can read
CREATE POLICY "Sales and admin can view stream analysis"
ON public.live_stream_analysis
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'global_admin') OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'ventas') OR
  public.has_role(auth.uid(), 'admin_ventas') OR
  host_id = auth.uid()
);

-- Service role inserts (via edge functions)
CREATE POLICY "Service can insert stream analysis"
ON public.live_stream_analysis
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Service can update stream analysis"
ON public.live_stream_analysis
FOR UPDATE
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_live_stream_analysis_updated_at
BEFORE UPDATE ON public.live_stream_analysis
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
