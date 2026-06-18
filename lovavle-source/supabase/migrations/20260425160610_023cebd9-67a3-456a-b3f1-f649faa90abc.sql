CREATE OR REPLACE FUNCTION public.save_portal_mlm_settings(
  _portal_id uuid,
  _enabled boolean,
  _active_levels integer,
  _mlm_pool_percentage numeric,
  _refund_window_days integer,
  _orphan_policy text,
  _commission_mode text,
  _business_partners_enabled boolean,
  _levels jsonb DEFAULT '[]'::jsonb
)
RETURNS public.portal_mlm_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _saved public.portal_mlm_config%ROWTYPE;
  _level jsonb;
  _level_total numeric := 0;
  _level_number integer;
  _percentage numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT (public.is_global_admin() OR public.is_portal_owner(_portal_id)) THEN
    RAISE EXCEPTION 'No tienes permiso para administrar este portal';
  END IF;

  IF _active_levels < 1 OR _active_levels > 10 THEN
    RAISE EXCEPTION 'Los niveles activos deben estar entre 1 y 10';
  END IF;

  IF _refund_window_days < 1 OR _refund_window_days > 30 THEN
    RAISE EXCEPTION 'El refund window debe estar entre 1 y 30 días';
  END IF;

  IF _mlm_pool_percentage < 0 OR _mlm_pool_percentage > 100 THEN
    RAISE EXCEPTION 'El pool MLM debe estar entre 0%% y 100%%';
  END IF;

  IF _orphan_policy NOT IN ('portal_owner', 'platform') THEN
    RAISE EXCEPTION 'Política de huérfanos inválida';
  END IF;

  IF _commission_mode NOT IN ('pool', 'multi_product') THEN
    RAISE EXCEPTION 'Modo de comisión inválido';
  END IF;

  IF _commission_mode = 'pool' THEN
    IF jsonb_typeof(COALESCE(_levels, '[]'::jsonb)) <> 'array' THEN
      RAISE EXCEPTION 'Los niveles MLM deben enviarse como lista';
    END IF;

    FOR _level IN SELECT * FROM jsonb_array_elements(COALESCE(_levels, '[]'::jsonb))
    LOOP
      _level_number := (_level->>'level_number')::integer;
      _percentage := (_level->>'percentage')::numeric;

      IF _level_number < 1 OR _level_number > 10 THEN
        RAISE EXCEPTION 'Cada nivel debe estar entre 1 y 10';
      END IF;

      IF _percentage < 0 OR _percentage > 100 THEN
        RAISE EXCEPTION 'Cada porcentaje debe estar entre 0%% y 100%%';
      END IF;

      _level_total := _level_total + _percentage;
    END LOOP;

    IF _level_total > 100 THEN
      RAISE EXCEPTION 'La suma de porcentajes MLM no puede exceder 100%%';
    END IF;
  END IF;

  INSERT INTO public.portal_mlm_config (
    portal_id,
    enabled,
    active_levels,
    mlm_pool_percentage,
    refund_window_days,
    orphan_policy,
    commission_mode,
    business_partners_enabled
  ) VALUES (
    _portal_id,
    _enabled,
    _active_levels,
    _mlm_pool_percentage,
    _refund_window_days,
    _orphan_policy,
    _commission_mode,
    _business_partners_enabled
  )
  ON CONFLICT (portal_id) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    active_levels = EXCLUDED.active_levels,
    mlm_pool_percentage = EXCLUDED.mlm_pool_percentage,
    refund_window_days = EXCLUDED.refund_window_days,
    orphan_policy = EXCLUDED.orphan_policy,
    commission_mode = EXCLUDED.commission_mode,
    business_partners_enabled = EXCLUDED.business_partners_enabled,
    updated_at = now()
  RETURNING * INTO _saved;

  IF _commission_mode = 'pool' THEN
    DELETE FROM public.portal_mlm_levels WHERE portal_id = _portal_id;

    FOR _level IN SELECT * FROM jsonb_array_elements(COALESCE(_levels, '[]'::jsonb))
    LOOP
      INSERT INTO public.portal_mlm_levels (portal_id, level_number, percentage)
      VALUES (
        _portal_id,
        (_level->>'level_number')::integer,
        (_level->>'percentage')::numeric
      );
    END LOOP;
  END IF;

  RETURN _saved;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_portal_mlm_settings(uuid, boolean, integer, numeric, integer, text, text, boolean, jsonb) TO authenticated;