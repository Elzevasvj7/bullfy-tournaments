
CREATE OR REPLACE FUNCTION public.create_default_revenue_splits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only when commerce access is enabled
  IF NEW.enabled = true AND (OLD IS NULL OR OLD.enabled = false) THEN
    INSERT INTO public.portal_revenue_splits (portal_id, role_label, percentage, priority)
    SELECT pp.id, splits.role_label, splits.percentage, splits.priority
    FROM public.partner_portals pp
    CROSS JOIN (VALUES
      ('platform', 10.00, 1),
      ('portal_owner', 80.00, 2),
      ('referrer', 10.00, 3)
    ) AS splits(role_label, percentage, priority)
    WHERE pp.ib_id = NEW.ib_id
    ON CONFLICT (portal_id, role_label) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;
