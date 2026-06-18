
ALTER TABLE public.ib_external_requests 
ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'sub_ib';

CREATE TABLE public.ib_portal_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  image_url text,
  cta_text text,
  cta_url text,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.ib_portal_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active promotions"
  ON public.ib_portal_promotions FOR SELECT
  TO authenticated
  USING (active = true);

CREATE POLICY "Admins can manage promotions"
  ON public.ib_portal_promotions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));

CREATE TRIGGER update_promotions_updated_at
  BEFORE UPDATE ON public.ib_portal_promotions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
