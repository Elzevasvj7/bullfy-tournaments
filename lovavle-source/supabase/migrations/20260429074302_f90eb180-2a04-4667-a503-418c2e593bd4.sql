-- 1. Drop overly-permissive public SELECT policy on the base table
DROP POLICY IF EXISTS "Trading room plans are viewable by everyone" ON public.trading_room_plan_catalog;

-- 2. Restrict base table SELECT to admins only (admins manage policy already covers ALL)
CREATE POLICY "Admins can view full trading plan catalog"
  ON public.trading_room_plan_catalog
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'global_admin'::public.app_role)
  );

-- 3. Create public view exposing only client-safe columns (no metaapi_cost_monthly, no target_margin_pct)
CREATE OR REPLACE VIEW public.trading_room_plan_catalog_public
WITH (security_invoker = true) AS
SELECT
  id,
  plan_code,
  display_name,
  mode,
  session_key,
  session_label,
  window_start_utc,
  window_end_utc,
  active_hours_per_month,
  target_price_monthly,
  is_active,
  sort_order,
  notes,
  created_at,
  updated_at
FROM public.trading_room_plan_catalog
WHERE is_active = true;

-- 4. Grant read access to the public view for everyone (authenticated + anon)
GRANT SELECT ON public.trading_room_plan_catalog_public TO anon, authenticated;