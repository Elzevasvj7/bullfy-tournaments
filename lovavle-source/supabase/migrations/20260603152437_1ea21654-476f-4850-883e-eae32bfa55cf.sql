
-- ============================================================
-- Lead System 2.0 — Fase 1
-- Tabla closer_community_assignments + helpers + RLS aislamiento
-- ============================================================

-- 1) Tabla de asignaciones closer ↔ comunidad (partner_portal)
CREATE TABLE IF NOT EXISTS public.closer_community_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portal_id uuid NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (closer_user_id, portal_id)
);

CREATE INDEX IF NOT EXISTS idx_cca_closer ON public.closer_community_assignments(closer_user_id);
CREATE INDEX IF NOT EXISTS idx_cca_portal ON public.closer_community_assignments(portal_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.closer_community_assignments TO authenticated;
GRANT ALL ON public.closer_community_assignments TO service_role;

ALTER TABLE public.closer_community_assignments ENABLE ROW LEVEL SECURITY;

-- Closers ven sus propias asignaciones; managers/admins gestionan todo
CREATE POLICY "Closer reads own assignments"
  ON public.closer_community_assignments
  FOR SELECT TO authenticated
  USING (closer_user_id = auth.uid()
      OR public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'global_admin'::app_role)
      OR public.has_role(auth.uid(),'admin_ventas'::app_role));

CREATE POLICY "Admins manage assignments"
  ON public.closer_community_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'global_admin'::app_role)
      OR public.has_role(auth.uid(),'admin_ventas'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'global_admin'::app_role)
      OR public.has_role(auth.uid(),'admin_ventas'::app_role));

-- 2) Columnas aditivas en stream_leads (necesarias para F2/F3, agregadas ya)
ALTER TABLE public.stream_leads
  ADD COLUMN IF NOT EXISTS taken_at timestamptz,
  ADD COLUMN IF NOT EXISTS contact_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS auto_reassign_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tournament_id uuid;

CREATE INDEX IF NOT EXISTS idx_stream_leads_tournament_id ON public.stream_leads(tournament_id);
CREATE INDEX IF NOT EXISTS idx_stream_leads_taken_at ON public.stream_leads(taken_at);

-- 3) Categoría en lead_notes (para F4 — agregada ya)
ALTER TABLE public.lead_notes
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'nota';

-- 4) Helper SECURITY DEFINER: ¿closer puede acceder a este portal?
CREATE OR REPLACE FUNCTION public.closer_can_access_portal(_user uuid, _portal uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _portal IS NULL
    OR public.has_role(_user, 'admin'::app_role)
    OR public.has_role(_user, 'global_admin'::app_role)
    OR public.has_role(_user, 'admin_ventas'::app_role)
    OR public.has_role(_user, 'marketing'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.closer_community_assignments
      WHERE closer_user_id = _user AND portal_id = _portal
    );
$$;

-- 5) Reemplazar política SELECT global de "ventas" por aislamiento por comunidad
DROP POLICY IF EXISTS "Lead roles can read stream leads" ON public.stream_leads;

-- Admins / marketing / admin_ventas ven todo (sin cambios efectivos)
CREATE POLICY "Lead admin roles read all stream leads"
  ON public.stream_leads
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'global_admin'::app_role)
    OR public.has_role(auth.uid(),'admin_ventas'::app_role)
    OR public.has_role(auth.uid(),'marketing'::app_role)
  );

-- Closers (ventas) ven SOLO leads de comunidades asignadas o leads de torneo asignados a ellos o leads ya tomados por ellos
CREATE POLICY "Ventas read leads of assigned communities"
  ON public.stream_leads
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'ventas'::app_role)
    AND (
      assigned_to = auth.uid()
      OR (source = 'tournament' AND assigned_to = auth.uid())
      OR public.closer_can_access_portal(auth.uid(), partner_portal_id)
    )
  );

-- 6) Política UPDATE para closer: permitir tomar (asignarse) un lead disponible de su comunidad
DROP POLICY IF EXISTS "Ventas can take available leads in assigned communities" ON public.stream_leads;
CREATE POLICY "Ventas can take available leads in assigned communities"
  ON public.stream_leads
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'ventas'::app_role)
    AND (
      assigned_to = auth.uid()
      OR (assigned_to IS NULL AND public.closer_can_access_portal(auth.uid(), partner_portal_id))
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(),'ventas'::app_role)
    AND (assigned_to = auth.uid() OR assigned_to IS NULL)
  );

-- 7) Habilitar Realtime en la nueva tabla
ALTER PUBLICATION supabase_realtime ADD TABLE public.closer_community_assignments;
