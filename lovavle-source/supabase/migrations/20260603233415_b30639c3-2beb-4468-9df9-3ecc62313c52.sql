-- =============================================================================
-- Validez de membresías + vencimiento por usuario + campañas de recordatorio
-- =============================================================================

ALTER TABLE public.portal_products
  ADD COLUMN IF NOT EXISTS validity_months int;

COMMENT ON COLUMN public.portal_products.validity_months IS
  'Validez de la membresía en meses (1–12). NULL = vitalicia. Solo aplica a product_type=membership.';

CREATE TABLE IF NOT EXISTS public.portal_user_memberships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id       uuid NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  partner_user_id uuid NOT NULL REFERENCES public.partner_users(id) ON DELETE CASCADE,
  product_id      uuid REFERENCES public.portal_products(id) ON DELETE SET NULL,
  tier_slug       text NOT NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,
  status          text NOT NULL DEFAULT 'active',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_user_memberships TO authenticated;
GRANT ALL ON public.portal_user_memberships TO service_role;

CREATE INDEX IF NOT EXISTS idx_portal_user_memberships_expiry
  ON public.portal_user_memberships (portal_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_portal_user_memberships_user
  ON public.portal_user_memberships (partner_user_id);

ALTER TABLE public.portal_user_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages user memberships" ON public.portal_user_memberships;
CREATE POLICY "Service role manages user memberships"
  ON public.portal_user_memberships FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Portal owner views user memberships" ON public.portal_user_memberships;
CREATE POLICY "Portal owner views user memberships"
  ON public.portal_user_memberships FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
    OR EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs ib ON ib.id::text = pp.ib_id::text
      WHERE pp.id = portal_user_memberships.portal_id
      AND ib.created_by = auth.uid()
    )
    OR public.has_role(auth.uid(), 'ib_externo')
  );

CREATE TABLE IF NOT EXISTS public.portal_membership_reminder_campaigns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id   uuid NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  name        text NOT NULL,
  days_before int  NOT NULL DEFAULT 7,
  subject     text NOT NULL,
  message     text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_membership_reminder_campaigns TO authenticated;
GRANT ALL ON public.portal_membership_reminder_campaigns TO service_role;

CREATE INDEX IF NOT EXISTS idx_reminder_campaigns_portal
  ON public.portal_membership_reminder_campaigns (portal_id, active);

ALTER TABLE public.portal_membership_reminder_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Portal owner manages reminder campaigns" ON public.portal_membership_reminder_campaigns;
CREATE POLICY "Portal owner manages reminder campaigns"
  ON public.portal_membership_reminder_campaigns FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
    OR EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs ib ON ib.id::text = pp.ib_id::text
      WHERE pp.id = portal_membership_reminder_campaigns.portal_id
      AND ib.created_by = auth.uid()
    )
    OR public.has_role(auth.uid(), 'ib_externo')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
    OR EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs ib ON ib.id::text = pp.ib_id::text
      WHERE pp.id = portal_membership_reminder_campaigns.portal_id
      AND ib.created_by = auth.uid()
    )
    OR public.has_role(auth.uid(), 'ib_externo')
  );

CREATE TABLE IF NOT EXISTS public.portal_membership_reminder_log (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id        uuid NOT NULL REFERENCES public.portal_membership_reminder_campaigns(id) ON DELETE CASCADE,
  user_membership_id uuid NOT NULL REFERENCES public.portal_user_memberships(id) ON DELETE CASCADE,
  email              text,
  sent_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_membership_id)
);

GRANT SELECT ON public.portal_membership_reminder_log TO authenticated;
GRANT ALL ON public.portal_membership_reminder_log TO service_role;

ALTER TABLE public.portal_membership_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages reminder log" ON public.portal_membership_reminder_log;
CREATE POLICY "Service role manages reminder log"
  ON public.portal_membership_reminder_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_portal_user_memberships_updated_at ON public.portal_user_memberships;
CREATE TRIGGER update_portal_user_memberships_updated_at
  BEFORE UPDATE ON public.portal_user_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_reminder_campaigns_updated_at ON public.portal_membership_reminder_campaigns;
CREATE TRIGGER update_reminder_campaigns_updated_at
  BEFORE UPDATE ON public.portal_membership_reminder_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.expire_due_memberships()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m         record;
  base_slug text;
  next_tier text;
BEGIN
  FOR m IN
    SELECT * FROM public.portal_user_memberships
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at <= now()
  LOOP
    UPDATE public.portal_user_memberships
      SET status = 'expired', updated_at = now()
      WHERE id = m.id;

    SELECT slug INTO base_slug
      FROM public.partner_tiers
      WHERE portal_id = m.portal_id AND is_default
      LIMIT 1;

    SELECT tier_slug INTO next_tier
      FROM public.portal_user_memberships
      WHERE partner_user_id = m.partner_user_id AND portal_id = m.portal_id
        AND status = 'active' AND id <> m.id
      ORDER BY started_at DESC
      LIMIT 1;

    IF next_tier IS NULL THEN
      next_tier := base_slug;
    END IF;

    IF next_tier IS NOT NULL THEN
      UPDATE public.partner_users pu
        SET tier = next_tier
        WHERE pu.id = m.partner_user_id
          AND pu.tier = m.tier_slug
          AND pu.tier <> next_tier;

      IF FOUND THEN
        INSERT INTO public.partner_tier_upgrades
          (partner_user_id, portal_id, old_tier, new_tier, upgrade_method)
        VALUES (m.partner_user_id, m.portal_id, m.tier_slug, next_tier, 'expiry');
      END IF;
    END IF;
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron no instalado; se omiten los crons de membresías.';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-memberships-daily') THEN
    PERFORM cron.schedule('expire-memberships-daily', '0 2 * * *', $job$ SELECT public.expire_due_memberships(); $job$);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'membership-reminders-daily') THEN
    PERFORM cron.schedule('membership-reminders-daily', '0 13 * * *', $job$ SELECT net.http_post( url := 'https://dpfqhwcjyecpnvtchudo.supabase.co/functions/v1/membership-reminders', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnFod2NqeWVjcG52dGNodWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTAyNzMsImV4cCI6MjA4ODY4NjI3M30.jn-UUyI5p87-j9Bi5biWIvCIxBH3DolY7aldMcj7MdI'), body := jsonb_build_object('triggered_by','cron','at', now()) ); $job$);
  END IF;
END $$;