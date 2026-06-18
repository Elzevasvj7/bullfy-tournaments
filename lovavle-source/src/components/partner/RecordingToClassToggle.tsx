import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toastUtils";
import { GraduationCap, Loader2, ShieldCheck } from "lucide-react";

interface Props {
  portalId: string;
}

const RecordingToClassToggle = ({ portalId }: Props) => {
  const { isAdmin, isGlobalAdmin } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canEdit = isAdmin || isGlobalAdmin;

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("partner_portals")
        .select("recording_to_class_enabled")
        .eq("id", portalId)
        .maybeSingle();
      if (data) setEnabled(!!(data as any).recording_to_class_enabled);
      setLoading(false);
    };
    load();
  }, [portalId]);

  const handleToggle = async (next: boolean) => {
    if (!canEdit) return;
    setSaving(true);
    const { error } = await supabase
      .from("partner_portals")
      .update({ recording_to_class_enabled: next } as any)
      .eq("id", portalId);
    if (error) {
      toast.error("Error al actualizar: " + error.message);
    } else {
      setEnabled(next);
      toast.success(next ? "Grabación a Clase activada" : "Grabación a Clase desactivada");
    }
    setSaving(false);
  };

  if (!canEdit) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-primary" /> Grabación a Clase
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Guardar grabaciones de Live como clases en Academy</Label>
              <p className="text-xs text-muted-foreground">
                Al activar, cada grabación de un Live de este portal se publica automáticamente como una clase gratuita en el curso <strong>"Grabaciones en Vivo"</strong>, módulo <strong>"En Vivos"</strong>.
              </p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-1">
                <ShieldCheck className="w-3 h-3" /> Configuración exclusiva para administradores.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={handleToggle} disabled={saving} />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecordingToClassToggle;
