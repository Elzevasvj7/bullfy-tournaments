import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Shield, Eye, Settings, Users, FileText, Bell, Wrench, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface PermissionRow {
  id: string;
  module: string;
  permission: string;
  role: string;
  enabled: boolean;
}

const ROLES_META = [
  { value: "global_admin", label: "Global Admin", color: "bg-destructive/20 text-destructive border-destructive/30" },
  { value: "admin", label: "Admin", color: "bg-primary/20 text-primary border-primary/30" },
  { value: "admin_operaciones", label: "Admin Ops", color: "bg-accent/20 text-accent border-accent/30" },
  { value: "operaciones", label: "Operaciones", color: "bg-accent/20 text-accent border-accent/30" },
  { value: "admin_bd", label: "Admin BD", color: "bg-chart-4/20 text-chart-4 border-chart-4/30" },
  { value: "bd", label: "BD", color: "bg-secondary text-secondary-foreground" },
  { value: "marketing", label: "Marketing", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { value: "admin_ventas", label: "Admin Ventas", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  { value: "ventas", label: "Ventas", color: "bg-teal-500/20 text-teal-400 border-teal-500/30" },
  { value: "dealing", label: "Dealing", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { value: "accounting_user", label: "Accounting User", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "accountant", label: "Accountant", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  { value: "directivo", label: "Directivo", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  { value: "ib_externo", label: "IB Externo", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
];

const MODULE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  dashboard: { label: "Dashboard", icon: <Settings className="w-4 h-4" /> },
  ibs: { label: "IBs", icon: <Users className="w-4 h-4" /> },
  deals: { label: "Deals / Reportes", icon: <FileText className="w-4 h-4" /> },
  usuarios: { label: "Usuarios", icon: <Users className="w-4 h-4" /> },
  configuracion: { label: "Configuración", icon: <Settings className="w-4 h-4" /> },
  operaciones_it: { label: "Operaciones / IT", icon: <Wrench className="w-4 h-4" /> },
  notificaciones: { label: "Notificaciones", icon: <Bell className="w-4 h-4" /> },
  auditoria: { label: "Auditoría", icon: <Eye className="w-4 h-4" /> },
};

const PERMISSION_LABELS: Record<string, string> = {
  ver_metricas_generales: "Ver métricas generales",
  ver_metricas_propias: "Ver métricas propias",
  ver_todos: "Ver todos",
  ver_propios: "Ver propios",
  crear: "Crear",
  modificar_condiciones: "Modificar condiciones",
  ver_lista: "Ver lista",
  aprobar_rechazar: "Aprobar / rechazar",
  cambiar_roles: "Cambiar roles",
  resetear_passwords: "Resetear contraseñas",
  gestionar_tablas_referencia: "Gestionar tablas referencia",
  configuracion_sistema: "Configuración del sistema",
  ver_tickets: "Ver tickets",
  cambiar_estado_tickets: "Cambiar estado tickets",
  gestionar_equipo: "Gestionar equipo",
  recibir: "Recibir notificaciones",
  enviar: "Enviar notificaciones",
  ver_logs: "Ver logs de auditoría",
  generar_reportes: "Generar reportes",
};

const RolesPermissions = () => {
  const { isGlobalAdmin } = useAuth();
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchPermissions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("role_permissions")
      .select("*")
      .order("module")
      .order("permission")
      .order("role");
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setPermissions((data as PermissionRow[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const handleToggle = async (id: string, currentEnabled: boolean) => {
    setToggling(id);
    // Optimistic update
    setPermissions((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: !currentEnabled } : p)));

    const { error } = await supabase
      .from("role_permissions")
      .update({ enabled: !currentEnabled })
      .eq("id", id);

    if (error) {
      // Revert
      setPermissions((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: currentEnabled } : p)));
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setToggling(null);
  };

  // Group by module, then by permission
  const modules = [...new Set(permissions.map((p) => p.module))];
  const grouped = modules.map((mod) => {
    const modPerms = permissions.filter((p) => p.module === mod);
    const permNames = [...new Set(modPerms.map((p) => p.permission))];
    return {
      module: mod,
      permissions: permNames.map((perm) => ({
        permission: perm,
        roles: ROLES_META.map((role) => {
          const row = modPerms.find((p) => p.permission === perm && p.role === role.value);
          return { role: role.value, id: row?.id || "", enabled: row?.enabled ?? false };
        }),
      })),
    };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando permisos...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Roles legend */}
      <div className="bg-gradient-card rounded-xl border border-border shadow-card p-6">
        <h3 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" /> Roles del Sistema
        </h3>
        <div className="flex flex-wrap gap-3">
          {ROLES_META.map((role) => (
            <div key={role.value} className="flex items-center gap-2 p-3 rounded-lg border border-border bg-secondary/20">
              <Badge className={role.color}>{role.label}</Badge>
              <span className="text-xs text-muted-foreground font-mono">{role.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Permissions matrix */}
      <div className="bg-gradient-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-display font-semibold text-foreground">Matriz de Permisos por Módulo</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isGlobalAdmin
              ? "Habilita o deshabilita permisos para cada rol con los interruptores"
              : "Vista de referencia de los permisos asignados a cada rol"}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-muted-foreground font-medium w-[180px]">Módulo</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Permiso</th>
                {ROLES_META.map((role) => (
                  <th key={role.value} className="text-center p-4 min-w-[100px]">
                    <Badge className={`${role.color} text-[10px]`}>{role.label}</Badge>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.map((mod) =>
                mod.permissions.map((perm, idx) => (
                  <tr key={`${mod.module}-${perm.permission}`} className="border-b border-border/50 hover:bg-secondary/20">
                    {idx === 0 && (
                      <td className="p-4 text-foreground font-medium align-top" rowSpan={mod.permissions.length}>
                        <div className="flex items-center gap-2">
                          {MODULE_META[mod.module]?.icon}
                          {MODULE_META[mod.module]?.label || mod.module}
                        </div>
                      </td>
                    )}
                    <td className="p-4 text-muted-foreground">
                      {PERMISSION_LABELS[perm.permission] || perm.permission}
                    </td>
                    {perm.roles.map((roleData) => (
                      <td key={roleData.role} className="p-4 text-center">
                        {isGlobalAdmin ? (
                          <div className="flex justify-center">
                            <Switch
                              checked={roleData.enabled}
                              onCheckedChange={() => handleToggle(roleData.id, roleData.enabled)}
                              disabled={toggling === roleData.id || !roleData.id}
                              className="data-[state=checked]:bg-accent"
                            />
                          </div>
                        ) : (
                          roleData.enabled ? (
                            <span className="inline-block w-5 h-5 rounded-full bg-accent/30 text-accent leading-5 text-xs font-bold">✓</span>
                          ) : (
                            <span className="inline-block w-5 h-5 rounded-full bg-muted text-muted-foreground/30 leading-5 text-xs">—</span>
                          )
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RolesPermissions;
