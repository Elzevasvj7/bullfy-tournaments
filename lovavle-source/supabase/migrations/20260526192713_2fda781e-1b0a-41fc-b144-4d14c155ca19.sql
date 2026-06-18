
-- 1. Extender stream_leads con campos de Telegram
ALTER TABLE public.stream_leads
  ADD COLUMN IF NOT EXISTS telegram_chat_id bigint,
  ADD COLUMN IF NOT EXISTS telegram_user_id bigint,
  ADD COLUMN IF NOT EXISTS telegram_username text,
  ADD COLUMN IF NOT EXISTS telegram_linked_at timestamptz,
  ADD COLUMN IF NOT EXISTS telegram_last_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_stream_leads_telegram_chat_id ON public.stream_leads(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_stream_leads_telegram_user_id ON public.stream_leads(telegram_user_id);

-- 2. telegram_messages
CREATE TABLE public.telegram_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.stream_leads(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  kind text NOT NULL CHECK (kind IN ('text','voice','photo','document','sticker','other')),
  body text,
  media_url text,
  voice_id_used text,
  tg_message_id bigint,
  tg_update_id bigint UNIQUE,
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_messages_lead_id ON public.telegram_messages(lead_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_messages TO authenticated;
GRANT ALL ON public.telegram_messages TO service_role;

ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view telegram messages"
  ON public.telegram_messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert telegram messages"
  ON public.telegram_messages FOR INSERT TO authenticated WITH CHECK (true);

-- 3. telegram_link_tokens
CREATE TABLE public.telegram_link_tokens (
  token text PRIMARY KEY,
  lead_id uuid REFERENCES public.stream_leads(id) ON DELETE CASCADE,
  lead_email text,
  lead_phone text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_link_tokens_lead_id ON public.telegram_link_tokens(lead_id);

GRANT SELECT ON public.telegram_link_tokens TO anon;
GRANT SELECT, INSERT, UPDATE ON public.telegram_link_tokens TO authenticated;
GRANT ALL ON public.telegram_link_tokens TO service_role;

ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede leer/crear un token (lo necesita el registro público y el webhook)
CREATE POLICY "Anyone can read link tokens"
  ON public.telegram_link_tokens FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can create link tokens"
  ON public.telegram_link_tokens FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 4. telegram_quick_templates
CREATE TABLE public.telegram_quick_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_quick_templates TO authenticated;
GRANT ALL ON public.telegram_quick_templates TO service_role;

ALTER TABLE public.telegram_quick_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access templates"
  ON public.telegram_quick_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Storage bucket para notas de voz
INSERT INTO storage.buckets (id, name, public)
VALUES ('telegram-voice-notes', 'telegram-voice-notes', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read telegram voice notes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'telegram-voice-notes');

CREATE POLICY "Service role write telegram voice notes"
  ON storage.objects FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'telegram-voice-notes');
