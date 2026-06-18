---
name: Live Translation System
description: Real-time translation for streams (subtitles) and meetings (voice TTS), gated by live_translation feature permission
type: feature
---

**Architecture:**
- Host transcribes via ElevenLabs Scribe (reuses `useStreamTranscription`).
- New hook `useTranslationPublisher` inserts each new committed segment into `live_translation_segments` (room_id, original_text, source_lang).
- Realtime enabled on the table; viewers subscribe and call `translate-segment` edge function (Lovable AI / Gemini Flash-Lite) for their target language → subtitles overlay (`ViewerTranslationOverlay`).
- For meetings: `MeetingTranslationPanel` lets each participant pick source/target lang and audio mode (substitute/overlay). Local mic → Scribe → `translate-tts` (Gemini + ElevenLabs Flash v2.5) → audio playback.

**Permission:** `live_translation` key in `live_feature_access` (per role and per user_id override). Toggle visible in `LiveFeatureAccessMatrix` and `IBLiveFeaturePermissions`.

**Languages:** ES, EN, PT, FR, DE, IT, RU.

**Edge functions:**
- `translate-segment` — text→text translation, returns `{ ok, translation }`.
- `translate-tts` — text→translated MP3 base64, returns `{ ok, translation, audio_base64 }`.
Both follow the HTTP 200 + `{ ok: false, error }` pattern.

**Integration points:**
- `MeetingHostShell` → "transcription" tab shows `HostTranslationToggle` + (if meeting) `MeetingTranslationPanel`.
- `MeetingViewerShell` → `ViewerTranslationOverlay` over the stage; `MeetingTranslationPanel` inside "reactions" tool tab when in meeting modes.

**Non-regression:** Does not modify `useStreamTranscription`, `AutoStreamTranscription`, LiveKit publishers, MT5 overlays, or analyze-stream-context flows.
