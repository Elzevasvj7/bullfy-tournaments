
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove if previously scheduled (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('trading-room-expire-subs-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'trading-room-expire-subs-daily',
  '0 3 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://dpfqhwcjyecpnvtchudo.supabase.co/functions/v1/trading-room-expire-subscriptions',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnFod2NqeWVjcG52dGNodWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTAyNzMsImV4cCI6MjA4ODY4NjI3M30.jn-UUyI5p87-j9Bi5biWIvCIxBH3DolY7aldMcj7MdI"}'::jsonb,
    body := '{}'::jsonb
  );
  $cron$
);
