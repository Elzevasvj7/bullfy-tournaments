
-- Table to store editable role permissions
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  permission text NOT NULL,
  role public.app_role NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module, permission, role)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Only global_admin can manage permissions
CREATE POLICY "Global admins can manage permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'global_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'global_admin'::app_role));

-- Admins can read permissions
CREATE POLICY "Admins can read permissions"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- All authenticated can read own role permissions
CREATE POLICY "Users can read permissions for own roles"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (role IN (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit trigger
CREATE TRIGGER audit_role_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- Seed with default permissions
INSERT INTO public.role_permissions (module, permission, role, enabled) VALUES
  -- Dashboard
  ('dashboard', 'ver_metricas_generales', 'global_admin', true),
  ('dashboard', 'ver_metricas_generales', 'admin', true),
  ('dashboard', 'ver_metricas_generales', 'admin_operaciones', true),
  ('dashboard', 'ver_metricas_generales', 'operaciones', false),
  ('dashboard', 'ver_metricas_generales', 'bd', false),
  ('dashboard', 'ver_metricas_propias', 'global_admin', true),
  ('dashboard', 'ver_metricas_propias', 'admin', true),
  ('dashboard', 'ver_metricas_propias', 'admin_operaciones', true),
  ('dashboard', 'ver_metricas_propias', 'operaciones', true),
  ('dashboard', 'ver_metricas_propias', 'bd', true),
  -- IBs
  ('ibs', 'ver_todos', 'global_admin', true),
  ('ibs', 'ver_todos', 'admin', true),
  ('ibs', 'ver_todos', 'admin_operaciones', true),
  ('ibs', 'ver_todos', 'operaciones', true),
  ('ibs', 'ver_todos', 'bd', false),
  ('ibs', 'ver_propios', 'global_admin', true),
  ('ibs', 'ver_propios', 'admin', true),
  ('ibs', 'ver_propios', 'admin_operaciones', true),
  ('ibs', 'ver_propios', 'operaciones', true),
  ('ibs', 'ver_propios', 'bd', true),
  ('ibs', 'crear', 'global_admin', true),
  ('ibs', 'crear', 'admin', true),
  ('ibs', 'crear', 'admin_operaciones', false),
  ('ibs', 'crear', 'operaciones', false),
  ('ibs', 'crear', 'bd', true),
  ('ibs', 'modificar_condiciones', 'global_admin', true),
  ('ibs', 'modificar_condiciones', 'admin', true),
  ('ibs', 'modificar_condiciones', 'admin_operaciones', false),
  ('ibs', 'modificar_condiciones', 'operaciones', false),
  ('ibs', 'modificar_condiciones', 'bd', true),
  -- Deals / Reportes
  ('deals', 'ver_todos', 'global_admin', true),
  ('deals', 'ver_todos', 'admin', true),
  ('deals', 'ver_todos', 'admin_operaciones', true),
  ('deals', 'ver_todos', 'operaciones', true),
  ('deals', 'ver_todos', 'bd', false),
  ('deals', 'ver_propios', 'global_admin', true),
  ('deals', 'ver_propios', 'admin', true),
  ('deals', 'ver_propios', 'admin_operaciones', true),
  ('deals', 'ver_propios', 'operaciones', true),
  ('deals', 'ver_propios', 'bd', true),
  ('deals', 'generar_reportes', 'global_admin', true),
  ('deals', 'generar_reportes', 'admin', true),
  ('deals', 'generar_reportes', 'admin_operaciones', false),
  ('deals', 'generar_reportes', 'operaciones', false),
  ('deals', 'generar_reportes', 'bd', true),
  -- Usuarios
  ('usuarios', 'ver_lista', 'global_admin', true),
  ('usuarios', 'ver_lista', 'admin', true),
  ('usuarios', 'ver_lista', 'admin_operaciones', false),
  ('usuarios', 'ver_lista', 'operaciones', false),
  ('usuarios', 'ver_lista', 'bd', false),
  ('usuarios', 'aprobar_rechazar', 'global_admin', true),
  ('usuarios', 'aprobar_rechazar', 'admin', true),
  ('usuarios', 'aprobar_rechazar', 'admin_operaciones', false),
  ('usuarios', 'aprobar_rechazar', 'operaciones', false),
  ('usuarios', 'aprobar_rechazar', 'bd', false),
  ('usuarios', 'cambiar_roles', 'global_admin', true),
  ('usuarios', 'cambiar_roles', 'admin', false),
  ('usuarios', 'cambiar_roles', 'admin_operaciones', false),
  ('usuarios', 'cambiar_roles', 'operaciones', false),
  ('usuarios', 'cambiar_roles', 'bd', false),
  ('usuarios', 'resetear_passwords', 'global_admin', true),
  ('usuarios', 'resetear_passwords', 'admin', false),
  ('usuarios', 'resetear_passwords', 'admin_operaciones', false),
  ('usuarios', 'resetear_passwords', 'operaciones', false),
  ('usuarios', 'resetear_passwords', 'bd', false),
  -- Configuración
  ('configuracion', 'gestionar_tablas_referencia', 'global_admin', true),
  ('configuracion', 'gestionar_tablas_referencia', 'admin', true),
  ('configuracion', 'gestionar_tablas_referencia', 'admin_operaciones', false),
  ('configuracion', 'gestionar_tablas_referencia', 'operaciones', false),
  ('configuracion', 'gestionar_tablas_referencia', 'bd', false),
  ('configuracion', 'configuracion_sistema', 'global_admin', true),
  ('configuracion', 'configuracion_sistema', 'admin', false),
  ('configuracion', 'configuracion_sistema', 'admin_operaciones', false),
  ('configuracion', 'configuracion_sistema', 'operaciones', false),
  ('configuracion', 'configuracion_sistema', 'bd', false),
  -- Operaciones / IT
  ('operaciones_it', 'ver_tickets', 'global_admin', true),
  ('operaciones_it', 'ver_tickets', 'admin', true),
  ('operaciones_it', 'ver_tickets', 'admin_operaciones', true),
  ('operaciones_it', 'ver_tickets', 'operaciones', true),
  ('operaciones_it', 'ver_tickets', 'bd', false),
  ('operaciones_it', 'cambiar_estado_tickets', 'global_admin', true),
  ('operaciones_it', 'cambiar_estado_tickets', 'admin', false),
  ('operaciones_it', 'cambiar_estado_tickets', 'admin_operaciones', true),
  ('operaciones_it', 'cambiar_estado_tickets', 'operaciones', true),
  ('operaciones_it', 'cambiar_estado_tickets', 'bd', false),
  ('operaciones_it', 'gestionar_equipo', 'global_admin', true),
  ('operaciones_it', 'gestionar_equipo', 'admin', false),
  ('operaciones_it', 'gestionar_equipo', 'admin_operaciones', true),
  ('operaciones_it', 'gestionar_equipo', 'operaciones', false),
  ('operaciones_it', 'gestionar_equipo', 'bd', false),
  -- Notificaciones
  ('notificaciones', 'recibir', 'global_admin', true),
  ('notificaciones', 'recibir', 'admin', true),
  ('notificaciones', 'recibir', 'admin_operaciones', true),
  ('notificaciones', 'recibir', 'operaciones', true),
  ('notificaciones', 'recibir', 'bd', true),
  ('notificaciones', 'enviar', 'global_admin', true),
  ('notificaciones', 'enviar', 'admin', true),
  ('notificaciones', 'enviar', 'admin_operaciones', true),
  ('notificaciones', 'enviar', 'operaciones', false),
  ('notificaciones', 'enviar', 'bd', false),
  -- Auditoría
  ('auditoria', 'ver_logs', 'global_admin', true),
  ('auditoria', 'ver_logs', 'admin', true),
  ('auditoria', 'ver_logs', 'admin_operaciones', false),
  ('auditoria', 'ver_logs', 'operaciones', false),
  ('auditoria', 'ver_logs', 'bd', false);
