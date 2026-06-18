ALTER TABLE public.trading_room_order_intents
  DROP CONSTRAINT IF EXISTS trading_room_order_intents_execution_status_check;

ALTER TABLE public.trading_room_order_intents
  ADD CONSTRAINT trading_room_order_intents_execution_status_check
  CHECK (execution_status = ANY (ARRAY[
    'draft'::text,
    'queued'::text,
    'sent'::text,
    'filled'::text,
    'executed'::text,
    'rejected'::text,
    'failed'::text,
    'cancelled'::text
  ]));