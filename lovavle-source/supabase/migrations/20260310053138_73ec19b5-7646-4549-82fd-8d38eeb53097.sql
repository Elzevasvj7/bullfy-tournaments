
-- Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  correo text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS: users can read their own profile
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Admins/global_admins can read all profiles
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin'));

-- Admins can update profiles (approve/reject)
CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'global_admin') OR public.has_role(auth.uid(), 'admin'));

-- Allow insert during signup (user inserts own profile)
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Add created_by to ibs table to track which BD created the IB
ALTER TABLE public.ibs ADD COLUMN created_by uuid REFERENCES auth.users(id);

-- Update ibs RLS: BDs can only see their own IBs
CREATE POLICY "BDs can manage own IBs" ON public.ibs
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'bd') AND created_by = auth.uid()
  );

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, correo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
    NEW.email
  );
  -- Auto-assign BD role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'bd');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
