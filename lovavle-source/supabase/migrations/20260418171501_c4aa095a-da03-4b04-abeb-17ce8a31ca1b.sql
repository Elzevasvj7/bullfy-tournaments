-- Seed global_admin with full access to all 7 live features
INSERT INTO public.live_feature_access (role, feature_key, enabled, user_id)
SELECT 'global_admin'::app_role, fk, true, NULL
FROM unnest(ARRAY['meeting_mode','webinar_pro_controls','breakout_rooms','recording_egress','live_transcription','polls_in_meeting','whiteboard']) AS fk
ON CONFLICT DO NOTHING;