
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, nombre, correo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
    NEW.email
  );
  -- Auto-assign BD role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'bd');
  -- Welcome notification for the new user
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (
    NEW.id,
    'welcome',
    '¡Bienvenido a Bullfy IB System!',
    'Tu cuenta ha sido creada exitosamente. Un administrador revisará tu solicitud pronto.'
  );
  -- Notify admins about new registration
  INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
  SELECT 
    ur.user_id,
    'new_user',
    'Nuevo usuario registrado',
    'Se registró ' || COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email) || ' y requiere aprobación.',
    NEW.id::text,
    'user'
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'global_admin');
  RETURN NEW;
END;
$function$;
