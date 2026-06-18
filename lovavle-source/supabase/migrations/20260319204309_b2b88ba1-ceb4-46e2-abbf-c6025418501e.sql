-- Allow admin_bd users to create Sub IB records regardless of IB ownership
DROP POLICY IF EXISTS "BDs can insert sub_ibs" ON public.sub_ibs;

CREATE POLICY "BDs and Admin BD can insert sub_ibs"
ON public.sub_ibs
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin_bd'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.ibs
    WHERE ibs.id = sub_ibs.ib_id
      AND ibs.created_by = auth.uid()
  )
);