-- ============================================================================
-- Club Financiero — Ajuste de tonalidad del verde (menos saturado)
-- ============================================================================
-- El 2026-05-28 Karlos pidió bajar la intensidad del verde fluorescente
-- (`#39FF14` saturación 100%) que se usaba como `primary_color` y
-- `accent_color` del portal Club Financiero. Se consideraba demasiado
-- chillón para un IB del rubro financiero. Se eligió la opción "equilibrado"
-- de 4 tonalidades propuestas: `#33A23F` (HSL 111 52% 42%), un verde
-- natural con saturación reducida pero conservando el tono original.
--
-- IMPORTANTE — sincronía repo ↔ producción:
-- El UPDATE fue ejecutado primero en producción vía SQL Editor de Lovable
-- Cloud (decisión iterativa para validar visualmente la tonalidad antes
-- de commitearla en migración). Esta migración ahora regulariza el repo
-- como fuente de verdad. En el entorno de producción la migración es
-- no-op (los valores ya son los mismos que se setean acá). En cualquier
-- entorno nuevo o fresh, sí aplica el cambio para mantener consistencia.
--
-- Si Club Financiero cambia tonalidad en el futuro:
--   - Decisión rápida iterativa: SQL Editor, después regularizar con
--     migración nueva (este mismo patrón).
--   - Decisión planificada: migración directa, evita drift.
-- ============================================================================

UPDATE public.partner_portal_branding
SET
  primary_color = '#33A23F',
  accent_color  = '#33A23F'
WHERE portal_id = '20cc4b20-d293-47a7-b08b-4d21ecce4f37';
