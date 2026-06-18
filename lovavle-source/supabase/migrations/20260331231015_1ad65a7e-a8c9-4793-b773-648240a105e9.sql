
-- Academy Courses
CREATE TABLE public.academy_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  thumbnail_path text,
  display_order int DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  price_usd numeric DEFAULT 0,
  is_free boolean DEFAULT false,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Academy Modules
CREATE TABLE public.academy_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Academy Lessons
CREATE TABLE public.academy_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.academy_modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  video_path text,
  duration_seconds int DEFAULT 0,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Academy Enrollments
CREATE TABLE public.academy_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  partner_user_id uuid NOT NULL REFERENCES public.partner_users(id) ON DELETE CASCADE,
  granted_by text DEFAULT 'admin_manual',
  tx_hash text,
  enrolled_at timestamptz DEFAULT now(),
  UNIQUE(course_id, partner_user_id)
);

-- Academy Progress
CREATE TABLE public.academy_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  partner_user_id uuid NOT NULL REFERENCES public.partner_users(id) ON DELETE CASCADE,
  completed boolean DEFAULT false,
  watch_time_seconds int DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(lesson_id, partner_user_id)
);

-- Academy Certificates
CREATE TABLE public.academy_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  partner_user_id uuid NOT NULL REFERENCES public.partner_users(id) ON DELETE CASCADE,
  certificate_code text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  issued_at timestamptz DEFAULT now(),
  UNIQUE(course_id, partner_user_id)
);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('academy-videos', 'academy-videos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('academy-thumbnails', 'academy-thumbnails', true);

-- Storage policies for academy-videos
CREATE POLICY "Authenticated can upload academy videos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'academy-videos');
CREATE POLICY "Anyone can read academy videos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'academy-videos');
CREATE POLICY "Authenticated can delete academy videos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'academy-videos');

-- Storage policies for academy-thumbnails
CREATE POLICY "Authenticated can upload academy thumbnails" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'academy-thumbnails');
CREATE POLICY "Anyone can read academy thumbnails" ON storage.objects FOR SELECT TO public USING (bucket_id = 'academy-thumbnails');
CREATE POLICY "Authenticated can delete academy thumbnails" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'academy-thumbnails');

-- RLS on academy_courses
ALTER TABLE public.academy_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated admins can manage courses" ON public.academy_courses FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));
CREATE POLICY "Anon can read published courses" ON public.academy_courses FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "Authenticated can read courses" ON public.academy_courses FOR SELECT TO authenticated USING (true);

-- RLS on academy_modules
ALTER TABLE public.academy_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated admins can manage modules" ON public.academy_modules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));
CREATE POLICY "Anon can read modules" ON public.academy_modules FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can read modules" ON public.academy_modules FOR SELECT TO authenticated USING (true);

-- RLS on academy_lessons
ALTER TABLE public.academy_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated admins can manage lessons" ON public.academy_lessons FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));
CREATE POLICY "Anon can read lessons" ON public.academy_lessons FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can read lessons" ON public.academy_lessons FOR SELECT TO authenticated USING (true);

-- RLS on academy_enrollments
ALTER TABLE public.academy_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated admins can manage enrollments" ON public.academy_enrollments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));
CREATE POLICY "Anon can read enrollments" ON public.academy_enrollments FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can read enrollments" ON public.academy_enrollments FOR SELECT TO authenticated USING (true);

-- RLS on academy_progress
ALTER TABLE public.academy_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated admins can manage progress" ON public.academy_progress FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));
CREATE POLICY "Anon can read progress" ON public.academy_progress FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert progress" ON public.academy_progress FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update progress" ON public.academy_progress FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- RLS on academy_certificates
ALTER TABLE public.academy_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated admins can manage certificates" ON public.academy_certificates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));
CREATE POLICY "Anon can read certificates" ON public.academy_certificates FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert certificates" ON public.academy_certificates FOR INSERT TO anon WITH CHECK (true);

-- Updated_at trigger for courses
CREATE TRIGGER update_academy_courses_updated_at BEFORE UPDATE ON public.academy_courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
