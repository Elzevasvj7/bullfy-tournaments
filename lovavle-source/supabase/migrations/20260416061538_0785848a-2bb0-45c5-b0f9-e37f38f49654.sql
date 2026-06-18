
-- 1. Add 'dealing' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dealing';

-- 2. Add target_department column to ops_requests
ALTER TABLE public.ops_requests
ADD COLUMN target_department text NOT NULL DEFAULT 'operaciones';

-- 3. Replace notify_new_ops_request to also notify dealing users
CREATE OR REPLACE FUNCTION public.notify_new_ops_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _ops_user RECORD;
  _ib_name text;
  _bd_name text;
  _email_html text;
  _target_roles text[];
  _base_url text := 'https://dpfqhwcjyecpnvtchudo.supabase.co';
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnFod2NqeWVjcG52dGNodWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTAyNzMsImV4cCI6MjA4ODY4NjI3M30.jn-UUyI5p87-j9Bi5biWIvCIxBH3DolY7aldMcj7MdI';
BEGIN
  IF NEW.ib_id IS NOT NULL THEN
    SELECT nombre_ib, nombre_bd INTO _ib_name, _bd_name FROM public.ibs WHERE id = NEW.ib_id;
  END IF;

  -- Determine target roles based on department
  IF NEW.target_department = 'dealing' THEN
    _target_roles := ARRAY['dealing'];
  ELSE
    _target_roles := ARRAY['operaciones', 'admin_operaciones'];
  END IF;

  -- Bell notifications
  FOR _ops_user IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role::text = ANY(_target_roles)
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
    VALUES (
      _ops_user.user_id,
      'ops_new_request',
      CASE WHEN NEW.target_department = 'dealing' THEN '📋 Nueva solicitud para Dealing' ELSE 'Nueva solicitud operativa' END,
      CASE WHEN _ib_name IS NOT NULL THEN 'Nueva solicitud para el IB ' || COALESCE(_ib_name, '') || '.'
           ELSE 'Nueva solicitud general.' END,
      NEW.id::text,
      'ops_request'
    );
  END LOOP;

  -- Email notifications
  FOR _ops_user IN
    SELECT DISTINCT p.correo
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role::text = ANY(_target_roles)
    AND p.correo IS NOT NULL
  LOOP
    _email_html := '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
      || '<div style="background:#062B63;padding:20px;text-align:center;"><h1 style="color:#83CBFF;margin:0;">Bullfy IB System</h1></div>'
      || '<div style="padding:24px;background:#ffffff;">'
      || '<h2 style="color:#062B63;">📋 Nueva Solicitud — ' || INITCAP(NEW.target_department) || '</h2>'
      || '<p>' || CASE WHEN _ib_name IS NOT NULL THEN 'Nueva solicitud para el IB <strong>' || COALESCE(_ib_name, '') || '</strong>.' ELSE 'Nueva solicitud general.' END || '</p>'
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
        'subject', '📋 Nueva Solicitud (' || INITCAP(NEW.target_department) || ')' || CASE WHEN _ib_name IS NOT NULL THEN ': ' || _ib_name ELSE '' END,
        'html', _email_html
      )
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 4. Replace notify_ops_request_change to support dealing role
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
  _target_roles text[];
  _base_url text := 'https://dpfqhwcjyecpnvtchudo.supabase.co';
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnFod2NqeWVjcG52dGNodWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTAyNzMsImV4cCI6MjA4ODY4NjI3M30.jn-UUyI5p87-j9Bi5biWIvCIxBH3DolY7aldMcj7MdI';
BEGIN
  IF NEW.ib_id IS NOT NULL THEN
    SELECT nombre_ib INTO _ib_name FROM public.ibs WHERE id = NEW.ib_id;
  END IF;

  -- Determine target roles based on department
  IF NEW.target_department = 'dealing' THEN
    _target_roles := ARRAY['dealing'];
  ELSE
    _target_roles := ARRAY['operaciones', 'admin_operaciones'];
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'en_proceso' THEN
      _event_type := 'ops_request_taken';
      _title := 'Solicitud tomada';
      _message := 'La solicitud ' || CASE WHEN _ib_name IS NOT NULL THEN 'para el IB ' || _ib_name ELSE '(general)' END || ' fue tomada.';
    ELSIF NEW.status = 'configurado' THEN
      _event_type := 'ops_request_completed';
      _title := 'Solicitud completada';
      _message := 'La solicitud ' || CASE WHEN _ib_name IS NOT NULL THEN 'para el IB ' || _ib_name ELSE '(general)' END || ' fue completada.';
    ELSIF NEW.status = 'rechazado' THEN
      _event_type := 'ops_request_rejected';
      _title := '❌ Solicitud rechazada';
      _message := 'La solicitud ' || CASE WHEN _ib_name IS NOT NULL THEN 'para el IB ' || _ib_name ELSE '(general)' END || ' fue rechazada. Motivo: ' || COALESCE(NEW.rejection_reason, 'Sin motivo especificado');
    ELSE
      _event_type := 'ops_request_status';
      _title := 'Cambio de estado en solicitud';
      _message := 'La solicitud ' || CASE WHEN _ib_name IS NOT NULL THEN 'para el IB ' || _ib_name ELSE '(general)' END || ' cambió a: ' || NEW.status;
    END IF;

    -- Notify requester
    IF NEW.created_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
      VALUES (NEW.created_by, _event_type, _title, _message, NEW.id::text, 'ops_request');

      IF NEW.status = 'rechazado' THEN
        SELECT correo INTO _requester_email FROM public.profiles WHERE id = NEW.created_by;
        IF _requester_email IS NOT NULL THEN
          _email_html := '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
            || '<div style="background:#062B63;padding:20px;text-align:center;"><h1 style="color:#83CBFF;margin:0;">Bullfy IB System</h1></div>'
            || '<div style="padding:24px;background:#ffffff;">'
            || '<h2 style="color:#dc2626;">❌ ' || _title || '</h2>'
            || '<p>Tu solicitud ' || CASE WHEN _ib_name IS NOT NULL THEN 'para el IB <strong>' || _ib_name || '</strong>' ELSE '' END || ' fue rechazada.</p>'
            || '<p style="background:#fef2f2;border:1px solid #fecaca;padding:12px;border-radius:6px;color:#991b1b;"><strong>Motivo:</strong> ' || COALESCE(NEW.rejection_reason, 'Sin motivo especificado') || '</p>'
            || '<a href="https://bullfyibsystem.lovable.app/operaciones" style="display:inline-block;background:#146EF5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin-top:12px;">Ver Detalle</a>'
            || '</div>'
            || '<div style="background:#f5f5f5;padding:16px;text-align:center;color:#666;font-size:12px;">Bullfy IB System</div></div>';

          PERFORM net.http_post(
            url := _base_url || '/functions/v1/send-transactional-email',
            headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || _anon_key),
            body := jsonb_build_object('to', _requester_email, 'subject', '❌ Solicitud Rechazada' || CASE WHEN _ib_name IS NOT NULL THEN ': ' || _ib_name ELSE '' END, 'html', _email_html)
          );
        END IF;
      END IF;
    END IF;

    -- Notify target department users
    FOR _ops_user IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.role::text = ANY(_target_roles)
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
      VALUES (_ops_user.user_id, _event_type, _title, _message, NEW.id::text, 'ops_request');
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;
