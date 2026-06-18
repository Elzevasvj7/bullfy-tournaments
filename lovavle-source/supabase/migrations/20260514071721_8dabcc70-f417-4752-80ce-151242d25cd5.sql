CREATE TABLE public.tournament_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.tournament_users(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'general' CHECK (kind IN ('general','winner')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','rendering','completed','failed')),
  shotstack_render_id text,
  video_url text,
  thumbnail_url text,
  scenes_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tournament_highlights_tournament ON public.tournament_highlights(tournament_id);
CREATE INDEX idx_tournament_highlights_user ON public.tournament_highlights(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_tournament_highlights_render ON public.tournament_highlights(shotstack_render_id) WHERE shotstack_render_id IS NOT NULL;

ALTER TABLE public.tournament_highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view completed tournament highlights"
ON public.tournament_highlights FOR SELECT
USING (
  status = 'completed'
  AND EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = tournament_highlights.tournament_id
      AND t.status IN ('finished','settled')
  )
);

CREATE TRIGGER trg_tournament_highlights_updated_at
BEFORE UPDATE ON public.tournament_highlights
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('tournament-highlights', 'tournament-highlights', true, 104857600, ARRAY['video/mp4','image/jpeg','image/png'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 104857600;

CREATE POLICY "Public read tournament highlights"
ON storage.objects FOR SELECT
USING (bucket_id = 'tournament-highlights');

CREATE OR REPLACE FUNCTION public.on_tournament_finished_auto_highlight()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_url text;
  v_anon text;
BEGIN
  IF NEW.status IN ('finished','settled') AND (OLD.status IS DISTINCT FROM NEW.status) AND OLD.status NOT IN ('finished','settled') THEN
    v_url := 'https://dpfqhwcjyecpnvtchudo.supabase.co/functions/v1/tournament-auto-highlight';
    v_anon := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnFod2NqeWVjcG52dGNodWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTAyNzMsImV4cCI6MjA4ODY4NjI3M30.jn-UUyI5p87-j9Bi5biWIvCIxBH3DolY7aldMcj7MdI';

    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_anon),
      body := jsonb_build_object('tournament_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_tournament_finished_auto_highlight
AFTER UPDATE OF status ON public.tournaments
FOR EACH ROW
EXECUTE FUNCTION public.on_tournament_finished_auto_highlight();