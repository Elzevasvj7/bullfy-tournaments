-- Drop existing problematic NULLS NOT DISTINCT constraints
ALTER TABLE public.live_feature_access
  DROP CONSTRAINT IF EXISTS live_feature_access_unique_role,
  DROP CONSTRAINT IF EXISTS live_feature_access_unique_user;

-- Recreate as partial unique indexes (proper way to enforce uniqueness on nullable cols)
CREATE UNIQUE INDEX live_feature_access_unique_role
  ON public.live_feature_access (role, feature_key)
  WHERE user_id IS NULL AND role IS NOT NULL;

CREATE UNIQUE INDEX live_feature_access_unique_user
  ON public.live_feature_access (user_id, feature_key)
  WHERE role IS NULL AND user_id IS NOT NULL;