
CREATE TABLE public.tournament_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  reference_id text,
  reference_type text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tnotif_user_read ON public.tournament_notifications(user_id, read, created_at DESC);

ALTER TABLE public.tournament_notifications ENABLE ROW LEVEL SECURITY;

-- Sólo lectura/update vía edge functions con sesión propia del torneo; el cliente leerá vía función segura.
-- Mantenemos lectura abierta a user_id correspondiente cuando la sesión auth coincida (no aplica al sistema tournament que no usa auth.users); por tanto se accede vía edge function.
CREATE POLICY tnotif_owner_read ON public.tournament_notifications FOR SELECT USING (false);
CREATE POLICY tnotif_owner_update ON public.tournament_notifications FOR UPDATE USING (false);

ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_notifications;
ALTER TABLE public.tournament_notifications REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.tournament_notify(
  _user_id uuid, _type text, _title text, _message text,
  _link text DEFAULT NULL, _ref_type text DEFAULT NULL, _ref_id text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.tournament_notifications(user_id, type, title, message, link, reference_type, reference_id)
  VALUES (_user_id, _type, _title, _message, _link, _ref_type, _ref_id)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
