-- ============================================================================
-- PR #8 — Cleanup remanente
-- Cubre: C2 (TOR-18 password MT5 expuesto al cliente)
-- ============================================================================
-- Las otras correcciones del PR #8 (D7, D8, D4b) son solo código (frontend +
-- Edge Functions) y no requieren cambios de schema.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- C2 / TOR-18: revocar SELECT sobre mt5_password para anon/authenticated
-- ----------------------------------------------------------------------------
-- TournamentMT5Account.tsx mostraba el password con un botón "ojo". Aunque el
-- PR #8 quita el botón y el campo del SELECT del frontend, un atacante con
-- dev tools y la anon key podía readd la columna a la query y obtenerlo.
-- Defensa en profundidad: a nivel de privilegio de columna, anon y
-- authenticated quedan sin acceso. Service_role (las Edge Functions) sigue
-- leyendo el campo sin restricción para gestionar la cuenta MT5.
-- IMPACTO FRONTEND: cualquier SELECT * o select() que incluya mt5_password
-- devolverá "permission denied for column mt5_password" — por eso este PR
-- también actualiza TournamentMT5Account.tsx para no pedir esa columna.
-- ----------------------------------------------------------------------------
REVOKE SELECT (mt5_password) ON public.tournament_participants FROM anon, authenticated;
