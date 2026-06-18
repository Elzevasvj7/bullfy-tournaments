-- Add required_tiers to live_rooms (NULL = open to all)
ALTER TABLE public.live_rooms
ADD COLUMN IF NOT EXISTS required_tiers TEXT[] DEFAULT NULL;

-- Add tier_streams_enabled flag to partner_portals
ALTER TABLE public.partner_portals
ADD COLUMN IF NOT EXISTS tier_streams_enabled BOOLEAN NOT NULL DEFAULT false;