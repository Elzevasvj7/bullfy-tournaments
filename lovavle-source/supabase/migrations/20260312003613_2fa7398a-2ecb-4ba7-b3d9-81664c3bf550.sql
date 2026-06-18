
-- Add new roles to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operaciones';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_operaciones';
