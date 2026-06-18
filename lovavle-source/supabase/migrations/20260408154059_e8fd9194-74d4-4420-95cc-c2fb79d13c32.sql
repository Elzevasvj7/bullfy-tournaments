
-- Add duplicate tracking columns to stream_leads
ALTER TABLE public.stream_leads
  ADD COLUMN IF NOT EXISTS is_duplicate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_portal_ids text[] DEFAULT '{}';

-- Function to detect cross-portal duplicate registrations
CREATE OR REPLACE FUNCTION public.detect_cross_portal_duplicate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _existing RECORD;
  _all_portal_ids text[];
  _portal_names text[];
  _current_portal_name text;
  _existing_portal_name text;
  _notify_user RECORD;
  _title text;
  _message text;
BEGIN
  -- Only check on insert with status pending
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Find existing partner_user with same email in a DIFFERENT portal
  SELECT pu.id, pu.portal_id, pp.display_name as portal_name
  INTO _existing
  FROM public.partner_users pu
  JOIN public.partner_portals pp ON pp.id = pu.portal_id
  WHERE LOWER(TRIM(pu.email)) = LOWER(TRIM(NEW.email))
    AND pu.portal_id <> NEW.portal_id
    AND pu.id <> NEW.id
  LIMIT 1;

  IF _existing IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get current portal name
  SELECT display_name INTO _current_portal_name
  FROM public.partner_portals WHERE id = NEW.portal_id;

  -- Collect all portal_ids where this email exists
  SELECT array_agg(DISTINCT pu.portal_id::text)
  INTO _all_portal_ids
  FROM public.partner_users pu
  WHERE LOWER(TRIM(pu.email)) = LOWER(TRIM(NEW.email));

  -- Add current portal to the array if not already there
  IF NOT (NEW.portal_id::text = ANY(_all_portal_ids)) THEN
    _all_portal_ids := array_append(_all_portal_ids, NEW.portal_id::text);
  END IF;

  -- Collect portal names for the notification message
  SELECT array_agg(pp.display_name)
  INTO _portal_names
  FROM public.partner_portals pp
  WHERE pp.id::text = ANY(_all_portal_ids);

  -- Mark the stream_lead as duplicate
  UPDATE public.stream_leads
  SET is_duplicate = true,
      duplicate_portal_ids = _all_portal_ids
  WHERE LOWER(TRIM(correo)) = LOWER(TRIM(NEW.email));

  -- Build notification
  _title := '⚠️ Lead duplicado detectado';
  _message := 'El usuario "' || COALESCE(NEW.nombre, '') || '" (' || NEW.email || ') se registró en múltiples portales: ' || array_to_string(_portal_names, ', ');

  -- Notify Master Admin, Admin, Operaciones, Admin Ventas, Ventas
  FOR _notify_user IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role IN ('global_admin', 'admin', 'operaciones', 'admin_operaciones', 'admin_ventas', 'ventas')
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
    VALUES (_notify_user.user_id, 'lead_duplicate', _title, _message, NEW.email, 'lead_duplicate');
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_detect_cross_portal_duplicate ON public.partner_users;
CREATE TRIGGER trg_detect_cross_portal_duplicate
  AFTER INSERT ON public.partner_users
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_cross_portal_duplicate();
