
-- Table for waiting room templates (managed by Marketing)
CREATE TABLE public.live_waiting_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  bg_path text,
  bg_type text NOT NULL DEFAULT 'image' CHECK (bg_type IN ('image', 'video')),
  title text NOT NULL DEFAULT 'Comenzamos pronto...',
  subtitle text,
  show_countdown boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_waiting_templates ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read templates
CREATE POLICY "Authenticated can view templates"
  ON public.live_waiting_templates FOR SELECT
  TO authenticated USING (true);

-- Only admin/marketing can manage
CREATE POLICY "Admin/Marketing can insert templates"
  ON public.live_waiting_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'global_admin') OR
    public.has_role(auth.uid(), 'marketing')
  );

CREATE POLICY "Admin/Marketing can update templates"
  ON public.live_waiting_templates FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'global_admin') OR
    public.has_role(auth.uid(), 'marketing')
  );

CREATE POLICY "Admin/Marketing can delete templates"
  ON public.live_waiting_templates FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'global_admin') OR
    public.has_role(auth.uid(), 'marketing')
  );

-- Trigger for updated_at
CREATE TRIGGER update_live_waiting_templates_updated_at
  BEFORE UPDATE ON public.live_waiting_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure only one default template at a time
CREATE OR REPLACE FUNCTION public.ensure_single_default_waiting_template()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.live_waiting_templates
    SET is_default = false
    WHERE id <> NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_single_default_waiting_template
  BEFORE INSERT OR UPDATE ON public.live_waiting_templates
  FOR EACH ROW EXECUTE FUNCTION public.ensure_single_default_waiting_template();

-- Add waiting room columns to live_rooms
ALTER TABLE public.live_rooms
  ADD COLUMN waiting_mode text NOT NULL DEFAULT 'template',
  ADD COLUMN waiting_template_id uuid REFERENCES public.live_waiting_templates(id) ON DELETE SET NULL,
  ADD COLUMN waiting_bg_path text,
  ADD COLUMN waiting_bg_type text DEFAULT 'image',
  ADD COLUMN waiting_title text,
  ADD COLUMN waiting_subtitle text,
  ADD COLUMN waiting_countdown_to timestamptz;
