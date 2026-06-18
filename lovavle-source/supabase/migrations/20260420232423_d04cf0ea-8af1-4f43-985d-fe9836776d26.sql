CREATE OR REPLACE FUNCTION public.trigger_analyze_pending_stream()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _base_url text := 'https://dpfqhwcjyecpnvtchudo.supabase.co';
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnFod2NqeWVjcG52dGNodWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTAyNzMsImV4cCI6MjA4ODY4NjI3M30.jn-UUyI5p87-j9Bi5biWIvCIxBH3DolY7aldMcj7MdI';
BEGIN
  -- Only fire when row is pending and has a transcript
  IF NEW.processing_status <> 'pending' THEN
    RETURN NEW;
  END IF;

  IF NEW.transcript IS NULL OR length(NEW.transcript) < 50 THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/analyze-stream-context',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    ),
    body := jsonb_build_object(
      'room_id', NEW.room_id,
      'host_id', NEW.host_id,
      'transcript', NEW.transcript
    )
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_analyze_pending_stream ON public.live_stream_analysis;

CREATE TRIGGER trg_analyze_pending_stream
AFTER INSERT OR UPDATE OF processing_status ON public.live_stream_analysis
FOR EACH ROW
WHEN (NEW.processing_status = 'pending')
EXECUTE FUNCTION public.trigger_analyze_pending_stream();