# Memory: index.md
Updated: now

# Bullfy IB Automated System

## Brand
- Colors: #062B63 (dark blue), #146EF5 (blue), #83CBFF (light blue), #A0B1BD (gray)
- Fonts: Figtree (texts/titles), Geist Mono (names/details, UPPERCASE only)
- Logo font: Helvetica Now Extra Bold (logo only)
- Current UI: Dark fintech with gold accents (user chose this)

## Design System
- Dark mode primary, gold gradients for accents
- Space Grotesk (display) + Inter (sans) currently configured

## Tech Decisions
- Lovable Cloud for DB, auth, report storage
- Reports are immutable, each with unique ID
- Domain provider: IONOS (ionos.com) — domain: bullfytech.online

## Auth & Roles (9 roles in app_role enum)
- **Global Admin**: full access + reset passwords + change roles
- **Admin**: full access to all IBs/BDs, approve/reject BDs
- **Admin Operaciones**: admin of ops team
- **Operaciones**: ops queue access
- **Dealing**: handles dealing-department requests in Operaciones
- **Admin BD**: inherits all BD permissions + can assign leads to BDs + receives email notifications for new leads
- **BD (Business Developer)**: only sees own IBs (created_by = auth.uid()), can view leads panel, gets bell notifications for new leads
- **User**: base role
- **IB Externo (ib_externo)**: external Introducing Broker, restricted to /ib-portal only, can submit requests (Sub IBs, marketing accounts, gift accounts, special)
- BD registration requires admin approval (status: pending → approved)
- IB Externo requires BD invitation + Admin approval (status: pending → approved)
- Profiles table linked to auth.users, auto-created via trigger
- Profiles has ib_id (links ib_externo to their IB record) and must_change_password flag
- Edge function `admin-reset-password` for Global Admin password resets
- Edge function `invite-ib-externo` for BD to invite IB to portal (creates auth user + temp password + email, sets pending status)
- Auto-confirm email enabled

## IB Externo Portal
- BD invites IB from IBMaintenance (button "Invitar Portal")
- IB gets email with temp password, forced to change on first login
- IB must be approved by admin before accessing portal
- Portal has: Landing (promos + request types), Solicitudes (dashboard), Nueva (request wizard)
- Request types: sub_ib, cuentas_marketing, cuentas_regalo, especial
- Request flow: IB submits → BD approves/rejects → Ops processes → Completed
- Tables: ib_external_requests (with request_type column), ib_external_request_history (bitácora)
- ib_portal_promotions table for administrable landing content (managed in Settings > Portal IB)
- Triple notifications: bell, email, push on every status change
- IB externo users redirected from any other route to /ib-portal

## Leads Panel Permissions
- All BDs (bd + admin_bd) see /experience-leads in sidebar
- All BDs get bell notifications for new leads
- Only admin_bd gets email notifications and can assign leads to BDs
- Admins can also assign leads

## Monetización Live
- Monetización exclusiva para rol `ib_externo` — el trigger `calculate_stream_earnings` verifica el rol antes de generar ganancias
- Tab "Ganancias" solo visible para IB Externos en LiveDashboard
- LiveStreamerMonetizationAdmin filtra hosts por rol `ib_externo`
- Roles internos (admin, bd, marketing, ventas) NO generan ganancias al hacer streams
- **Lead válido = presencia desde el inicio (±2 min) hasta el final (±2 min) del stream** ($1 c/u)
- `live_rooms.max_viewers/peak_viewers` se mantienen vía trigger `trg_update_room_max_viewers`
- Los 3 paneles (Stats / Reports / Earnings) leen de `live_streamer_earnings` como fuente única

## Stream Público (sin autenticación)
- Columna `is_public_stream` en `live_rooms` — toggle disponible en InviteCodeManager
- Solo roles internos (global_admin, admin, bd, marketing, ventas) pueden activar el toggle
- URL: `/live/guest?room={id}&public=true` — solo requiere nombre opcional
- No genera leads en `stream_leads` ni registra en `live_viewer_presence` con lead_id
- Edge function `livekit-token` acepta `isPublicStream: true` y valida contra la DB

