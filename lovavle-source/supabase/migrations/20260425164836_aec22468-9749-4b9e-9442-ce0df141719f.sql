-- Add Bullfy referral link to portal & stream leads
ALTER TABLE public.partner_portals
  ADD COLUMN IF NOT EXISTS bullfy_referral_link text;

ALTER TABLE public.stream_leads
  ADD COLUMN IF NOT EXISTS bullfy_referral_link text;

COMMENT ON COLUMN public.partner_portals.bullfy_referral_link IS
  'IB referral link to Bullfy. Used to attribute stream leads back to the portal owner.';

COMMENT ON COLUMN public.stream_leads.bullfy_referral_link IS
  'Snapshot of partner_portals.bullfy_referral_link at the moment the lead was captured.';