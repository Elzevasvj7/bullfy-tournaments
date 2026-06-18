ALTER TABLE public.video_studio_access
  ADD COLUMN IF NOT EXISTS host_auto_clip_opt_in boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.trigger_auto_clip_on_stream_end()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _has_access boolean;
  _has_recording boolean;
  _base_url text := 'https://dpfqhwcjyecpnvtchudo.supabase.co';
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnFod2NqeWVjcG52dGNodWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTAyNzMsImV4cCI6MjA4ODY4NjI3M30.jn-UUyI5p87-j9Bi5biWIvCIxBH3DolY7aldMcj7MdI';
BEGIN
  IF NEW.status <> 'ended' OR OLD.status = 'ended' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.video_studio_access
    WHERE user_id = NEW.host_id
      AND enabled = true
      AND can_auto_clip = true
      AND host_auto_clip_opt_in = true
  ) INTO _has_access;

  IF NOT _has_access THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.live_recordings WHERE room_id = NEW.id
  ) INTO _has_recording;

  IF NOT _has_recording THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/auto-clip-post-stream',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || _anon_key),
    body := jsonb_build_object('room_id', NEW.id, 'host_id', NEW.host_id)
  );

  RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS "Hosts can update own auto_clip opt-in" ON public.video_studio_access;
CREATE POLICY "Hosts can update own auto_clip opt-in"
ON public.video_studio_access
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());