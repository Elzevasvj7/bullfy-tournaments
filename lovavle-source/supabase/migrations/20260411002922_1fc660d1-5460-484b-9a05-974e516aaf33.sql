-- Add is_public_stream column to live_rooms
ALTER TABLE public.live_rooms ADD COLUMN is_public_stream boolean NOT NULL DEFAULT false;

-- Update calculate_stream_earnings to only apply for ib_externo hosts
CREATE OR REPLACE FUNCTION public.calculate_stream_earnings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _mon_enabled boolean;
  _global_config RECORD;
  _custom RECORD;
  _rate_lead numeric;
  _rate_bono_streams numeric;
  _rate_bono_views numeric;
  _rate_bono_interactions numeric;
  _rate_bono_votacion numeric;
  _umbral_streams int;
  _umbral_views int;
  _umbral_interactions int;
  _umbral_votacion numeric;
  _ended_at timestamptz;
  _valid_leads int;
  _stream_viewers int;
  _stream_interactions int;
  _stream_avg_rating numeric;
  _period_start date;
  _period_end date;
  _month_streams int;
  _month_viewers int;
  _month_leads int;
  _month_interactions int;
  _month_avg_rating numeric;
  _earnings_leads numeric;
  _earnings_bonuses numeric;
  _bonus_details jsonb;
  _is_ib_externo boolean;
