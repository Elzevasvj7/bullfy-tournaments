
-- Trigger function for ops_queue changes (UPDATE events)
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
  _title text;
  _message text;
  _event_type text;
BEGIN
  -- Get IB info
  SELECT nombre_ib, nombre_bd INTO _ib_name, _bd_name FROM public.ibs WHERE id = NEW.ib_id;

  -- Determine event type
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'en_proceso' THEN
      _event_type := 'ops_deal_taken';
      _title := 'Deal tomado';
      _message := 'El deal del IB ' || COALESCE(_ib_name, '') || ' (BD: ' || COALESCE(_bd_name, '') || ') fue tomado para configuración.';
    ELSIF NEW.status = 'configurado' THEN
      _event_type := 'ops_deal_completed';
      _title := 'Deal configurado';
      _message := 'El deal del IB ' || COALESCE(_ib_name, '') || ' (BD: ' || COALESCE(_bd_name, '') || ') fue marcado como configurado.';
    ELSE
      _event_type := 'ops_status_change';
      _title := 'Cambio de estado en cola';
      _message := 'El deal del IB ' || COALESCE(_ib_name, '') || ' cambió a estado: ' || NEW.status;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.notes IS DISTINCT FROM NEW.notes THEN
    _event_type := 'ops_notes_update';
    _title := 'Notas actualizadas';
    _message := 'Se actualizaron las notas del deal del IB ' || COALESCE(_ib_name, '') || ' (BD: ' || COALESCE(_bd_name, '') || ').';
  ELSE
    RETURN NEW;
  END IF;

  -- Notify all ops users (bell + email)
  FOR _ops_user IN
    SELECT DISTINCT ur.user_id, p.correo
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role IN ('operaciones', 'admin_operaciones')
  LOOP
    -- Bell notification
    INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
    VALUES (_ops_user.user_id, _event_type, _title, _message, NEW.ib_id::text, 'ops_queue');

    -- Email via transactional queue
    PERFORM public.enqueue_email(
      'transactional_emails',
      jsonb_build_object(
        'to', _ops_user.correo,
        'subject', '[Bullfy Ops] ' || _title,
        'html', '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">'
          || '<div style="background:#062B63;padding:20px;border-radius:8px 8px 0 0;text-align:center;">'
          || '<h1 style="color:#83CBFF;margin:0;font-size:20px;">Bullfy Operations</h1></div>'
          || '<div style="background:#ffffff;padding:24px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px;">'
          || '<h2 style="color:#062B63;margin-top:0;">' || _title || '</h2>'
          || '<p style="color:#374151;font-size:15px;">' || _message || '</p>'
          || '<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />'
          || '<p style="color:#9ca3af;font-size:12px;">Este es un correo automático del sistema Bullfy IB.</p>'
          || '</div></div>',
        'text', _title || ': ' || _message,
        'from', 'Bullfy Ops <noreply@bullfytech.online>'
      )
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- Create trigger on ops_queue for UPDATE
CREATE TRIGGER trigger_ops_queue_change
AFTER UPDATE ON public.ops_queue
FOR EACH ROW
EXECUTE FUNCTION public.notify_ops_queue_change();

-- Update auto_create_ops_queue to also send emails on new deals
CREATE OR REPLACE FUNCTION public.auto_create_ops_queue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _ops_user RECORD;
BEGIN
  IF NEW.status = 'submitted' THEN
    INSERT INTO public.ops_queue (ib_id, status)
    VALUES (NEW.id, 'nuevo')
    ON CONFLICT (ib_id) DO NOTHING;
    
    FOR _ops_user IN
      SELECT DISTINCT ur.user_id, p.correo
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.role IN ('operaciones', 'admin_operaciones')
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
      VALUES (
        _ops_user.user_id,
        'ops_new_deal',
        'Nuevo Deal para configurar',
        'El IB ' || NEW.nombre_ib || ' (BD: ' || NEW.nombre_bd || ') requiere configuración.',
        NEW.id::text,
        'ops_queue'
      );

      PERFORM public.enqueue_email(
        'transactional_emails',
        jsonb_build_object(
          'to', _ops_user.correo,
          'subject', '[Bullfy Ops] Nuevo Deal para configurar',
          'html', '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">'
            || '<div style="background:#062B63;padding:20px;border-radius:8px 8px 0 0;text-align:center;">'
            || '<h1 style="color:#83CBFF;margin:0;font-size:20px;">Bullfy Operations</h1></div>'
            || '<div style="background:#ffffff;padding:24px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px;">'
            || '<h2 style="color:#062B63;margin-top:0;">Nuevo Deal para configurar</h2>'
            || '<p style="color:#374151;font-size:15px;">El IB <strong>' || NEW.nombre_ib || '</strong> (BD: ' || NEW.nombre_bd || ') requiere configuración.</p>'
            || '<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />'
            || '<p style="color:#9ca3af;font-size:12px;">Este es un correo automático del sistema Bullfy IB.</p>'
            || '</div></div>',
          'text', 'Nuevo Deal: El IB ' || NEW.nombre_ib || ' (BD: ' || NEW.nombre_bd || ') requiere configuración.',
          'from', 'Bullfy Ops <noreply@bullfytech.online>'
        )
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;
