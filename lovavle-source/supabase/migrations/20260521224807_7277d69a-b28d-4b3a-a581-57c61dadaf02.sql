
ALTER TABLE public.tournament_users
  ADD COLUMN IF NOT EXISTS preferred_pose text NOT NULL DEFAULT 'idle';

CREATE TABLE IF NOT EXISTS public.tournament_user_poses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.tournament_users(id) ON DELETE CASCADE,
  pose_key text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, pose_key)
);

CREATE INDEX IF NOT EXISTS tournament_user_poses_user_idx
  ON public.tournament_user_poses(user_id);

ALTER TABLE public.tournament_user_poses ENABLE ROW LEVEL SECURITY;
