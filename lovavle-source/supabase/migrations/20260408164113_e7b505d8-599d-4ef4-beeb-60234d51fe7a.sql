
-- Add rejection_reason to ops_queue
ALTER TABLE public.ops_queue ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Add rejection_reason to ops_requests  
ALTER TABLE public.ops_requests ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Update notify_ops_queue_change to handle rechazado status
CREATE OR REPLACE FUNCTION public.notify_ops_queue_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _ops_user RECORD;
  _ib_name text;
  _bd_name text;
  _bd_id uuid;
  _assigned_name text;
  _title text;
  _message text;
  _event_type text;
  _email_html text;
  _bd_email text;
  _base_url text := 'https://dpfqhwcjyecpnvtchudo.supabase.co';
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnFod2NqeWVjcG52dGNodWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTAyNzMsImV4cCI6MjA4ODY4NjI3M30.jn-UUyI5p87-j9Bi5biWIvCIxBH3DolY7aldMcj7MdI';
BEGIN
  SELECT nombre_ib, nombre_bd, created_by INTO _ib_name, _bd_name, _bd_id FROM public.ibs WHERE id = NEW.ib_id;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'en_proceso' THEN
      _event_type := 'ops_deal_taken';
      _title := 'Deal tomado';
      _message := 'El deal del IB ' || COALESCE(_ib_name, '') || ' (BD: ' || COALESCE(_bd_name, '') || ') fue tomado para configuración.';
    ELSIF NEW.status = 'configurado' THEN
      _event_type := 'ops_deal_completed';
      _title := 'Deal configurado';
      _message := 'El deal del IB ' || COALESCE(_ib_name, '') || ' (BD: ' || COALESCE(_bd_name, '') || ') fue marcado como configurado.';
    ELSIF NEW.status = 'rechazado' THEN
      _event_type := 'ops_deal_rejected';
      _title := '❌ Deal rechazado';
      _message := 'El deal del IB ' || COALESCE(_ib_name, '') || ' (BD: ' || COALESCE(_bd_name, '') || ') fue rechazado. Motivo: ' || COALESCE(NEW.rejection_reason, 'Sin motivo especificado');
    ELSE
      _event_type := 'ops_status_change';
      _title := 'Cambio de estado en cola';
      _message := 'El deal del IB ' || COALESCE(_ib_name, '') || ' cambió a estado: ' || NEW.status;
    END IF;
  ELSIF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    SELECT nombre INTO _assigned_name FROM public.profiles WHERE id = NEW.assigned_to;
    _event_type := 'ops_deal_assigned';
    _title := 'Deal asignado';
    _message := 'El deal del IB ' || COALESCE(_ib_name, '') || ' fue asignado a ' || COALESCE(_assigned_name, 'un operador') || '.';
  ELSIF OLD.notes IS DISTINCT FROM NEW.notes THEN
    _event_type := 'ops_notes_update';
    _title := 'Notas actualizadas';
    _message := 'Se actualizaron las notas del deal del IB ' || COALESCE(_ib_name, '') || ' (BD: ' || COALESCE(_bd_name, '') || ').';
  ELSE
    RETURN NEW;
  END IF;

  -- Bell notifications to ops users
  FOR _ops_user IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role IN ('operaciones', 'admin_operaciones')
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
    VALUES (_ops_user.user_id, _event_type, _title, _message, NEW.ib_id::text, 'ops_queue');
  END LOOP;

  -- For rejection: also notify the BD who created the IB
  IF NEW.status = 'rechazado' AND _bd_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
    VALUES (_bd_id, _event_type, _title, _message, NEW.ib_id::text, 'ops_queue');

    -- Email to BD
    SELECT correo INTO _bd_email FROM public.profiles WHERE id = _bd_id;
    IF _bd_email IS NOT NULL THEN
      _email_html := '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
        || '<div style="background:#062B63;padding:20px;text-align:center;"><h1 style="color:#83CBFF;margin:0;">Bullfy IB System</h1></div>'
        || '<div style="padding:24px;background:#ffffff;">'
        || '<h2 style="color:#dc2626;">❌ ' || _title || '</h2>'
        || '<p>El deal del IB <strong>' || COALESCE(_ib_name, '') || '</strong> fue rechazado por operaciones.</p>'
        || '<p style="background:#fef2f2;border:1px solid #fecaca;padding:12px;border-radius:6px;color:#991b1b;"><strong>Motivo:</strong> ' || COALESCE(NEW.rejection_reason, 'Sin motivo especificado') || '</p>'
        || '<a href="https://bullfyibsystem.lovable.app/operaciones" style="display:inline-block;background:#146EF5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin-top:12px;">Ver Detalle</a>'
        || '</div>'
        || '<div style="background:#f5f5f5;padding:16px;text-align:center;color:#666;font-size:12px;">Bullfy IB System</div></div>';

      PERFORM net.http_post(
        url := _base_url || '/functions/v1/send-transactional-email',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || _anon_key),
        body := jsonb_build_object('to', _bd_email, 'subject', '❌ Deal Rechazado: ' || COALESCE(_ib_name, 'IB'), 'html', _email_html)
      );
    END IF;
  END IF;

  -- Send email for important events (existing logic)
  IF _event_type IN ('ops_deal_taken', 'ops_deal_completed', 'ops_new_deal', 'ops_deal_rejected') THEN
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
        || '<h2 style="color:#062B63;">' || _title || '</h2>'
        || '<p>' || _message || '</p>'
        || '<a href="https://bullfyibsystem.lovable.app/operaciones" style="display:inline-block;background:#146EF5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin-top:12px;">Ver Cola</a>'
        || '</div>'
        || '<div style="background:#f5f5f5;padding:16px;text-align:center;color:#666;font-size:12px;">Bullfy IB System</div></div>';

      PERFORM net.http_post(
        url := _base_url || '/functions/v1/send-transactional-email',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || _anon_key),
        body := jsonb_build_object('to', _ops_user.correo, 'subject', _title || ': ' || COALESCE(_ib_name, 'IB'), 'html', _email_html)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- Update notify_ops_request_change to handle rechazado
