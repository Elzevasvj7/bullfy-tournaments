CREATE OR REPLACE FUNCTION public.notify_new_ib()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _notify_id uuid;
BEGIN
  FOR _notify_id IN
    SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin', 'global_admin', 'operaciones', 'admin_operaciones')
  LOOP
    IF _notify_id != COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000') THEN
      INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
      VALUES (
        _notify_id,
        'new_ib',
        'Nuevo IB registrado',
        'Se registró el IB ' || NEW.nombre_ib || ' por ' || NEW.nombre_bd,
        NEW.id::text,
        'ib'
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;