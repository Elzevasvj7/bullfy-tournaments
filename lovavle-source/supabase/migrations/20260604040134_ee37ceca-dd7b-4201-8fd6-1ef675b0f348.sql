-- =============================================================================
-- Endurecimiento de seguridad RLS — Paso 2 (fixables sin romper flujos)
-- =============================================================================
-- Cierra fugas donde el acceso legítimo es: inserción vía Edge Function
-- (service_role) y/o lectura/edición por staff autenticado con rol. Se quitan
-- las policies públicas `USING/WITH CHECK (true)` y se reemplazan por acceso
-- autenticado por rol. La inserción pública sigue por la EF correspondiente.
-- =============================================================================

-- ── experience_leads (Lead PII públicamente legible y editable) ──────────────
-- Inserta: experience-contact-request (service_role). Lee/edita: CRM LeadsPanel
-- (roles bd / admin_bd / admin). El cliente NO inserta ni lee directo.
DROP POLICY IF EXISTS "Anyone can insert leads" ON public.experience_leads;
DROP POLICY IF EXISTS "Anyone can read leads"   ON public.experience_leads;
DROP POLICY IF EXISTS "Anyone can update leads" ON public.experience_leads;
DROP POLICY IF EXISTS "Staff read experience leads" ON public.experience_leads;
DROP POLICY IF EXISTS "Staff update experience leads" ON public.experience_leads;

CREATE POLICY "Staff read experience leads" ON public.experience_leads
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'global_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_bd'::public.app_role)
    OR public.has_role(auth.uid(), 'bd'::public.app_role)
  );

CREATE POLICY "Staff update experience leads" ON public.experience_leads
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'global_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_bd'::public.app_role)
    OR public.has_role(auth.uid(), 'bd'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'global_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_bd'::public.app_role)
    OR public.has_role(auth.uid(), 'bd'::public.app_role)
  );
-- INSERT queda solo para service_role (la EF) → no requiere policy (bypassa RLS).


-- ── live_viewer_presence (emails/teléfonos de viewers legibles por anon) ─────
-- El viewer anónimo solo INSERTA/ACTUALIZA su propia presencia (useViewerPresence).
-- TODAS las lecturas son de staff autenticado (LiveStreamerReports, LeadDetail,
-- LeadReports) cubiertas por "Lead roles can read presence". La policy anon de
-- SELECT es la fuga → se elimina. Insert/Update anónimos se conservan.
DROP POLICY IF EXISTS "Anon can read own presence" ON public.live_viewer_presence;


-- ── partner_users (password_hash legible por anon; algunas en texto plano) ───
-- El cliente del portal es ANÓNIMO y lee partner_users por id (tier/email/avatar/
-- can_be_business_partner) y el registro lee id (sponsor). NUNCA lee password_hash.
-- El login usa una Edge Function con service_role (acceso total, no afectado).
-- Fix: quitar al rol anon el SELECT de tabla y re-grantear SOLO las columnas
-- seguras → se oculta password_hash sin romper portal/registro. (La regla RLS
-- "Anon can read own partner_user by id" se conserva; la enumeración de
-- emails/telefonos queda para el refactor de auth por usuario.)
REVOKE SELECT ON public.partner_users FROM anon;
GRANT SELECT (
  id, portal_id, email, nombre, status, tier, telefono, avatar_url,
  can_be_business_partner, is_host, mlm_enabled,
  referred_by, referred_at, created_at, updated_at
) ON public.partner_users TO anon;
-- (password_hash queda EXCLUIDA → anon ya no puede leerla.)


-- ── portal_order_items (defensa en profundidad) ─────────────────────────────
-- Ningún cliente lee esta tabla (solo el panel del IB autenticado y las EFs con
-- service_role). Se quita la lectura pública y se restringe a admin/dueño del
-- portal, replicando el predicado que ya usa portal_orders. (portal_orders en sí
-- queda para el refactor de auth porque el cliente anónimo sondea su pago ahí.)
DROP POLICY IF EXISTS "Public can read order items" ON public.portal_order_items;
DROP POLICY IF EXISTS "Admins and portal owners view order items" ON public.portal_order_items;
CREATE POLICY "Admins and portal owners view order items" ON public.portal_order_items
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
    OR EXISTS (
      SELECT 1 FROM public.portal_orders o
      JOIN public.partner_portals pp ON pp.id = o.portal_id
      JOIN public.ibs ib ON ib.id::text = pp.ib_id::text
      WHERE o.id = portal_order_items.order_id
      AND ib.created_by = auth.uid()
    )
  );


-- ── portal_payment_transactions (payloads de pasarela / cripto / callbacks) ──
-- La lee solo SandboxGateways (settings de admin) + las EFs (service_role).
-- Ningún cliente anónimo la lee → se quita la lectura pública y se restringe a
-- admin/global_admin y al dueño del portal (vía portal_id).
DROP POLICY IF EXISTS "Anyone can read payment transactions" ON public.portal_payment_transactions;
DROP POLICY IF EXISTS "Admins and portal owners view payment transactions" ON public.portal_payment_transactions;
CREATE POLICY "Admins and portal owners view payment transactions" ON public.portal_payment_transactions
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'global_admin')
    OR EXISTS (
      SELECT 1 FROM public.partner_portals pp
      JOIN public.ibs ib ON ib.id::text = pp.ib_id::text
      WHERE pp.id = portal_payment_transactions.portal_id
      AND ib.created_by = auth.uid()
    )
  );


-- ── tournament_users (email/teléfono/password_hash/IPs legibles por anon) ────
-- El cliente anónimo lee esta tabla SOLO para perfiles/ranking públicos
-- (id, full_name, country, username, avatares, public_profile, is_elite,
-- is_verified_user, clan_id). El email/teléfono/IPs y el perfil propio se leen
-- por Edge Function con sesión (service_role). Fix igual que partner_users:
-- quitar el SELECT de tabla al anon y re-grantear SOLO las columnas de perfil
-- público → se ocultan email, phone, password_hash, signup_ip, last_login_ip, etc.
-- La regla RLS pública del leaderboard (users_public_minimal_read) se conserva.
REVOKE SELECT ON public.tournament_users FROM anon;
GRANT SELECT (
  id, full_name, country, username, avatar_url, avatar_config, avatar_3d_url,
  public_profile, is_elite, is_verified_user, clan_id
) ON public.tournament_users TO anon;
-- (email, phone, password_hash, signup_ip, last_login_ip, kyc_status, lead_id,
--  metadata, etc. quedan EXCLUIDAS → ya no legibles por anon.)
