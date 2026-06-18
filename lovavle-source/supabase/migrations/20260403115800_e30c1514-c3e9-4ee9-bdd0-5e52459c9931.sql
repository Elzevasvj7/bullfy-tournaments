
-- Per-streamer monetization toggle & overrides
CREATE TABLE public.live_streamer_monetization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  custom_dolares_por_lead numeric,
  custom_bono_visualizaciones_monto numeric,
  custom_bono_streams_monto numeric,
  custom_bono_interacciones_monto numeric,
  custom_bono_votacion_monto numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_streamer_monetization ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins manage streamer monetization"
ON public.live_streamer_monetization
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

-- Streamers can view their own
CREATE POLICY "Streamers view own monetization"
ON public.live_streamer_monetization
FOR SELECT
TO authenticated
USING (auth.uid() = host_id);

-- Trigger for updated_at
CREATE TRIGGER update_live_streamer_monetization_updated_at
BEFORE UPDATE ON public.live_streamer_monetization
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
