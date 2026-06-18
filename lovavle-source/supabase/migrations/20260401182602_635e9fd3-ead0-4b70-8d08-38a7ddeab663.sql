-- Portal owner can manage modules of their courses
CREATE POLICY "Portal owner can manage their modules"
ON public.academy_modules
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.academy_courses ac
    JOIN public.partner_portals pp ON pp.id = ac.portal_id
    JOIN public.profiles p ON p.ib_id = pp.ib_id
    WHERE ac.id = academy_modules.course_id
    AND p.id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.academy_courses ac
    JOIN public.partner_portals pp ON pp.id = ac.portal_id
    JOIN public.profiles p ON p.ib_id = pp.ib_id
    WHERE ac.id = academy_modules.course_id
    AND p.id = auth.uid()
  )
);

-- Portal owner can manage lessons of their courses
CREATE POLICY "Portal owner can manage their lessons"
ON public.academy_lessons
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.academy_modules am
    JOIN public.academy_courses ac ON ac.id = am.course_id
    JOIN public.partner_portals pp ON pp.id = ac.portal_id
    JOIN public.profiles p ON p.ib_id = pp.ib_id
    WHERE am.id = academy_lessons.module_id
    AND p.id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.academy_modules am
    JOIN public.academy_courses ac ON ac.id = am.course_id
    JOIN public.partner_portals pp ON pp.id = ac.portal_id
    JOIN public.profiles p ON p.ib_id = pp.ib_id
    WHERE am.id = academy_lessons.module_id
    AND p.id = auth.uid()
  )
);

-- Portal owner can manage enrollments for their courses
CREATE POLICY "Portal owner can manage their enrollments"
ON public.academy_enrollments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.academy_courses ac
    JOIN public.partner_portals pp ON pp.id = ac.portal_id
    JOIN public.profiles p ON p.ib_id = pp.ib_id
    WHERE ac.id = academy_enrollments.course_id
    AND p.id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.academy_courses ac
    JOIN public.partner_portals pp ON pp.id = ac.portal_id
    JOIN public.profiles p ON p.ib_id = pp.ib_id
    WHERE ac.id = academy_enrollments.course_id
    AND p.id = auth.uid()
  )
);