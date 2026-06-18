
CREATE TABLE public.simulation_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  simulation_type TEXT NOT NULL DEFAULT 'x12',
  inputs JSONB NOT NULL,
  results JSONB NOT NULL,
  ai_analysis JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_simulation_snapshots_code ON public.simulation_snapshots(code);

ALTER TABLE public.simulation_snapshots ENABLE ROW LEVEL SECURITY;

-- Public read by code (anyone with the link can view)
CREATE POLICY "Public read simulation snapshots"
  ON public.simulation_snapshots
  FOR SELECT
  USING (true);

-- Only authenticated users can insert (admin check delegated to app/edge)
CREATE POLICY "Authenticated can insert snapshots"
  ON public.simulation_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Creator can update (for AI analysis backfill)
CREATE POLICY "Creator can update own snapshots"
  ON public.simulation_snapshots
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);
