
-- Table to track BD reassignment history for IBs
CREATE TABLE public.ib_bd_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ib_id uuid NOT NULL REFERENCES public.ibs(id) ON DELETE CASCADE,
  bd_anterior_id uuid,
  bd_anterior_nombre text NOT NULL,
  bd_nuevo_id uuid,
  bd_nuevo_nombre text NOT NULL,
  reasignado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ib_bd_history ENABLE ROW LEVEL SECURITY;

-- Admins can manage history
CREATE POLICY "Admins can manage bd history"
  ON public.ib_bd_history FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));

-- Authenticated can read
CREATE POLICY "Authenticated can read bd history"
  ON public.ib_bd_history FOR SELECT
  TO authenticated
  USING (true);
