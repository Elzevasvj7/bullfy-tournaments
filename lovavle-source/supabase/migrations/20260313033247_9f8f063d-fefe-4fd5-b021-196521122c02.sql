
-- Fix auto_create_ops_queue: remove broken email enqueue, keep bell notifications
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
      SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
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
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix notify_ops_queue_change: remove broken email enqueue, keep bell notifications
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
  _assigned_name text;
  _title text;
  _message text;
  _event_type text;
BEGIN
  SELECT nombre_ib, nombre_bd INTO _ib_name, _bd_name FROM public.ibs WHERE id = NEW.ib_id;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
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

  FOR _ops_user IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role IN ('operaciones', 'admin_operaciones')
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
    VALUES (_ops_user.user_id, _event_type, _title, _message, NEW.ib_id::text, 'ops_queue');
  END LOOP;

  RETURN NEW;
END;
$function$;
