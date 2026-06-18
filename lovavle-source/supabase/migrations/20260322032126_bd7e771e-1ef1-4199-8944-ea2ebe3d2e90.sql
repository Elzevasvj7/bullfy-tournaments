
-- Add ib_id and must_change_password to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ib_id uuid REFERENCES public.ibs(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Table for IB external Sub IB requests
CREATE TABLE public.ib_external_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ib_id uuid NOT NULL REFERENCES public.ibs(id),
  requested_by uuid NOT NULL,
  sub_ib_nombre text NOT NULL,
  sub_ib_correo text NOT NULL,
  sub_ib_tipo_id text NOT NULL DEFAULT '',
  sub_ib_id_documento text NOT NULL DEFAULT '',
  sub_ib_kyc_completed boolean NOT NULL DEFAULT false,
  sub_ib_exists_in_system boolean NOT NULL DEFAULT false,
  dolares_por_lote_sub_ib numeric NOT NULL DEFAULT 0,
  compensation_data jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pendiente_bd',
  bd_approved_by uuid,
  bd_approved_at timestamptz,
  bd_rejection_reason text,
  ops_assigned_to uuid,
  ops_taken_at timestamptz,
  ops_completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ib_external_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "IB externo can read own requests" ON public.ib_external_requests
  FOR SELECT TO authenticated USING (requested_by = auth.uid());

CREATE POLICY "IB externo can insert own requests" ON public.ib_external_requests
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND has_role(auth.uid(), 'ib_externo'));

CREATE POLICY "BDs can read ib ext requests for own IBs" ON public.ib_external_requests
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM ibs WHERE ibs.id = ib_external_requests.ib_id AND ibs.created_by = auth.uid()));

CREATE POLICY "BDs can update ib ext requests for own IBs" ON public.ib_external_requests
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM ibs WHERE ibs.id = ib_external_requests.ib_id AND ibs.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM ibs WHERE ibs.id = ib_external_requests.ib_id AND ibs.created_by = auth.uid()));

CREATE POLICY "Admins and ops can manage ib ext requests" ON public.ib_external_requests
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'global_admin') OR has_role(auth.uid(), 'operaciones') OR has_role(auth.uid(), 'admin_operaciones'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'global_admin') OR has_role(auth.uid(), 'operaciones') OR has_role(auth.uid(), 'admin_operaciones'));

CREATE TRIGGER update_ib_external_requests_updated_at
  BEFORE UPDATE ON public.ib_external_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Bitácora table
CREATE TABLE public.ib_external_request_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.ib_external_requests(id) ON DELETE CASCADE,
  action text NOT NULL,
  details text,
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ib_external_request_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read ib ext request history" ON public.ib_external_request_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert ib ext request history" ON public.ib_external_request_history
  FOR INSERT TO authenticated WITH CHECK (true);

-- Notification trigger for status changes
CREATE OR REPLACE FUNCTION public.notify_ib_external_request_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ib_name text;
  _bd_id uuid;
  _requester_id uuid;
  _ops_user RECORD;
  _title text;
  _message text;
  _event_type text;
  _base_url text := 'https://dpfqhwcjyecpnvtchudo.supabase.co';
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnFod2NqeWVjcG52dGNodWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTAyNzMsImV4cCI6MjA4ODY4NjI3M30.jn-UUyI5p87-j9Bi5biWIvCIxBH3DolY7aldMcj7MdI';
  _email_html text;
  _recipient_email text;
