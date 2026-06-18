import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, Video } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ALL_LIVE_FEATURES, LIVE_FEATURE_LABELS, LIVE_FEATURE_DESCRIPTIONS, type LiveFeatureKey } from "@/hooks/useLiveFeatureAccess";
import { useAuth } from "@/hooks/useAuth";

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
  { value: "ib_externo", label: "IB Externo", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "bullfy_family", label: "Bullfy Family", color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
];

interface AccessRow {
  id: string;
  role: string | null;
  user_id: string | null;
  feature_key: string;
  enabled: boolean;
}

const LiveFeatureAccessMatrix = () => {
  const { isAdmin, isGlobalAdmin } = useAuth();
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const canEdit = isAdmin || isGlobalAdmin;

  const fetch = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("live_feature_access")
      .select("id, role, user_id, feature_key, enabled")
      .is("user_id", null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setRows((data as AccessRow[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetch();
  }, []);

  const handleToggle = async (role: string, featureKey: LiveFeatureKey, currentEnabled: boolean | null) => {
    const key = `${role}-${featureKey}`;
    setToggling(key);
    const existing = rows.find((r) => r.role === role && r.feature_key === featureKey && !r.user_id);
    const newEnabled = !(currentEnabled ?? false);

    if (existing) {
      const { error } = await supabase
        .from("live_feature_access")
        .update({ enabled: newEnabled })
        .eq("id", existing.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setRows((prev) => prev.map((r) => (r.id === existing.id ? { ...r, enabled: newEnabled } : r)));
      }
    } else {
      const { data, error } = await supabase
        .from("live_feature_access")
        .insert({ role: role as any, feature_key: featureKey, enabled: newEnabled })
        .select()
        .single();
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else if (data) {
        setRows((prev) => [...prev, data as AccessRow]);
      }
    }
    setToggling(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando permisos...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-card rounded-xl border border-border shadow-card p-5">
        <h3 className="text-base font-display font-semibold text-foreground mb-2 flex items-center gap-2">
          <Video className="w-4 h-4 text-primary" /> Permisos de Bullfy Live por Rol
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Habilita o deshabilita funciones avanzadas (modo reunión, breakouts, grabación, etc.) por rol.
          Por defecto, solo el modo broadcast está habilitado para todos. Los IBs Externos requieren configuración individual desde "Mantenimiento de IBs".
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-muted-foreground font-medium w-[260px]">Función</th>
                {ROLES_META.map((role) => (
                  <th key={role.value} className="text-center p-3 min-w-[100px]">
                    <Badge className={`${role.color} text-[10px]`}>{role.label}</Badge>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_LIVE_FEATURES.map((feature) => (
                <tr key={feature} className="border-b border-border/50 hover:bg-secondary/20">
                  <td className="p-3">
                    <div className="font-medium text-foreground">{LIVE_FEATURE_LABELS[feature]}</div>
                    <div className="text-[11px] text-muted-foreground">{LIVE_FEATURE_DESCRIPTIONS[feature]}</div>
                  </td>
                  {ROLES_META.map((role) => {
                    const row = rows.find((r) => r.role === role.value && r.feature_key === feature && !r.user_id);
                    const enabled = row?.enabled ?? false;
                    const key = `${role.value}-${feature}`;
                    return (
                      <td key={role.value} className="p-3 text-center">
                        {canEdit ? (
                          <div className="flex justify-center">
                            <Switch
                              checked={enabled}
                              disabled={toggling === key}
                              onCheckedChange={() => handleToggle(role.value, feature, enabled)}
                              className="data-[state=checked]:bg-accent"
                            />
                          </div>
                        ) : enabled ? (
                          <span className="inline-block w-5 h-5 rounded-full bg-accent/30 text-accent leading-5 text-xs font-bold">
                            ✓
                          </span>
                        ) : (
                          <span className="inline-block w-5 h-5 rounded-full bg-muted text-muted-foreground/30 leading-5 text-xs">
                            —
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
          <Shield className="w-3.5 h-3.5 text-primary inline mr-1.5" />
          <strong>Nota:</strong> El modo broadcast siempre está habilitado y no requiere permiso. Estos toggles
          controlan funciones avanzadas (Meeting, grabación servidor, breakouts, encuestas, pizarra, transcripción).
        </div>
      </div>
    </div>
  );
};

export default LiveFeatureAccessMatrix;
