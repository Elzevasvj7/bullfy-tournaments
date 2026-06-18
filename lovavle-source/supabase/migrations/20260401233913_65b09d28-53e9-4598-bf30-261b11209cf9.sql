
-- Add is_public column
ALTER TABLE public.live_invite_codes
ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;

-- Drop old anon policy and replace with one that allows public codes
DROP POLICY IF EXISTS "Anon can read valid codes" ON public.live_invite_codes;

CREATE POLICY "Anon can read valid codes"
ON public.live_invite_codes FOR SELECT
TO anon
USING (
  (expires_at > now())
  AND (
    is_public = true
    OR used_at IS NULL
  )
);
