
-- Add 'global_admin' and 'bd' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'global_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'bd';
