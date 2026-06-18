-- Allow BDs to insert reports for their own IBs
CREATE POLICY "BDs can insert reports"
ON public.reports
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM ibs
    WHERE ibs.id = reports.ib_id
    AND ibs.created_by = auth.uid()
  )
);