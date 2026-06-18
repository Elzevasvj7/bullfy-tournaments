
-- Function to trigger auto-clip processing when a stream ends
CREATE OR REPLACE FUNCTION public.trigger_auto_clip_on_stream_end()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _has_access boolean;
  _has_recording boolean;
  _base_url text := 'https://dpfqhwcjyecpnvtchudo.supabase.co';
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnFod2NqeWVjcG52dGNodWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTAyNzMsImV4cCI6MjA4ODY4NjI3M30.jn-UUyI5p87-j9Bi5biWIvCIxBH3DolY7aldMcj7MdI';
BEGIN
  -- Only trigger when status changes to 'ended'
  IF NEW.status <> 'ended' OR OLD.status = 'ended' THEN
    RETURN NEW;
  END IF;

  -- Check if host has Video Studio with auto-clip enabled
  SELECT EXISTS (
    SELECT 1 FROM public.video_studio_access
    WHERE user_id = NEW.host_id
      AND enabled = true
      AND can_auto_clip = true
  ) INTO _has_access;

  IF NOT _has_access THEN
    RETURN NEW;
  END IF;

  -- Check if there's at least one recording for this room
  SELECT EXISTS (
    SELECT 1 FROM public.live_recordings
    WHERE room_id = NEW.id
  ) INTO _has_recording;

  IF NOT _has_recording THEN
    RETURN NEW;
  END IF;

  -- Invoke auto-clip-post-stream asynchronously via pg_net
  PERFORM net.http_post(
    url := _base_url || '/functions/v1/auto-clip-post-stream',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    ),
    body := jsonb_build_object(
      'room_id', NEW.id,
      'host_id', NEW.host_id
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger on live_rooms
CREATE TRIGGER on_stream_ended_auto_clip
  AFTER UPDATE ON public.live_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_clip_on_stream_end();
