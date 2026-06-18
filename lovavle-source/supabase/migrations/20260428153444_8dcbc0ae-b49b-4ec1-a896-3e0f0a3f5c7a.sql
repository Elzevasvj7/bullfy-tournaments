ALTER TABLE public.trading_room_order_intents
  ADD COLUMN IF NOT EXISTS metaapi_position_id text;

CREATE INDEX IF NOT EXISTS idx_tr_order_intents_room_user
  ON public.trading_room_order_intents (room_id, partner_user_id, execution_status)
  WHERE room_id IS NOT NULL;