-- ============================================================================
-- HOTFIX — REVOKE de columnas a nivel column-grant (PR #7 A5 + PR #8 C2)
-- ============================================================================
-- Las migraciones originales de PR #7 (20260526040000) y PR #8 (20260526050000)
-- usaron `REVOKE SELECT (col) ON tabla FROM anon, authenticated`. En Postgres,
-- ese REVOKE column-level NO surte efecto si el rol ya tiene un GRANT
-- table-level (que es el default de Supabase: `GRANT SELECT ON ALL TABLES IN
-- SCHEMA public TO anon, authenticated`). Resultado: `invite_code` y
-- `mt5_password` quedaron accesibles para anon/authenticated pese al REVOKE.
--
-- Verificación post-aplicación con has_column_privilege devolvió true/true
-- para ambas columnas restringidas — lo opuesto a lo esperado.
--
-- Fix correcto: REVOKE el SELECT a nivel tabla y volver a GRANT-ar a nivel
-- columna excluyendo las columnas restringidas. Usamos un DO block dinámico
-- para que el grant cubra todas las columnas actuales sin tener que listarlas
-- (y para sobrevivir a futuros ADD COLUMN — basta re-ejecutar esta migración
-- después de agregar columnas).
-- ============================================================================

DO $$
DECLARE
  cols text;
BEGIN
  -- --------------------------------------------------------------------------
  -- PR #7 A5: tournament_clans.invite_code restringido
  -- --------------------------------------------------------------------------
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum)
  INTO cols
  FROM pg_attribute
  WHERE attrelid = 'public.tournament_clans'::regclass
    AND attnum > 0
    AND NOT attisdropped
    AND attname <> 'invite_code';

  REVOKE SELECT ON public.tournament_clans FROM anon, authenticated;
  EXECUTE format(
    'GRANT SELECT (%s) ON public.tournament_clans TO anon, authenticated',
    cols
  );

  -- --------------------------------------------------------------------------
  -- PR #8 C2 / TOR-18: tournament_participants.mt5_password restringido
  -- --------------------------------------------------------------------------
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum)
  INTO cols
  FROM pg_attribute
  WHERE attrelid = 'public.tournament_participants'::regclass
    AND attnum > 0
    AND NOT attisdropped
    AND attname <> 'mt5_password';

  REVOKE SELECT ON public.tournament_participants FROM anon, authenticated;
  EXECUTE format(
    'GRANT SELECT (%s) ON public.tournament_participants TO anon, authenticated',
    cols
  );
END
$$;

-- ============================================================================
-- Verificación esperada post-aplicación:
--   has_column_privilege('anon', 'tournament_clans', 'invite_code',   'SELECT') = false
--   has_column_privilege('anon', 'tournament_participants', 'mt5_password', 'SELECT') = false
--   has_column_privilege('anon', 'tournament_clans', 'name',          'SELECT') = true
--   has_column_privilege('anon', 'tournament_participants', 'mt5_login', 'SELECT') = true
-- ============================================================================
