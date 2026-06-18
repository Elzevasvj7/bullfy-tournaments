
-- 1. academy_certificates: restrict INSERT to matching partner_user_id
DROP POLICY IF EXISTS "Anon can insert certificates" ON public.academy_certificates;
CREATE POLICY "Partner users can insert own certificates"
ON public.academy_certificates
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.partner_users pu
    WHERE pu.id = academy_certificates.partner_user_id
  )
);

-- 2. academy_progress: restrict INSERT and UPDATE to own records
DROP POLICY IF EXISTS "Anon can insert progress" ON public.academy_progress;
CREATE POLICY "Users can insert own progress"
ON public.academy_progress
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.partner_users pu
    WHERE pu.id = academy_progress.partner_user_id
  )
);

DROP POLICY IF EXISTS "Anon can update progress" ON public.academy_progress;
CREATE POLICY "Users can update own progress"
ON public.academy_progress
FOR UPDATE
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.partner_users pu
    WHERE pu.id = academy_progress.partner_user_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.partner_users pu
    WHERE pu.id = academy_progress.partner_user_id
  )
);

-- 3. live_overlay_assets: restrict DELETE to owner only
DROP POLICY IF EXISTS "Authenticated can delete own overlay assets" ON public.live_overlay_assets;
CREATE POLICY "Users can delete own overlay assets"
ON public.live_overlay_assets
FOR DELETE
TO authenticated
USING (uploaded_by = auth.uid()::text);

-- 4. Fix search_path on email queue functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
