
-- Monetization config (singleton-style, one active row)
CREATE TABLE public.live_monetization_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dolares_por_lead numeric NOT NULL DEFAULT 0,
  bono_visualizaciones_umbral integer NOT NULL DEFAULT 100,
  bono_visualizaciones_monto numeric NOT NULL DEFAULT 0,
  bono_streams_umbral integer NOT NULL DEFAULT 10,
  bono_streams_monto numeric NOT NULL DEFAULT 0,
  bono_interacciones_umbral integer NOT NULL DEFAULT 500,
  bono_interacciones_monto numeric NOT NULL DEFAULT 0,
  bono_votacion_umbral numeric NOT NULL DEFAULT 4.0,
  bono_votacion_monto numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.live_monetization_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage monetization config" ON public.live_monetization_config
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));

CREATE POLICY "Authenticated can read monetization config" ON public.live_monetization_config
  FOR SELECT TO authenticated USING (true);

-- Stream votes (1-5 stars per viewer per room)
CREATE TABLE public.live_stream_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  rating integer NOT NULL DEFAULT 5,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

ALTER TABLE public.live_stream_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can insert votes" ON public.live_stream_votes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authenticated can read votes" ON public.live_stream_votes
  FOR SELECT TO authenticated USING (true);

-- Streamer earnings ledger
CREATE TABLE public.live_streamer_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_streams integer NOT NULL DEFAULT 0,
  total_viewers integer NOT NULL DEFAULT 0,
  total_leads integer NOT NULL DEFAULT 0,
  total_interactions integer NOT NULL DEFAULT 0,
  avg_rating numeric NOT NULL DEFAULT 0,
  earnings_leads numeric NOT NULL DEFAULT 0,
  earnings_bonuses numeric NOT NULL DEFAULT 0,
  earnings_total numeric NOT NULL DEFAULT 0,
  bonus_details jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.live_streamer_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage earnings" ON public.live_streamer_earnings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));

CREATE POLICY "Hosts can read own earnings" ON public.live_streamer_earnings
  FOR SELECT TO authenticated USING (host_id = auth.uid());

-- Partner tier config (pricing per portal)
CREATE TABLE public.partner_tier_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  tier_name text NOT NULL DEFAULT 'vip',
  precio_upgrade numeric NOT NULL DEFAULT 0,
  crypto_address text,
  crypto_network text DEFAULT 'USDT-TRC20',
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(portal_id, tier_name)
);

ALTER TABLE public.partner_tier_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage tier config" ON public.partner_tier_config
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));

CREATE POLICY "Authenticated can read tier config" ON public.partner_tier_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anon can read active tier config" ON public.partner_tier_config
  FOR SELECT TO anon USING (active = true);

-- Partner tier upgrade log
CREATE TABLE public.partner_tier_upgrades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id uuid NOT NULL REFERENCES public.partner_users(id) ON DELETE CASCADE,
  portal_id uuid NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  old_tier text NOT NULL DEFAULT 'general',
  new_tier text NOT NULL,
  upgrade_method text NOT NULL DEFAULT 'manual',
  tx_hash text,
  performed_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_tier_upgrades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage tier upgrades" ON public.partner_tier_upgrades
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));

CREATE POLICY "Authenticated can read tier upgrades" ON public.partner_tier_upgrades
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anon can insert tier upgrades" ON public.partner_tier_upgrades
  FOR INSERT TO anon WITH CHECK (true);

-- Add tier to partner_users
ALTER TABLE public.partner_users ADD COLUMN tier text NOT NULL DEFAULT 'general';

-- Add required_tier to live_rooms
ALTER TABLE public.live_rooms ADD COLUMN required_tier text NOT NULL DEFAULT 'general';

-- Enable realtime for votes
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_stream_votes;
