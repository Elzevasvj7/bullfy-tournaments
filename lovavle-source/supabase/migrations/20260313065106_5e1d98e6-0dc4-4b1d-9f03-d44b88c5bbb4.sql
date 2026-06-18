-- Drop old constraint and add updated one with all deal statuses
ALTER TABLE public.ibs DROP CONSTRAINT ibs_status_check;
ALTER TABLE public.ibs ADD CONSTRAINT ibs_status_check CHECK (status = ANY (ARRAY['draft', 'submitted', 'en_proceso', 'configurado', 'active', 'inactive']));

-- Now fix the out-of-sync data
UPDATE public.ibs SET status = 'configurado' WHERE id = '3a95dbf1-40bf-4766-990a-049134399176' AND status = 'submitted';
UPDATE public.ibs SET status = 'configurado' WHERE id = 'ecd35878-6634-4494-a082-e1b01379727d' AND status = 'submitted';