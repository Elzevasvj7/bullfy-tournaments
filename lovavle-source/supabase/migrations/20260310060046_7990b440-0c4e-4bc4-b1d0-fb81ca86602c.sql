
-- Allow BDs to insert IBs (they set created_by = their own id)
CREATE POLICY "BDs can insert IBs" ON public.ibs
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Allow BDs to insert sub_ibs for their own IBs
CREATE POLICY "BDs can insert sub_ibs" ON public.sub_ibs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.ibs WHERE id = ib_id AND created_by = auth.uid())
  );

-- Allow BDs to insert spread config for their own IBs
CREATE POLICY "BDs can insert spread config" ON public.ib_spread_config
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.ibs WHERE id = ib_id AND created_by = auth.uid())
  );

-- Allow BDs to insert CPA config for their own IBs
CREATE POLICY "BDs can insert CPA config" ON public.ib_cpa_config
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.ibs WHERE id = ib_id AND created_by = auth.uid())
  );

-- Allow BDs to insert CPA distribution for their own IBs
CREATE POLICY "BDs can insert CPA distribution" ON public.ib_cpa_distribution
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.ibs WHERE id = ib_id AND created_by = auth.uid())
  );

-- Allow BDs to insert hybrid config for their own IBs
CREATE POLICY "BDs can insert hybrid config" ON public.ib_hybrid_config
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.ibs WHERE id = ib_id AND created_by = auth.uid())
  );

-- Allow BDs to insert propfirm config for their own IBs
CREATE POLICY "BDs can insert propfirm config" ON public.ib_propfirm_config
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.ibs WHERE id = ib_id AND created_by = auth.uid())
  );

-- Allow BDs to read sub_ibs of their own IBs
CREATE POLICY "BDs can read own sub_ibs" ON public.sub_ibs
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.ibs WHERE id = ib_id AND created_by = auth.uid())
  );
