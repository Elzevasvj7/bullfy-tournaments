ALTER TABLE public.portal_events
  ADD COLUMN media_type            TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN video_thumbnail_path  TEXT,
  ADD COLUMN mux_upload_id         TEXT,
  ADD COLUMN mux_asset_id          TEXT,
  ADD COLUMN mux_playback_id       TEXT,
  ADD COLUMN mux_status            TEXT,
  ADD COLUMN mux_error_message     TEXT;