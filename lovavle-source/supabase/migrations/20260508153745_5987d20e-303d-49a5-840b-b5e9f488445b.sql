-- 1. Add is_won to pipeline stages
ALTER TABLE public.lead_pipeline_stages
  ADD COLUMN IF NOT EXISTS is_won boolean NOT NULL DEFAULT false;

UPDATE public.lead_pipeline_stages
  SET is_won = true
  WHERE name ILIKE 'Cerrado Ganado' OR name ILIKE '%ganado%';

-- 2. Add closed_by / closed_at to stream_leads
ALTER TABLE public.stream_leads
  ADD COLUMN IF NOT EXISTS closed_by uuid,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_stream_leads_closed_by ON public.stream_leads(closed_by);

-- 3. Auto-claim function: assigns lead to first ventas/admin_ventas user that acts on it
CREATE OR REPLACE FUNCTION public.auto_claim_stream_lead(_lead_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL OR _lead_id IS NULL THEN RETURN; END IF;

  -- Only auto-claim if user has ventas/admin_ventas role
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('ventas','admin_ventas')
  ) THEN
    RETURN;
  END IF;

  -- Atomic claim: only if currently unassigned
  UPDATE public.stream_leads
    SET assigned_to = _user_id,
        assigned_by = _user_id,
        assigned_at = now()
    WHERE id = _lead_id
      AND assigned_to IS NULL;

  -- Log auto-claim activity if the update happened
  IF FOUND THEN
    INSERT INTO public.lead_activities (lead_id, performed_by, activity_type, details)
    VALUES (_lead_id, _user_id, 'auto_claimed', 'Lead auto-asignado tras primera acción');
  END IF;
END;
$$;

-- 4. Trigger on lead_calls
CREATE OR REPLACE FUNCTION public.trg_auto_claim_on_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.auto_claim_stream_lead(NEW.lead_id, NEW.agent_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_claim_on_call ON public.lead_calls;
CREATE TRIGGER auto_claim_on_call
  AFTER INSERT ON public.lead_calls
  FOR EACH ROW EXECUTE FUNCTION public.trg_auto_claim_on_call();

-- 5. Trigger on lead_whatsapp_messages (only outbound from agent)
CREATE OR REPLACE FUNCTION public.trg_auto_claim_on_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _sender uuid;
BEGIN
  -- Try common sender column names; fallback to auth.uid()
  BEGIN _sender := NEW.sent_by; EXCEPTION WHEN OTHERS THEN _sender := NULL; END;
  IF _sender IS NULL THEN _sender := auth.uid(); END IF;
  PERFORM public.auto_claim_stream_lead(NEW.lead_id, _sender);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_claim_on_whatsapp ON public.lead_whatsapp_messages;
CREATE TRIGGER auto_claim_on_whatsapp
  AFTER INSERT ON public.lead_whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_auto_claim_on_whatsapp();

-- 6. Trigger on lead_activities (covers stage changes, notes, etc.)
CREATE OR REPLACE FUNCTION public.trg_auto_claim_on_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Avoid recursion: skip the auto_claimed activity itself
  IF NEW.activity_type = 'auto_claimed' THEN RETURN NEW; END IF;
  PERFORM public.auto_claim_stream_lead(NEW.lead_id, NEW.performed_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_claim_on_activity ON public.lead_activities;
CREATE TRIGGER auto_claim_on_activity
  AFTER INSERT ON public.lead_activities
  FOR EACH ROW EXECUTE FUNCTION public.trg_auto_claim_on_activity();

-- 7. Snapshot closed_by when stage moves to a won stage
CREATE OR REPLACE FUNCTION public.trg_snapshot_close_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _is_won boolean;
BEGIN
  IF NEW.pipeline_stage_id IS DISTINCT FROM OLD.pipeline_stage_id AND NEW.pipeline_stage_id IS NOT NULL THEN
    SELECT is_won INTO _is_won FROM public.lead_pipeline_stages WHERE id = NEW.pipeline_stage_id;
    IF COALESCE(_is_won, false) = true AND NEW.closed_by IS NULL THEN
      NEW.closed_by := NEW.assigned_to;
      NEW.closed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS snapshot_close_attribution ON public.stream_leads;
CREATE TRIGGER snapshot_close_attribution
  BEFORE UPDATE ON public.stream_leads
  FOR EACH ROW EXECUTE FUNCTION public.trg_snapshot_close_attribution();

-- 8. Inactivity release: cron daily releases unclosed leads with no activity > 7 days
CREATE OR REPLACE FUNCTION public.release_inactive_leads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.stream_leads sl
    SET assigned_to = NULL,
        assigned_by = NULL,
        assigned_at = NULL
  WHERE sl.assigned_to IS NOT NULL
    AND sl.closed_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.lead_pipeline_stages s
      WHERE s.id = sl.pipeline_stage_id AND (s.is_closed = true OR s.is_won = true)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.lead_activities la
      WHERE la.lead_id = sl.id AND la.created_at > now() - interval '7 days'
    )
    AND COALESCE(sl.assigned_at, sl.updated_at) < now() - interval '7 days';
END;
$$;

-- Schedule daily at 03:00 UTC
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'release_inactive_leads_daily') THEN
    PERFORM cron.schedule('release_inactive_leads_daily', '0 3 * * *', 'SELECT public.release_inactive_leads();');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