BEGIN
  -- Only trigger when status changes to 'ended'
  IF NEW.status <> 'ended' OR OLD.status = 'ended' THEN
    RETURN NEW;
  END IF;

  -- MONETIZATION ONLY FOR IB EXTERNO ROLE
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = NEW.host_id AND role = 'ib_externo'
  ) INTO _is_ib_externo;

  IF NOT _is_ib_externo THEN
    RETURN NEW;
  END IF;

  _ended_at := COALESCE(NEW.ended_at, now());

  -- Check if host has monetization enabled
  SELECT enabled INTO _mon_enabled
  FROM public.live_streamer_monetization
  WHERE host_id = NEW.host_id;

  IF _mon_enabled IS NOT NULL AND _mon_enabled = false THEN
    RETURN NEW;
  END IF;

  -- Get global config
  SELECT * INTO _global_config
  FROM public.live_monetization_config
  WHERE active = true
  LIMIT 1;

  IF _global_config IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get custom rates (if any)
  SELECT * INTO _custom
  FROM public.live_streamer_monetization
  WHERE host_id = NEW.host_id;

  -- Determine applicable rates
  _rate_lead := COALESCE(_custom.custom_dolares_por_lead, _global_config.dolares_por_lead);
  _rate_bono_streams := COALESCE(_custom.custom_bono_streams_monto, _global_config.bono_streams_monto);
  _rate_bono_views := COALESCE(_custom.custom_bono_visualizaciones_monto, _global_config.bono_visualizaciones_monto);
  _rate_bono_interactions := COALESCE(_custom.custom_bono_interacciones_monto, _global_config.bono_interacciones_monto);
  _rate_bono_votacion := COALESCE(_custom.custom_bono_votacion_monto, _global_config.bono_votacion_monto);
  _umbral_streams := _global_config.bono_streams_umbral;
  _umbral_views := _global_config.bono_visualizaciones_umbral;
  _umbral_interactions := _global_config.bono_interacciones_umbral;
  _umbral_votacion := _global_config.bono_votacion_umbral;

  -- Count VALID leads
  SELECT count(DISTINCT COALESCE(vp.stream_lead_id::text, vp.correo)) INTO _valid_leads
  FROM public.live_viewer_presence vp
  WHERE vp.room_id = NEW.id
    AND (vp.stream_lead_id IS NOT NULL OR vp.correo IS NOT NULL)
    AND (
      vp.left_at IS NULL
      OR vp.left_at >= (_ended_at - interval '2 minutes')
    );

  -- Stream metrics
  SELECT count(DISTINCT id) INTO _stream_viewers
  FROM public.live_viewer_presence
  WHERE room_id = NEW.id;

  SELECT count(*) INTO _stream_interactions
  FROM public.live_reactions
  WHERE room_id = NEW.id;

  SELECT COALESCE(avg(rating), 0) INTO _stream_avg_rating
  FROM public.live_stream_votes
  WHERE room_id = NEW.id;

  -- Period = current calendar month
  _period_start := date_trunc('month', _ended_at)::date;
  _period_end := (date_trunc('month', _ended_at) + interval '1 month' - interval '1 day')::date;

  -- Accumulate monthly totals (including this stream)
  SELECT
    count(DISTINCT lr.id),
    COALESCE(sum(sub.viewers), 0) + _stream_viewers,
    COALESCE(sum(sub.leads), 0) + _valid_leads,
    COALESCE(sum(sub.interactions), 0) + _stream_interactions
  INTO _month_streams, _month_viewers, _month_leads, _month_interactions
  FROM public.live_rooms lr
  LEFT JOIN LATERAL (
    SELECT
      count(DISTINCT vp.id) as viewers,
      count(DISTINCT COALESCE(vp.stream_lead_id::text, vp.correo)) FILTER (
        WHERE (vp.stream_lead_id IS NOT NULL OR vp.correo IS NOT NULL)
        AND (vp.left_at IS NULL OR vp.left_at >= (lr.ended_at - interval '2 minutes'))
      ) as leads,
      (SELECT count(*) FROM public.live_reactions r WHERE r.room_id = lr.id) as interactions
    FROM public.live_viewer_presence vp
    WHERE vp.room_id = lr.id
  ) sub ON true
  WHERE lr.host_id = NEW.host_id
    AND lr.status = 'ended'
    AND lr.id <> NEW.id
    AND lr.ended_at >= _period_start::timestamptz
    AND lr.ended_at < (_period_end + 1)::timestamptz;

  _month_streams := _month_streams + 1;

  -- Monthly average rating
  SELECT COALESCE(avg(v.rating), 0) INTO _month_avg_rating
  FROM public.live_stream_votes v
  JOIN public.live_rooms lr ON lr.id = v.room_id
  WHERE lr.host_id = NEW.host_id
    AND lr.status = 'ended'
    AND lr.ended_at >= _period_start::timestamptz
    AND lr.ended_at < (_period_end + 1)::timestamptz;

  -- Calculate earnings
  _earnings_leads := _month_leads * _rate_lead;

  -- Calculate bonuses
  _bonus_details := '{}'::jsonb;
  _earnings_bonuses := 0;

  IF _month_streams >= _umbral_streams AND _umbral_streams > 0 THEN
    _earnings_bonuses := _earnings_bonuses + _rate_bono_streams;
    _bonus_details := _bonus_details || jsonb_build_object('streams', _rate_bono_streams);
  END IF;

  IF _month_viewers >= _umbral_views AND _umbral_views > 0 THEN
    _earnings_bonuses := _earnings_bonuses + _rate_bono_views;
    _bonus_details := _bonus_details || jsonb_build_object('visualizaciones', _rate_bono_views);
  END IF;

  IF _month_interactions >= _umbral_interactions AND _umbral_interactions > 0 THEN
    _earnings_bonuses := _earnings_bonuses + _rate_bono_interactions;
    _bonus_details := _bonus_details || jsonb_build_object('interacciones', _rate_bono_interactions);
  END IF;

  IF _month_avg_rating >= _umbral_votacion AND _umbral_votacion > 0 THEN
    _earnings_bonuses := _earnings_bonuses + _rate_bono_votacion;
    _bonus_details := _bonus_details || jsonb_build_object('votacion', _rate_bono_votacion);
  END IF;

  -- Upsert monthly earnings record
  INSERT INTO public.live_streamer_earnings (
    host_id, period_start, period_end,
    total_streams, total_viewers, total_leads, total_interactions, avg_rating,
    earnings_leads, earnings_bonuses, earnings_total,
    bonus_details, status
  ) VALUES (
    NEW.host_id, _period_start, _period_end,
    _month_streams, _month_viewers, _month_leads, _month_interactions, _month_avg_rating,
    _earnings_leads, _earnings_bonuses, _earnings_leads + _earnings_bonuses,
    _bonus_details, 'pending'
  )
  ON CONFLICT (host_id, period_start) DO UPDATE SET
    total_streams = EXCLUDED.total_streams,
    total_viewers = EXCLUDED.total_viewers,
    total_leads = EXCLUDED.total_leads,
    total_interactions = EXCLUDED.total_interactions,
    avg_rating = EXCLUDED.avg_rating,
    earnings_leads = EXCLUDED.earnings_leads,
    earnings_bonuses = EXCLUDED.earnings_bonuses,
    earnings_total = EXCLUDED.earnings_total,
    bonus_details = EXCLUDED.bonus_details,
    updated_at = now();

  RETURN NEW;
END;
$function$;