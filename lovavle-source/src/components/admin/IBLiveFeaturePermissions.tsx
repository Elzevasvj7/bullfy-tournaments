import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Loader2, Video } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ALL_LIVE_FEATURES, LIVE_FEATURE_LABELS, LIVE_FEATURE_DESCRIPTIONS, type LiveFeatureKey } from "@/hooks/useLiveFeatureAccess";

interface IBLiveFeaturePermissionsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  ibName: string;
}

interface PermRow {
  id: string;
  feature_key: string;
  enabled: boolean;
}

const IBLiveFeaturePermissions = ({ open, onOpenChange, userId, ibName }: IBLiveFeaturePermissionsProps) => {
  const [rows, setRows] = useState<PermRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !userId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("live_feature_access")
        .select("id, feature_key, enabled")
        .eq("user_id", userId);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setRows((data as PermRow[]) || []);
      }
      setLoading(false);
    })();
  }, [open, userId]);

  const handleToggle = async (feature: LiveFeatureKey, currentEnabled: boolean) => {
    setToggling(feature);
    const existing = rows.find((r) => r.feature_key === feature);
    const newEnabled = !currentEnabled;

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
        .insert({ user_id: userId, feature_key: feature, enabled: newEnabled })
        .select()
        .single();
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else if (data) {
        setRows((prev) => [...prev, data as PermRow]);
      }
    }
    setToggling(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-4 h-4 text-primary" /> Permisos de Video — {ibName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Estos overrides individuales tienen prioridad sobre los permisos por rol. Por defecto, los IBs Externos solo tienen modo broadcast habilitado.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {ALL_LIVE_FEATURES.map((feature) => {
              const row = rows.find((r) => r.feature_key === feature);
              const enabled = row?.enabled ?? false;
              return (
                <div
                  key={feature}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border hover:bg-secondary/20"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{LIVE_FEATURE_LABELS[feature]}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{LIVE_FEATURE_DESCRIPTIONS[feature]}</div>
                  </div>
                  <Switch
                    checked={enabled}
                    disabled={toggling === feature}
                    onCheckedChange={() => handleToggle(feature, enabled)}
                    className="data-[state=checked]:bg-accent shrink-0 mt-1"
                  />
                </div>
              );
            })}
          </div>
        )}

        <div className="text-[11px] text-muted-foreground pt-2 border-t border-border">
          El IB recibirá una notificación automática cada vez que cambies un permiso.
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IBLiveFeaturePermissions;
