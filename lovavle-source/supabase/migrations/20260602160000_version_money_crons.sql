-- ============================================================================
-- Versionar los cron jobs de dinero/portal (QA #70 — dueño/cronología de jobs)
-- ----------------------------------------------------------------------------
-- Los crons que liberan comisiones, expiran suscripciones y notifican vencimiento
-- existian solo en la BD (panel Supabase), no en el repo. Esta migracion los
-- DOCUMENTA y REPRODUCE de forma SEGURA: solo los agenda si NO existen ya
-- (consulta cron.job), por lo que en produccion (donde ya estan activos) es un
-- NO-OP — no pisa ni altera los jobs vivos. En una BD nueva (DR/clon) los recrea.
-- Requiere pg_cron (si no esta instalado, se omite sin error).
-- Idempotente.
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron no instalado; se omite el agendamiento de crons.';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mlm-release-commissions-hourly') THEN
    PERFORM cron.schedule('mlm-release-commissions-hourly', '0 * * * *', $job$ SELECT net.http_post( url := 'https://dpfqhwcjyecpnvtchudo.supabase.co/functions/v1/mlm-release-commissions', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnFod2NqeWVjcG52dGNodWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTAyNzMsImV4cCI6MjA4ODY4NjI3M30.jn-UUyI5p87-j9Bi5biWIvCIxBH3DolY7aldMcj7MdI'), body := jsonb_build_object('triggered_by','cron','at', now()) ); $job$);
    RAISE NOTICE 'cron agendado: mlm-release-commissions-hourly';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-expiring-subscriptions-daily') THEN
    PERFORM cron.schedule('notify-expiring-subscriptions-daily', '0 9 * * *', $job$ SELECT net.http_post( url := 'https://dpfqhwcjyecpnvtchudo.supabase.co/functions/v1/notify-expiring-subscriptions', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')), body := '{}'::jsonb ); $job$);
    RAISE NOTICE 'cron agendado: notify-expiring-subscriptions-daily';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'trading-room-expire-subs-daily') THEN
    PERFORM cron.schedule('trading-room-expire-subs-daily', '0 3 * * *', $job$ SELECT net.http_post( url := 'https://dpfqhwcjyecpnvtchudo.supabase.co/functions/v1/trading-room-expire-subscriptions', headers := jsonb_build_object('Content-Type','application/json','apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnFod2NqeWVjcG52dGNodWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTAyNzMsImV4cCI6MjA4ODY4NjI3M30.jn-UUyI5p87-j9Bi5biWIvCIxBH3DolY7aldMcj7MdI'), body := '{}'::jsonb ); $job$);
    RAISE NOTICE 'cron agendado: trading-room-expire-subs-daily';
  END IF;
END $$;
