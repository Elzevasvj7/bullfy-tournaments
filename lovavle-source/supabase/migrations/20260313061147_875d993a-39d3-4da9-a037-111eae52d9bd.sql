
-- Table for ops checklist items per IB
CREATE TABLE public.ops_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ops_queue_id uuid NOT NULL REFERENCES public.ops_queue(id) ON DELETE CASCADE,
  ib_id uuid NOT NULL REFERENCES public.ibs(id) ON DELETE CASCADE,
  label text NOT NULL,
  checked boolean NOT NULL DEFAULT false,
  checked_by uuid REFERENCES auth.users(id),
  checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ops_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ops and admins can manage checklist" ON public.ops_checklist
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'operaciones'::app_role) OR 
    has_role(auth.uid(), 'admin_operaciones'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'global_admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'operaciones'::app_role) OR 
    has_role(auth.uid(), 'admin_operaciones'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'global_admin'::app_role)
  );
