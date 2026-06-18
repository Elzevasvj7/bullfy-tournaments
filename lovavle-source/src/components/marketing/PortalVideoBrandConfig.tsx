import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toastUtils";
import { Loader2, Palette, Save } from "lucide-react";

interface Props {
  portalId: string;
}

interface BrandConfig {
  primary_color: string;
  secondary_color: string;
  subtitle_color: string;
  subtitle_bg_color: string;
  subtitle_font: string;
  subtitle_font_size: number;
  subtitle_position: string;
  logo_url: string | null;
  watermark_text: string | null;
  watermark_enabled: boolean;
}

const DEFAULTS: BrandConfig = {
  primary_color: "#146EF5",
  secondary_color: "#062B63",
  subtitle_color: "#FFFFFF",
  subtitle_bg_color: "rgba(0,0,0,0.5)",
  subtitle_font: "Montserrat",
  subtitle_font_size: 42,
  subtitle_position: "bottom",
  logo_url: null,
  watermark_text: "Powered by Bullfy",
  watermark_enabled: true,
};

const FONTS = ["Montserrat", "Figtree", "Helvetica", "Arial", "Inter", "Roboto", "Poppins"];
const POSITIONS = [
  { value: "bottom", label: "Abajo" },
  { value: "center", label: "Centro" },
  { value: "top", label: "Arriba" },
];

export default function PortalVideoBrandConfig({ portalId }: Props) {
  const [cfg, setCfg] = useState<BrandConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("portal_video_brand_config")
        .select("*")
        .eq("portal_id", portalId)
        .maybeSingle();
      if (data) setCfg({ ...DEFAULTS, ...data });
      setLoading(false);
    })();
  }, [portalId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("portal_video_brand_config")
        .upsert({ portal_id: portalId, ...cfg }, { onConflict: "portal_id" });
      if (error) throw error;
      toast.success("Identidad de marca guardada");
    } catch (e: any) {
      toast.error("Error al guardar: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" />
          Identidad visual de Video Studio
        </CardTitle>
        <CardDescription>
          Personaliza colores, fuente y marca de agua que se aplican a los clips generados por este portal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Colors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Color primario</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={cfg.primary_color}
                onChange={(e) => setCfg({ ...cfg, primary_color: e.target.value })}
                className="w-16 h-10 p-1"
              />
              <Input
                value={cfg.primary_color}
                onChange={(e) => setCfg({ ...cfg, primary_color: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Color secundario</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={cfg.secondary_color}
                onChange={(e) => setCfg({ ...cfg, secondary_color: e.target.value })}
                className="w-16 h-10 p-1"
              />
              <Input
                value={cfg.secondary_color}
                onChange={(e) => setCfg({ ...cfg, secondary_color: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Subtitle styling */}
        <div className="space-y-3 border-t pt-4">
          <h4 className="font-semibold text-foreground">Subtítulos</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fuente</Label>
              <Select value={cfg.subtitle_font} onValueChange={(v) => setCfg({ ...cfg, subtitle_font: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tamaño ({cfg.subtitle_font_size}px)</Label>
              <Input
                type="number"
                min={20}
                max={80}
                value={cfg.subtitle_font_size}
                onChange={(e) => setCfg({ ...cfg, subtitle_font_size: parseInt(e.target.value) || 42 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Color del texto</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={cfg.subtitle_color}
                  onChange={(e) => setCfg({ ...cfg, subtitle_color: e.target.value })}
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={cfg.subtitle_color}
                  onChange={(e) => setCfg({ ...cfg, subtitle_color: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Posición</Label>
              <Select value={cfg.subtitle_position} onValueChange={(v) => setCfg({ ...cfg, subtitle_position: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {POSITIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Fondo del subtítulo (CSS rgba/hex)</Label>
              <Input
                value={cfg.subtitle_bg_color}
                onChange={(e) => setCfg({ ...cfg, subtitle_bg_color: e.target.value })}
                placeholder="rgba(0,0,0,0.5)"
              />
            </div>
          </div>
        </div>

        {/* Watermark */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-foreground">Marca de agua</h4>
            <Switch
              checked={cfg.watermark_enabled}
              onCheckedChange={(v) => setCfg({ ...cfg, watermark_enabled: v })}
            />
          </div>
          {cfg.watermark_enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Texto de marca de agua</Label>
                <Input
                  value={cfg.watermark_text || ""}
                  onChange={(e) => setCfg({ ...cfg, watermark_text: e.target.value })}
                  placeholder="Powered by Bullfy"
                />
              </div>
              <div className="space-y-2">
                <Label>URL del logo (opcional)</Label>
                <Input
                  value={cfg.logo_url || ""}
                  onChange={(e) => setCfg({ ...cfg, logo_url: e.target.value || null })}
                  placeholder="https://..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="border-t pt-4">
          <Label className="mb-2 block">Vista previa de subtítulo</Label>
          <div className="bg-black/80 rounded-lg p-8 flex items-center justify-center min-h-32">
            <p
              style={{
                fontFamily: `'${cfg.subtitle_font}', sans-serif`,
                fontSize: cfg.subtitle_font_size,
                color: cfg.subtitle_color,
                background: cfg.subtitle_bg_color,
                padding: "12px 24px",
                borderRadius: 12,
                textAlign: "center",
              }}
            >
              Tu mensaje viral aquí
            </p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar identidad
        </Button>
      </CardContent>
    </Card>
  );
}