BEGIN
  SELECT nombre_ib, created_by INTO _ib_name, _bd_id FROM public.ibs WHERE id = NEW.ib_id;
  _requester_id := NEW.requested_by;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.ib_external_request_history (request_id, action, details, performed_by)
    VALUES (NEW.id, 'status_change', 'Estado cambió de ' || OLD.status || ' a ' || NEW.status, auth.uid());

    IF NEW.status = 'aprobado_bd' THEN
      _event_type := 'ib_ext_approved';
      _title := 'Solicitud aprobada por BD';
      _message := 'La solicitud de Sub IB "' || NEW.sub_ib_nombre || '" para ' || COALESCE(_ib_name, '') || ' fue aprobada.';
      INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
      VALUES (_requester_id, _event_type, _title, _message, NEW.id::text, 'ib_ext_request');
      FOR _ops_user IN SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('operaciones', 'admin_operaciones')
      LOOP
        INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
        VALUES (_ops_user.user_id, _event_type, 'Nueva solicitud IB aprobada', _message, NEW.id::text, 'ib_ext_request');
      END LOOP;
    ELSIF NEW.status = 'rechazado' THEN
      _event_type := 'ib_ext_rejected';
      _title := 'Solicitud rechazada';
      _message := 'La solicitud de Sub IB "' || NEW.sub_ib_nombre || '" fue rechazada. Motivo: ' || COALESCE(NEW.bd_rejection_reason, 'Sin motivo');
      INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
      VALUES (_requester_id, _event_type, _title, _message, NEW.id::text, 'ib_ext_request');
    ELSIF NEW.status = 'en_proceso_ops' THEN
      _event_type := 'ib_ext_in_process';
      _title := 'Solicitud en proceso';
      _message := 'La solicitud de Sub IB "' || NEW.sub_ib_nombre || '" está siendo procesada por operaciones.';
      INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
      VALUES (_requester_id, _event_type, _title, _message, NEW.id::text, 'ib_ext_request');
      IF _bd_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
        VALUES (_bd_id, _event_type, _title, _message, NEW.id::text, 'ib_ext_request');
      END IF;
    ELSIF NEW.status = 'completado' THEN
      _event_type := 'ib_ext_completed';
      _title := 'Solicitud completada';
      _message := 'La solicitud de Sub IB "' || NEW.sub_ib_nombre || '" fue completada exitosamente.';
      INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
      VALUES (_requester_id, _event_type, _title, _message, NEW.id::text, 'ib_ext_request');
      IF _bd_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
        VALUES (_bd_id, _event_type, _title, _message, NEW.id::text, 'ib_ext_request');
      END IF;
    END IF;

    _email_html := '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
      || '<div style="background:#062B63;padding:20px;text-align:center;"><h1 style="color:#83CBFF;margin:0;">Bullfy IB System</h1></div>'
      || '<div style="padding:24px;background:#ffffff;">'
      || '<h2 style="color:#062B63;">' || _title || '</h2>'
      || '<p>' || _message || '</p>'
      || '<a href="https://bullfyibsystem.lovable.app" style="display:inline-block;background:#146EF5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin-top:12px;">Ver Solicitud</a>'
      || '</div>'
      || '<div style="background:#f5f5f5;padding:16px;text-align:center;color:#666;font-size:12px;">Bullfy IB System</div></div>';

    SELECT correo INTO _recipient_email FROM public.profiles WHERE id = _requester_id;
    IF _recipient_email IS NOT NULL THEN
      PERFORM net.http_post(
        url := _base_url || '/functions/v1/send-transactional-email',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || _anon_key),
        body := jsonb_build_object('to', _recipient_email, 'subject', _title || ': ' || NEW.sub_ib_nombre, 'html', _email_html)
      );
    END IF;

    IF _bd_id IS NOT NULL THEN
      SELECT correo INTO _recipient_email FROM public.profiles WHERE id = _bd_id;
      IF _recipient_email IS NOT NULL THEN
        PERFORM net.http_post(
          url := _base_url || '/functions/v1/send-transactional-email',
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || _anon_key),
          body := jsonb_build_object('to', _recipient_email, 'subject', _title || ': ' || NEW.sub_ib_nombre, 'html', _email_html)
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_ib_external_request_change
  AFTER UPDATE ON public.ib_external_requests
  FOR EACH ROW EXECUTE FUNCTION notify_ib_external_request_change();

-- Trigger for new request
CREATE OR REPLACE FUNCTION public.notify_new_ib_external_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ib_name text;
  _bd_id uuid;
  _requester_name text;
  _bd_email text;
  _email_html text;
  _base_url text := 'https://dpfqhwcjyecpnvtchudo.supabase.co';
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnFod2NqeWVjcG52dGNodWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTAyNzMsImV4cCI6MjA4ODY4NjI3M30.jn-UUyI5p87-j9Bi5biWIvCIxBH3DolY7aldMcj7MdI';
BEGIN
  SELECT nombre_ib, created_by INTO _ib_name, _bd_id FROM public.ibs WHERE id = NEW.ib_id;
  SELECT nombre INTO _requester_name FROM public.profiles WHERE id = NEW.requested_by;

  INSERT INTO public.ib_external_request_history (request_id, action, details, performed_by)
  VALUES (NEW.id, 'created', 'Solicitud creada por ' || COALESCE(_requester_name, 'IB'), NEW.requested_by);

  IF _bd_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
    VALUES (_bd_id, 'ib_ext_new_request', 'Nueva solicitud de IB externo',
      'El IB ' || COALESCE(_requester_name, '') || ' solicita incorporar Sub IB "' || NEW.sub_ib_nombre || '" para ' || COALESCE(_ib_name, ''),
      NEW.id::text, 'ib_ext_request');

    SELECT correo INTO _bd_email FROM public.profiles WHERE id = _bd_id;
    IF _bd_email IS NOT NULL THEN
      _email_html := '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
        || '<div style="background:#062B63;padding:20px;text-align:center;"><h1 style="color:#83CBFF;margin:0;">Bullfy IB System</h1></div>'
        || '<div style="padding:24px;background:#ffffff;">'
        || '<h2 style="color:#062B63;">📋 Nueva Solicitud de IB Externo</h2>'
        || '<p>El IB <strong>' || COALESCE(_requester_name, '') || '</strong> solicita incorporar al Sub IB <strong>' || NEW.sub_ib_nombre || '</strong>.</p>'
        || '<a href="https://bullfyibsystem.lovable.app/operaciones" style="display:inline-block;background:#146EF5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin-top:12px;">Ver Solicitud</a>'
        || '</div>'
        || '<div style="background:#f5f5f5;padding:16px;text-align:center;color:#666;font-size:12px;">Bullfy IB System</div></div>';

      PERFORM net.http_post(
        url := _base_url || '/functions/v1/send-transactional-email',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || _anon_key),
        body := jsonb_build_object('to', _bd_email, 'subject', '📋 Nueva Solicitud IB: ' || NEW.sub_ib_nombre, 'html', _email_html)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_ib_external_request
  AFTER INSERT ON public.ib_external_requests
  FOR EACH ROW EXECUTE FUNCTION notify_new_ib_external_request();