## Memories
- [Color tokens](mem://style/brandbook) — Full Bullfy brand book with colors, fonts, usage rules
- [Theme adaptive UI](mem://style/theme-adaptive-ui) — Charts and gradient cards adapt to light/dark
- [Newsletter visual identity](mem://style/newsletter-visual-identity) — Premium editorial aesthetic for newsletters
- [Auth flow](mem://tech/supabase-sdk/auth-edge-functions) — Auth pattern in Edge Functions
- [Email integration](mem://tech/email-integration) — Resend transactional emails setup
- [Integration settings](mem://tech/integration-settings) — Global config via integration_settings table
- [Edge function error handling](mem://tech/edge-functions/error-handling-pattern) — HTTP 200 with error body pattern
- [Edge function AI resilience](mem://tech/edge-functions/ai-resilience-strategy) — Fallback models and retry logic
- [Edge function JSON parsing](mem://tech/edge-functions/json-parsing-safety) — Tolerant regex-based JSON extraction
- [Edge function memory](mem://tech/edge-functions/memory-constraints) — 150MB limit, chunked processing
- [ElevenLabs integration](mem://tech/elevenlabs-integration) — Scribe v2 transcription setup
- [Twilio integration](mem://tech/twilio/integration-and-config) — Voice and SMS config
- [Public link generation](mem://tech/public-link-generation) — Shareable links pattern
- [Lead system table mapping](mem://tech/lead-system/table-mapping) — stream_leads vs experience_leads
- [Anonymous registration](mem://tech/lead-system/anonymous-registration-logic) — Guest registration Edge Function
- [Partner portal login](mem://tech/partner-portal/login-architecture) — Proxied auth via Edge Function
- [Partner portal admin authority](mem://tech/partner-portal/admin-authority) — Portal ownership validation
- [Live system core](mem://tech/live-system/core-mechanics) — LiveKit + Realtime architecture
- [LiveKit Ready Guard](mem://tech/live-system/livekit-ready-guard) — Mandatory useLiveKitReady before lkRoom.on() to prevent null engine crash
- [Presence tracking](mem://tech/live-system/presence-tracking) — Viewer presence system
- [Newsletter generation constraints](mem://tech/marketing/newsletter-generation-constraints) — Single-pass review optimization
- [Newsletter generation resilience](mem://tech/marketing/newsletter-generation-resilience) — Retry and error handling
- [Newsletter real-time tracking](mem://tech/marketing/newsletter-real-time-tracking) — Realtime progress monitoring
- [Newsletter storage](mem://tech/marketing/newsletter-storage) — newsletter-images bucket
- [Newsletter auto-learning](mem://tech/marketing/newsletter-auto-learning) — agent_learning_log feedback
- [Newsletter send logic](mem://tech/marketing/newsletter-send-logic) — Email distribution processing
- [Campaign task sync](mem://tech/marketing/campaign-task-sync-logic) — Task sync for campaigns
- [Campaign reminders](mem://tech/marketing/campaign-reminders-scheduling) — pg_cron scheduling
- [Payment proxy architecture](mem://tech/payments/proxy-architecture) — Coinsbuy and Stripe proxy pattern
- [BCE overview](mem://features/bce-closing-engine/overview) — Sales copilot system
- [Experience module](mem://features/experience-module/overview) — IB Bullfy Experience tools
- [CRM core](mem://features/lead-system/crm-core) — Lead system Kanban
- [Lead scoring](mem://features/lead-system/scoring) — Opportunity score calculation
- [Lead roles](mem://features/lead-system/roles) — Lead management permissions
- [Lead assignment](mem://features/lead-system/assignment-engine) — Lead distribution engine
- [Lead duplicates](mem://features/lead-system/duplicate-detection) — Cross-portal duplicate detection
- [Lead deletion](mem://features/lead-system/lead-deletion) — Master Admin only deletion
- [Lead integration](mem://features/lead-system/integration-architecture) — Portal to lead system flow
- [Voice integration](mem://features/lead-system/voice-integration) — Click-to-Call config
- [Voice recording](mem://features/lead-system/voice-recording-playback) — Recording playback security
- [Smart Call AI](mem://features/lead-system/smart-call-ai-logic) — AI call analysis system
- [IB prospect pipeline](mem://features/lead-system/ib-prospect-pipeline) — BD prospect Kanban
- [Click to call](mem://features/lead-system/click-to-call) — Twilio browser calling
- [Smart Call AI details](mem://features/lead-system/smart-call-ai) — Call analysis details
- [Live engagement](mem://features/live-system/engagement-and-monetization) — CTAs, ads, tickers
- [Live co-streaming](mem://features/live-system/co-streaming) — Co-stream management
- [Live recording](mem://features/live-system/recording) — Client-side recording
- [Live transcription](mem://features/live-system/transcription-control) — Transcription classification
- [Live stream analysis](mem://features/live-system/stream-analysis-ai-logic) — Smart Stream Analysis
- [Live YouTube](mem://features/live-system/youtube-streaming) — YouTube re-streaming
- [Live guest access](mem://features/live-system/guest-access) — External guest system
- [Live fake streams](mem://features/live-system/fake-live) — Simulated streaming
- [Live virtual backgrounds](mem://features/live-system/virtual-backgrounds) — Host backgrounds
- [Live monetization rules](mem://features/live-system/monetization-rules) — $1/lead full-stream rule + bonuses + unified earnings source
- [Partner portal system](mem://features/partner-portal/system-architecture) — Multi-tenant platform
- [Partner portal branding](mem://features/partner-portal/branding) — Visual customization
- [Partner portal tiers](mem://features/partner-portal/tier-access-control) — Tier-based access
- [Partner portal academy](mem://features/partner-portal/academy-system) — E-learning platform
- [Partner portal academy business](mem://features/partner-portal/academy-system-business-logic) — Academy business rules
- [Partner portal admin UX](mem://features/partner-portal/admin-ux) — Admin interface design
- [Partner portal live](mem://features/partner-portal/live-integration) — Live streaming in portals
- [Partner portal direct stream](mem://features/partner-portal/direct-stream-access) — Direct stream access
- [Partner portal wallet](mem://features/partner-portal/e-wallet) — Earnings wallet
- [Partner portal password reset](mem://features/partner-portal/password-reset) — Custom reset flow
- [Partner portal anonymous RLS](mem://features/partner-portal/registro-anonimo-rls) — Anonymous registration RLS
- [Partner portal eCommerce](mem://features/partner-portal/ecommerce-system) — Digital products marketplace with cart, checkout, ledger, splits, commissions
- [Partner portal MLM](mem://features/partner-portal/mlm-system) — Sistema MLM uni-nivel modular con eWallet interna, comisiones pending/available y retiros USDT TRC20 (Coinsbuy)
- [Newsletter studio](mem://features/marketing/newsletter-studio) — Multi-agent automation
- [Newsletter agent profiles](mem://features/marketing/newsletter-agent-profiles) — 9-agent team CVs
- [Newsletter copywriter styles](mem://features/marketing/newsletter-copywriter-styles) — Sofía (technical) vs Valentina (storyteller)
- [Newsletter results landing](mem://features/marketing/newsletter-results-landing) — Interactive results page
- [Newsletter legal footer](mem://features/marketing/newsletter-legal-footer) — Mandatory legal footer
- [Newsletter breaking news](mem://features/marketing/newsletter-breaking-news) — Automated financial monitoring
- [Brain analysis history](mem://features/marketing/brain-analysis-history) — Multi-agent analysis log
- [Video studio](mem://features/marketing/video-studio-logic) — AI video clip pipeline
- [Auto-clip trigger](mem://features/marketing/auto-clip-trigger-logic) — Post-stream auto-clips
- [IB campaign system](mem://features/marketing/ib-campaign-system-logic) — Campaign notification system
- [Operations requests](mem://features/operations/general-requests-logic) — General ops tickets
- [Operations efficiency](mem://features/operations/efficiency-report) — Ops performance report
- [Operations visibility](mem://features/operations/request-visibility) — Request detail viewing
- [Dealing department](mem://features/dealing-department) — Dealing role and ops request routing
- [Admin direct structurer](mem://features/admin/direct-structurer-logic) — Direct structuring module
- [IB hierarchy](mem://features/ib-externo/hierarchy-logic) — Recursive Sub-IB structure
- [MT5 integration](mem://features/mt5/api-integration) — MT5 API connection
- [Reports branding](mem://features/reports/branding-design-logic) — PDF report aesthetics
- [OTP verification](mem://features/security/otp-verification-system-logic) — OTP email/SMS system
- [Payment gateway system](mem://features/payments/gateway-system) — Dual crypto/card payments
- [NowPayments integration](mem://features/payments/nowpayments-integration) — Crypto gateway with sandbox/live switcher and HMAC IPN webhook
- [Bullfy legal](mem://features/bullfy-legal) — Legal compliance
- [Google Calendar integration](mem://features/google-calendar-integration) — OAuth Internal para @bullfy.com + .ics email para externos. Tab en /settings.
- [Regression safety](mem://preferences/regression-safety) — Antes de cualquier cambio, verificar que no rompa funcionalidad existente
- [Trading Room Subscriptions Flow](mem://features/payments/trading-room-subscriptions-flow) — NowPayments 30-day cycle, multi-plan, day-25 renewal, day-30 expiration cron
- [QA Karlos Tournament Audit](mem://qa/karlos-tournament-audit) — PRs #2-#6 publicados, #7-#8 en curso. Invariantes no revertir: requireServiceRole, .neq finished, upsert clan-rankings, authLoading guards

## Backlog (PENDIENTES)
