-- Permitir dos cuentas (MetaAPI + Bridge) por partner_user simultáneamente
-- y elegir cuál se usa en el Stream.

-- 1. Eliminar UNIQUE viejo (1 fila por usuario)
ALTER TABLE public.trading_room_accounts
  DROP CONSTRAINT IF EXISTS trading_room_accounts_partner_user_id_key;

-- 2. Reemplazar CHECK de provider para permitir 'bridge'
ALTER TABLE public.trading_room_accounts
  DROP CONSTRAINT IF EXISTS trading_room_accounts_provider_check;
ALTER TABLE public.trading_room_accounts
  ADD CONSTRAINT trading_room_accounts_provider_check
  CHECK (provider = ANY (ARRAY['metaapi'::text, 'bridge'::text]));

-- 3. Una fila única por (partner_user_id, provider)
ALTER TABLE public.trading_room_accounts
  ADD CONSTRAINT trading_room_accounts_user_provider_key
  UNIQUE (partner_user_id, provider);

-- 4. Bandera de cuenta activa para el Stream
ALTER TABLE public.trading_room_accounts
  ADD COLUMN IF NOT EXISTS is_active_for_stream boolean NOT NULL DEFAULT false;

-- 5. Garantía: solo una cuenta activa por usuario
CREATE UNIQUE INDEX IF NOT EXISTS idx_trading_room_accounts_active_per_user
  ON public.trading_room_accounts (partner_user_id)
  WHERE is_active_for_stream = true;

-- 6. Backfill: marcar las cuentas existentes como activas
UPDATE public.trading_room_accounts
   SET is_active_for_stream = true
 WHERE is_active_for_stream = false;