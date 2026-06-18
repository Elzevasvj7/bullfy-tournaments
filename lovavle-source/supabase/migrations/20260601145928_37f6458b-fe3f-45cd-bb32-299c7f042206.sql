-- Función de limpieza de logs de cron
CREATE OR REPLACE FUNCTION public.cleanup_cron_logs()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_before bigint;
  v_after  bigint;
  v_kept   bigint;
BEGIN
  SELECT pg_total_relation_size('cron.job_run_details') INTO v_before;

  CREATE TEMP TABLE _keep_cron ON COMMIT DROP AS
    SELECT * FROM cron.job_run_details
    WHERE start_time >= now() - interval '7 days';

  TRUNCATE TABLE cron.job_run_details;

  INSERT INTO cron.job_run_details SELECT * FROM _keep_cron;

  SELECT count(*) INTO v_kept FROM cron.job_run_details;
  SELECT pg_total_relation_size('cron.job_run_details') INTO v_after;

  RETURN format('before=%s after=%s kept_rows=%s',
                pg_size_pretty(v_before),
                pg_size_pretty(v_after),
                v_kept);
END;
$$;

-- Tarea nocturna 03:15 UTC
SELECT cron.schedule(
  'cleanup-cron-logs-nightly',
  '15 3 * * *',
  $$ SELECT public.cleanup_cron_logs(); $$
);