
CREATE TABLE public.manual_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL DEFAULT '',
  icon TEXT DEFAULT 'BookOpen',
  display_order INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  is_new BOOLEAN DEFAULT false,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.manual_sections ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read
CREATE POLICY "Anyone authenticated can read manual"
  ON public.manual_sections FOR SELECT TO authenticated
  USING (true);

-- Only admins can manage
CREATE POLICY "Admins can manage manual sections"
  ON public.manual_sections FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));
