CREATE TABLE IF NOT EXISTS public.trading_room_test_plan_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id UUID NOT NULL REFERENCES public.partner_users(id) ON DELETE CASCADE,
  portal_id UUID NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.trading_room_plan_catalog(id) ON DELETE CASCADE,
  always_active BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (partner_user_id, plan_id)
);

ALTER TABLE public.trading_room_test_plan_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view trading room test overrides" ON public.trading_room_test_plan_overrides;
CREATE POLICY "Admins can view trading room test overrides"
ON public.trading_room_test_plan_overrides
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin')
);

DROP POLICY IF EXISTS "Admins can manage trading room test overrides" ON public.trading_room_test_plan_overrides;
CREATE POLICY "Admins can manage trading room test overrides"
ON public.trading_room_test_plan_overrides
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin')
);

DROP TRIGGER IF EXISTS update_trading_room_test_plan_overrides_updated_at ON public.trading_room_test_plan_overrides;
CREATE TRIGGER update_trading_room_test_plan_overrides_updated_at
BEFORE UPDATE ON public.trading_room_test_plan_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();