-- ============================================================================
-- Partner User Profile — foto de perfil y cambio de contraseña
-- ============================================================================
-- Agrega soporte de avatar a los usuarios del portal IB (partner_users).
-- Estos usuarios NO usan Supabase Auth (sesión propia en sessionStorage),
-- por lo que las políticas de storage y la función de update deben ser
-- accesibles para el rol `anon`.
--
-- Componentes:
--   1. Columna avatar_url en partner_users
--   2. Bucket partner-avatars (público)
--   3. Políticas RLS de storage para uploads anon
--   4. Función SECURITY DEFINER para actualizar solo avatar_url
--      (evita exponer un UPDATE general sobre partner_users al rol anon)
-- ============================================================================

-- 1. Columna avatar_url
ALTER TABLE public.partner_users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Bucket (no-op si ya existe vía dashboard)
INSERT INTO storage.buckets (id, name, public)
VALUES ('partner-avatars', 'partner-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas de storage
DROP POLICY IF EXISTS "partner-avatars: allow anon insert" ON storage.objects;
DROP POLICY IF EXISTS "partner-avatars: allow anon update" ON storage.objects;

CREATE POLICY "partner-avatars: allow anon insert"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'partner-avatars');

CREATE POLICY "partner-avatars: allow anon update"
  ON storage.objects FOR UPDATE TO anon
  USING  (bucket_id = 'partner-avatars')
  WITH CHECK (bucket_id = 'partner-avatars');

-- 4. Función para actualizar avatar_url sin exponer UPDATE general
CREATE OR REPLACE FUNCTION public.update_partner_user_avatar(
  p_user_id   uuid,
  p_avatar_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE partner_users
  SET avatar_url = p_avatar_url, updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_partner_user_avatar(uuid, text) TO anon;
