
-- Create ops_requests table for BD operational requests
CREATE TABLE public.ops_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ib_id uuid NOT NULL REFERENCES public.ibs(id) ON DELETE CASCADE,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'nuevo',
  created_by uuid NOT NULL,
  assigned_to uuid,
  taken_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  taken_at timestamptz,
  completed_at timestamptz,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ops_requests ENABLE ROW LEVEL SECURITY;

-- BDs can insert requests for their own IBs
CREATE POLICY "BDs can insert own requests"
  ON public.ops_requests FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (SELECT 1 FROM public.ibs WHERE ibs.id = ops_requests.ib_id AND ibs.created_by = auth.uid())
  );

-- BDs can read requests for their own IBs
CREATE POLICY "BDs can read own requests"
  ON public.ops_requests FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.ibs WHERE ibs.id = ops_requests.ib_id AND ibs.created_by = auth.uid())
  );

-- Ops and admins can manage all requests
CREATE POLICY "Ops and admins can manage requests"
  ON public.ops_requests FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'operaciones') OR
    has_role(auth.uid(), 'admin_operaciones') OR
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'global_admin')
  )
  WITH CHECK (
    has_role(auth.uid(), 'operaciones') OR
    has_role(auth.uid(), 'admin_operaciones') OR
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'global_admin')
  );

-- Admin BD can read all requests
CREATE POLICY "Admin BD can read all requests"
  ON public.ops_requests FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin_bd'));

-- Trigger to update updated_at
CREATE TRIGGER update_ops_requests_updated_at
  BEFORE UPDATE ON public.ops_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notification trigger for new requests
CREATE OR REPLACE FUNCTION public.notify_new_ops_request()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _ops_user RECORD;
  _ib_name text;
  _bd_name text;
  _email_html text;
  _base_url text := 'https://dpfqhwcjyecpnvtchudo.supabase.co';
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnFod2NqeWVjcG52dGNodWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTAyNzMsImV4cCI6MjA4ODY4NjI3M30.jn-UUyI5p87-j9Bi5biWIvCIxBH3DolY7aldMcj7MdI';
BEGIN
  SELECT nombre_ib, nombre_bd INTO _ib_name, _bd_name FROM public.ibs WHERE id = NEW.ib_id;

  -- Bell notifications to ops users
  FOR _ops_user IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role IN ('operaciones', 'admin_operaciones')
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
    VALUES (
      _ops_user.user_id,
      'ops_new_request',
      'Nueva solicitud operativa',
      'El BD ' || COALESCE(_bd_name, '') || ' creó una solicitud para el IB ' || COALESCE(_ib_name, '') || '.',
      NEW.id::text,
      'ops_request'
    );
  END LOOP;

  -- Email notifications to ops users
  FOR _ops_user IN
    SELECT DISTINCT p.correo
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role IN ('operaciones', 'admin_operaciones')
    AND p.correo IS NOT NULL
  LOOP
    _email_html := '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
      || '<div style="background:#062B63;padding:20px;text-align:center;"><h1 style="color:#83CBFF;margin:0;">Bullfy IB System</h1></div>'
      || '<div style="padding:24px;background:#ffffff;">'
      || '<h2 style="color:#062B63;">📋 Nueva Solicitud Operativa</h2>'
      || '<p>El BD <strong>' || COALESCE(_bd_name, '') || '</strong> creó una solicitud para el IB <strong>' || COALESCE(_ib_name, '') || '</strong>.</p>'
      || '<p><em>' || LEFT(NEW.description, 200) || '</em></p>'
      || '<a href="https://bullfyibsystem.lovable.app/operaciones" style="display:inline-block;background:#146EF5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin-top:12px;">Ver Solicitudes</a>'
      || '</div>'
      || '<div style="background:#f5f5f5;padding:16px;text-align:center;color:#666;font-size:12px;">Bullfy IB System</div></div>';

    PERFORM net.http_post(
      url := _base_url || '/functions/v1/send-transactional-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _anon_key
      ),
      body := jsonb_build_object(
        'to', _ops_user.correo,
        'subject', '📋 Nueva Solicitud: ' || COALESCE(_ib_name, 'IB'),
        'html', _email_html
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_ops_request
  AFTER INSERT ON public.ops_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_ops_request();

-- Notification trigger for status changes on requests
CREATE OR REPLACE FUNCTION public.notify_ops_request_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _ops_user RECORD;
  _ib_name text;
  _title text;
  _message text;
  _event_type text;
BEGIN
  SELECT nombre_ib INTO _ib_name FROM public.ibs WHERE id = NEW.ib_id;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'en_proceso' THEN
      _event_type := 'ops_request_taken';
      _title := 'Solicitud tomada';
      _message := 'La solicitud para el IB ' || COALESCE(_ib_name, '') || ' fue tomada.';
    ELSIF NEW.status = 'configurado' THEN
      _event_type := 'ops_request_completed';
      _title := 'Solicitud completada';
      _message := 'La solicitud para el IB ' || COALESCE(_ib_name, '') || ' fue completada.';
    ELSE
      _event_type := 'ops_request_status';
      _title := 'Cambio de estado en solicitud';
      _message := 'La solicitud para el IB ' || COALESCE(_ib_name, '') || ' cambió a: ' || NEW.status;
    END IF;

    -- Notify the BD who created the request
    IF NEW.created_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
      VALUES (NEW.created_by, _event_type, _title, _message, NEW.id::text, 'ops_request');
    END IF;

    -- Notify ops users
    FOR _ops_user IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.role IN ('operaciones', 'admin_operaciones')
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
      VALUES (_ops_user.user_id, _event_type, _title, _message, NEW.id::text, 'ops_request');
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_ops_request_change
  AFTER UPDATE ON public.ops_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_ops_request_change();

-- Enable realtime for ops_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.ops_requests;
