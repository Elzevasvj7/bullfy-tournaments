
-- Operations queue table to track IB deals through ops workflow
CREATE TABLE public.ops_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ib_id uuid NOT NULL REFERENCES public.ibs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'nuevo',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  taken_at timestamptz,
  completed_at timestamptz,
  notes text,
  UNIQUE(ib_id)
);

-- Enable RLS
ALTER TABLE public.ops_queue ENABLE ROW LEVEL SECURITY;

-- Operaciones + Admins can manage
CREATE POLICY "Ops and admins can manage queue"
  ON public.ops_queue FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'operaciones') OR 
    has_role(auth.uid(), 'admin_operaciones') OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'global_admin')
  )
  WITH CHECK (
    has_role(auth.uid(), 'operaciones') OR 
    has_role(auth.uid(), 'admin_operaciones') OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'global_admin')
  );

-- BDs can read queue entries for their own IBs
CREATE POLICY "BDs can read own queue entries"
  ON public.ops_queue FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ibs WHERE ibs.id = ops_queue.ib_id AND ibs.created_by = auth.uid()
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ops_queue;

-- Trigger: auto-create ops_queue entry when IB is submitted (status = 'submitted')
CREATE OR REPLACE FUNCTION public.auto_create_ops_queue()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- On insert with status 'submitted' or on update when status changes to 'submitted'
  IF NEW.status = 'submitted' THEN
    INSERT INTO public.ops_queue (ib_id, status)
    VALUES (NEW.id, 'nuevo')
    ON CONFLICT (ib_id) DO NOTHING;
    
    -- Notify ops team
    INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
    SELECT 
      ur.user_id,
      'ops_new_deal',
      'Nuevo Deal para configurar',
      'El IB ' || NEW.nombre_ib || ' (BD: ' || NEW.nombre_bd || ') requiere configuración.',
      NEW.id::text,
      'ops_queue'
    FROM public.user_roles ur
    WHERE ur.role IN ('operaciones', 'admin_operaciones');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_ops_queue
  AFTER INSERT OR UPDATE OF status ON public.ibs
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_ops_queue();

-- Audit trigger on ops_queue
CREATE TRIGGER trg_audit_ops_queue
  AFTER INSERT OR UPDATE OR DELETE ON public.ops_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_func();