CREATE OR REPLACE FUNCTION public.notify_ops_request_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _ops_user RECORD;
  _ib_name text;
  _title text;
  _message text;
  _event_type text;
  _email_html text;
  _requester_email text;
  _base_url text := 'https://dpfqhwcjyecpnvtchudo.supabase.co';
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnFod2NqeWVjcG52dGNodWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTAyNzMsImV4cCI6MjA4ODY4NjI3M30.jn-UUyI5p87-j9Bi5biWIvCIxBH3DolY7aldMcj7MdI';
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
    ELSIF NEW.status = 'rechazado' THEN
      _event_type := 'ops_request_rejected';
      _title := '❌ Solicitud rechazada';
      _message := 'La solicitud para el IB ' || COALESCE(_ib_name, '') || ' fue rechazada. Motivo: ' || COALESCE(NEW.rejection_reason, 'Sin motivo especificado');
    ELSE
      _event_type := 'ops_request_status';
      _title := 'Cambio de estado en solicitud';
      _message := 'La solicitud para el IB ' || COALESCE(_ib_name, '') || ' cambió a: ' || NEW.status;
    END IF;

    -- Notify the BD who created the request
    IF NEW.created_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
      VALUES (NEW.created_by, _event_type, _title, _message, NEW.id::text, 'ops_request');

      -- Email for rejection
      IF NEW.status = 'rechazado' THEN
        SELECT correo INTO _requester_email FROM public.profiles WHERE id = NEW.created_by;
        IF _requester_email IS NOT NULL THEN
          _email_html := '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
            || '<div style="background:#062B63;padding:20px;text-align:center;"><h1 style="color:#83CBFF;margin:0;">Bullfy IB System</h1></div>'
            || '<div style="padding:24px;background:#ffffff;">'
            || '<h2 style="color:#dc2626;">❌ ' || _title || '</h2>'
            || '<p>Tu solicitud para el IB <strong>' || COALESCE(_ib_name, '') || '</strong> fue rechazada.</p>'
            || '<p style="background:#fef2f2;border:1px solid #fecaca;padding:12px;border-radius:6px;color:#991b1b;"><strong>Motivo:</strong> ' || COALESCE(NEW.rejection_reason, 'Sin motivo especificado') || '</p>'
            || '<a href="https://bullfyibsystem.lovable.app/operaciones" style="display:inline-block;background:#146EF5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin-top:12px;">Ver Detalle</a>'
            || '</div>'
            || '<div style="background:#f5f5f5;padding:16px;text-align:center;color:#666;font-size:12px;">Bullfy IB System</div></div>';

          PERFORM net.http_post(
            url := _base_url || '/functions/v1/send-transactional-email',
            headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || _anon_key),
            body := jsonb_build_object('to', _requester_email, 'subject', '❌ Solicitud Rechazada: ' || COALESCE(_ib_name, 'IB'), 'html', _email_html)
          );
        END IF;
      END IF;
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
$function$;
