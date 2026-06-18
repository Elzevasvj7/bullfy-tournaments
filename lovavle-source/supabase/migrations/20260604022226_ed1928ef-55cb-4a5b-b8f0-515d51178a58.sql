-- =============================================================================
-- Endurecimiento de seguridad RLS — Paso 1 (fixes sin riesgo de flujo)
-- =============================================================================
-- Cierra fugas críticas en tablas cuyo acceso legítimo es SOLO vía Edge
-- Functions con service_role (que ignoran RLS) o que son un bug de lógica.
-- Ningún cliente anónimo/autenticado lee estas tablas directamente, por lo que
-- remover las policies permisivas NO rompe ningún flujo.
--
-- Cubre 4 de los 12 errores críticos:
--   #2 partner_otp_codes — OTP legibles/actualizables por cualquiera.
--   #3 partner_password_reset_tokens — tokens de reset legibles por cualquiera.
--   #5 telegram_link_tokens — tokens + datos de lead legibles por cualquiera.
--   #7 accounting_expenses — bug "OR true" deja insertar a cualquier autenticado.
-- =============================================================================

-- ── #2 OTP: solo las Edge Functions (send/verify-otp, service_role) los tocan ──
DROP POLICY IF EXISTS "Anyone can read OTP by email"   ON public.partner_otp_codes;
DROP POLICY IF EXISTS "Anyone can update OTP codes"    ON public.partner_otp_codes;
DROP POLICY IF EXISTS "Anyone can create OTP codes"    ON public.partner_otp_codes;
-- (RLS sigue habilitada; sin policies, anon/authenticated quedan denegados;
--  service_role de las EFs ignora RLS y sigue funcionando.)

-- ── #3 Reset tokens: solo la EF partner-reset-password (service_role) los usa ──
DROP POLICY IF EXISTS "Allow anon select tokens" ON public.partner_password_reset_tokens;
DROP POLICY IF EXISTS "Allow anon update tokens" ON public.partner_password_reset_tokens;
DROP POLICY IF EXISTS "Allow anon insert tokens" ON public.partner_password_reset_tokens;
-- Se conserva "Portal owner can view tokens" (authenticated, scoped al portal)
-- para auditoría del IB; esa no es la fuga.

-- ── #5 Telegram link tokens: solo las EF de telegram (service_role) los usan ──
DROP POLICY IF EXISTS "Anyone can read link tokens"   ON public.telegram_link_tokens;
DROP POLICY IF EXISTS "Anyone can create link tokens" ON public.telegram_link_tokens;

-- ── #7 Accounting expenses: corregir el bug de lógica "OR true" en el INSERT ──
DROP POLICY IF EXISTS "exp_insert" ON public.accounting_expenses;
CREATE POLICY "exp_insert" ON public.accounting_expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'global_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'accountant'::public.app_role)
      OR public.has_role(auth.uid(), 'treasurer'::public.app_role)
    )
  );