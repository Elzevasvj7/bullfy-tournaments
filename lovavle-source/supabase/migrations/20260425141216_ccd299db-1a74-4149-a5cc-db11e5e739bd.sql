-- Trigger function: invoke mlm-engine edge function when an order is paid
CREATE OR REPLACE FUNCTION public.trigger_mlm_engine_on_paid_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _base_url text := 'https://dpfqhwcjyecpnvtchudo.supabase.co';
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnFod2NqeWVjcG52dGNodWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTAyNzMsImV4cCI6MjA4ODY4NjI3M30.jn-UUyI5p87-j9Bi5biWIvCIxBH3DolY7aldMcj7MdI';
BEGIN
  -- Only fire on transition to 'paid'
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS DISTINCT FROM 'paid') THEN
    PERFORM net.http_post(
      url := _base_url || '/functions/v1/mlm-engine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _anon_key
      ),
      body := jsonb_build_object('order_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_mlm_engine_on_paid_order ON public.portal_orders;
CREATE TRIGGER trg_mlm_engine_on_paid_order
AFTER UPDATE OF payment_status ON public.portal_orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_mlm_engine_on_paid_order();

-- Also handle the INSERT case (orders created already paid, e.g. free items or pre-paid)
CREATE OR REPLACE FUNCTION public.trigger_mlm_engine_on_paid_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _base_url text := 'https://dpfqhwcjyecpnvtchudo.supabase.co';
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnFod2NqeWVjcG52dGNodWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTAyNzMsImV4cCI6MjA4ODY4NjI3M30.jn-UUyI5p87-j9Bi5biWIvCIxBH3DolY7aldMcj7MdI';
BEGIN
  IF NEW.payment_status = 'paid' THEN
    PERFORM net.http_post(
      url := _base_url || '/functions/v1/mlm-engine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _anon_key
      ),
      body := jsonb_build_object('order_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_mlm_engine_on_paid_insert ON public.portal_orders;
CREATE TRIGGER trg_mlm_engine_on_paid_insert
AFTER INSERT ON public.portal_orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_mlm_engine_on_paid_insert();