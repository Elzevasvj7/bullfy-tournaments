CREATE OR REPLACE FUNCTION public.send_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _base_url text := 'https://dpfqhwcjyecpnvtchudo.supabase.co';
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnFod2NqeWVjcG52dGNodWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTAyNzMsImV4cCI6MjA4ODY4NjI3M30.jn-UUyI5p87-j9Bi5biWIvCIxBH3DolY7aldMcj7MdI';
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    PERFORM net.http_post(
      url := _base_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _anon_key
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'title', NEW.title,
        'message', NEW.message,
        'type', NEW.type,
        'reference_id', NEW.reference_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.send_push_on_notification();