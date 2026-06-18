
-- ============================================
-- PARTNER PORTALS (one per IB/SubIB)
-- ============================================
CREATE TABLE public.partner_portals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ib_id uuid REFERENCES public.ibs(id) ON DELETE CASCADE NOT NULL,
  sub_ib_id uuid REFERENCES public.sub_ibs(id) ON DELETE CASCADE,
  nombre_portal text NOT NULL UNIQUE,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  enabled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_portals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active portals"
  ON public.partner_portals FOR SELECT TO authenticated
  USING (status = 'active');

CREATE POLICY "Admins can manage portals"
  ON public.partner_portals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Public can read active portals"
  ON public.partner_portals FOR SELECT TO anon
  USING (status = 'active');

-- ============================================
-- PARTNER USERS (clients of each IB portal)
-- ============================================
CREATE TABLE public.partner_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid REFERENCES public.partner_portals(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  nombre text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(portal_id, email)
);

ALTER TABLE public.partner_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portal admins can manage their users"
  ON public.partner_users FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs i ON i.id = pp.ib_id
      WHERE pp.id = partner_users.portal_id
      AND i.created_by = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
  );

-- ============================================
-- LIVE ROOMS
-- ============================================
CREATE TABLE public.live_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  host_id uuid NOT NULL,
  portal_id uuid REFERENCES public.partner_portals(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'scheduled',
  livekit_room_name text NOT NULL UNIQUE,
  viewer_count integer NOT NULL DEFAULT 0,
  max_viewers integer NOT NULL DEFAULT 0,
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read rooms"
  ON public.live_rooms FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Host can manage own rooms"
  ON public.live_rooms FOR ALL TO authenticated
  USING (host_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Anon can read active rooms for portal"
  ON public.live_rooms FOR SELECT TO anon
  USING (status = 'live' AND portal_id IS NOT NULL);

-- ============================================
-- LIVE INVITE CODES (one-time use for externals)
-- ============================================
CREATE TABLE public.live_invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.live_rooms(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  used_by_name text,
  used_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage invite codes"
  ON public.live_invite_codes FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Anon can read valid codes"
  ON public.live_invite_codes FOR SELECT TO anon
  USING (used_at IS NULL AND expires_at > now());

-- Triggers for updated_at
CREATE TRIGGER update_partner_portals_updated_at BEFORE UPDATE ON public.partner_portals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partner_users_updated_at BEFORE UPDATE ON public.partner_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_live_rooms_updated_at BEFORE UPDATE ON public.live_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
