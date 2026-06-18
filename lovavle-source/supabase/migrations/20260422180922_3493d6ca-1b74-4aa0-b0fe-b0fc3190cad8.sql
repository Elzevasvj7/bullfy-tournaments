CREATE TABLE IF NOT EXISTS public.broker_prop_settings (
  id integer PRIMARY KEY DEFAULT 1,
  ganancia_broker numeric(10,2) NOT NULL DEFAULT 4,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT broker_prop_settings_singleton CHECK (id = 1)
);

ALTER TABLE public.broker_prop_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view broker prop settings"
ON public.broker_prop_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Admins can insert broker prop settings"
ON public.broker_prop_settings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Admins can update broker prop settings"
ON public.broker_prop_settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

CREATE TRIGGER update_broker_prop_settings_updated_at
BEFORE UPDATE ON public.broker_prop_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.broker_prop_settings (id, ganancia_broker)
VALUES (1, 4)
ON CONFLICT (id) DO NOTHING;