
CREATE POLICY "Anon can read own partner_user by id"
  ON public.partner_users FOR SELECT TO anon
  USING (true);
