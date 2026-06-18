
-- Add audit triggers to ops_queue and ops_requests tables
CREATE TRIGGER audit_ops_queue
  AFTER INSERT OR UPDATE OR DELETE ON public.ops_queue
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_ops_requests
  AFTER INSERT OR UPDATE OR DELETE ON public.ops_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
