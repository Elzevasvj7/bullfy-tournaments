
INSERT INTO storage.buckets (id, name, public) VALUES
  ('tournament-clans', 'tournament-clans', true),
  ('tournament-user-verifications', 'tournament-user-verifications', false)
ON CONFLICT (id) DO NOTHING;

-- Public read for clan assets
CREATE POLICY "tournament_clans_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'tournament-clans');
