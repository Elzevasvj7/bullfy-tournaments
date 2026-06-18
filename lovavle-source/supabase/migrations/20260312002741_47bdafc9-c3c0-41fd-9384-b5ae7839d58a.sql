
-- 1. Create audit_log table
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text NOT NULL,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_audit_log_table_record ON public.audit_log (table_name, record_id);
CREATE INDEX idx_audit_log_user ON public.audit_log (user_id);
CREATE INDEX idx_audit_log_created ON public.audit_log (created_at DESC);

-- 2. Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins and global_admins can read audit logs
CREATE POLICY "Admins can read audit logs"
ON public.audit_log FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'global_admin'::app_role)
);

-- System can insert (via trigger with SECURITY DEFINER)
CREATE POLICY "System can insert audit logs"
ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (true);

-- 3. Generic audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _record_id text;
  _old jsonb;
  _new jsonb;
  _changed text[];
  _key text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _record_id := OLD.id::text;
    _old := to_jsonb(OLD);
    _new := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    _record_id := NEW.id::text;
    _old := NULL;
    _new := to_jsonb(NEW);
  ELSE
    _record_id := NEW.id::text;
    _old := to_jsonb(OLD);
    _new := to_jsonb(NEW);
    FOR _key IN SELECT jsonb_object_keys(_new)
    LOOP
      IF _old->_key IS DISTINCT FROM _new->_key THEN
        _changed := array_append(_changed, _key);
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.audit_log (table_name, record_id, action, old_data, new_data, changed_fields, user_id)
  VALUES (TG_TABLE_NAME, _record_id, TG_OP, _old, _new, _changed, auth.uid());

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Attach triggers to main tables
CREATE TRIGGER audit_ibs
  AFTER INSERT OR UPDATE OR DELETE ON public.ibs
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_reports
  AFTER INSERT OR UPDATE OR DELETE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_sub_ibs
  AFTER INSERT OR UPDATE OR DELETE ON public.sub_ibs
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_documents
  AFTER INSERT OR UPDATE OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_ib_spread_config
  AFTER INSERT OR UPDATE OR DELETE ON public.ib_spread_config
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_ib_cpa_config
  AFTER INSERT OR UPDATE OR DELETE ON public.ib_cpa_config
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_ib_cpa_distribution
  AFTER INSERT OR UPDATE OR DELETE ON public.ib_cpa_distribution
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_ib_hybrid_config
  AFTER INSERT OR UPDATE OR DELETE ON public.ib_hybrid_config
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_ib_propfirm_config
  AFTER INSERT OR UPDATE OR DELETE ON public.ib_propfirm_config
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
