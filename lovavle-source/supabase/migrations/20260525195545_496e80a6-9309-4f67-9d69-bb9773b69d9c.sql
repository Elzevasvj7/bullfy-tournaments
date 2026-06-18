-- 1. Borrar duplicados conservando el más antiguo por email
WITH ranked AS (
  SELECT id, email,
    ROW_NUMBER() OVER (PARTITION BY lower(email) ORDER BY created_at ASC) AS rn
  FROM public.partner_users
)
DELETE FROM public.partner_users
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2. Reemplazar índice único compuesto por uno global sobre email (case-insensitive)
ALTER TABLE public.partner_users
  DROP CONSTRAINT IF EXISTS partner_users_portal_id_email_key;

CREATE UNIQUE INDEX partner_users_email_unique
  ON public.partner_users (lower(email));