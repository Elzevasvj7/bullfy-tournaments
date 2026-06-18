
-- Users can only see default backgrounds + their own
CREATE POLICY "Users can read own or default backgrounds"
ON public.live_virtual_backgrounds
FOR SELECT
TO authenticated
USING (is_default = true OR uploaded_by = auth.uid());

-- Users can only insert backgrounds assigned to themselves
CREATE POLICY "Users can insert own backgrounds"
ON public.live_virtual_backgrounds
FOR INSERT
TO authenticated
WITH CHECK (uploaded_by = auth.uid());

-- Users can only delete their own non-default backgrounds
CREATE POLICY "Users can delete own backgrounds"
ON public.live_virtual_backgrounds
FOR DELETE
TO authenticated
USING (uploaded_by = auth.uid() AND is_default = false);

-- Admins can manage all
CREATE POLICY "Admins can manage all backgrounds"
ON public.live_virtual_backgrounds
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));
