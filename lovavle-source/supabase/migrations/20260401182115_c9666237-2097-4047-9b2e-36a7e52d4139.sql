-- Allow portal owner (IB) to manage their own courses
CREATE POLICY "Portal owner can manage their courses"
ON public.academy_courses
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.partner_portals pp
    JOIN public.profiles p ON p.ib_id = pp.ib_id
    WHERE pp.id = academy_courses.portal_id
    AND p.id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.partner_portals pp
    JOIN public.profiles p ON p.ib_id = pp.ib_id
    WHERE pp.id = academy_courses.portal_id
    AND p.id = auth.uid()
  )
);