import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/lib/toastUtils";
import { Palette, Upload, Type, Loader2, Trash2, Eye } from "lucide-react";
import { dimHex } from "@/hooks/usePortalBranding";

interface PortalBrandingConfigProps {
  portalId: string;
  portalSlug: string;
}

interface BrandingData {
  id?: string;
  portal_id: string;
  primary_color: string;
  accent_color: string;
  logo_path: string | null;
  display_name_override: string | null;
}

const DEFAULT_BRANDING: Omit<BrandingData, "portal_id"> = {
  primary_color: "#146EF5",
  accent_color: "#83CBFF",
  logo_path: null,
  display_name_override: null,
};

const PortalBrandingConfig = ({ portalId, portalSlug }: PortalBrandingConfigProps) => {
  const [branding, setBranding] = useState<BrandingData>({ portal_id: portalId, ...DEFAULT_BRANDING });
  const btnBg = dimHex(branding.primary_color, 0.7);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchBranding();
  }, [portalId]);

  const fetchBranding = async () => {
    const { data } = await supabase
      .from("partner_portal_branding")
      .select("*")
      .eq("portal_id", portalId)
      .maybeSingle();

    if (data) {
      setBranding(data as unknown as BrandingData);
      if (data.logo_path) {
        const { data: url } = supabase.storage.from("portal-branding").getPublicUrl(data.logo_path as string);
        setLogoPreview(url.publicUrl);
      }
    }
    setLoading(false);
  };

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${portalId}/${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("portal-branding").upload(path, file, { upsert: true });
    if (error) {
      toast.error("Error subiendo archivo: " + error.message);
      return null;
    }
    return path;
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("El logo no puede superar 2MB"); return; }

    const path = await uploadFile(file, "logos");
    if (path) {
      setBranding(b => ({ ...b, logo_path: path }));
      const { data: url } = supabase.storage.from("portal-branding").getPublicUrl(path);
      setLogoPreview(url.publicUrl);
      toast.success("Logo cargado");
    }
  };

  const removeLogo = () => {
    setBranding(b => ({ ...b, logo_path: null }));
    setLogoPreview(null);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      portal_id: portalId,
      primary_color: branding.primary_color,
      accent_color: branding.accent_color,
      logo_path: branding.logo_path,
      display_name_override: branding.display_name_override || null,
    };

    if (branding.id) {
      const { error } = await supabase
        .from("partner_portal_branding")
        .update(payload)
        .eq("id", branding.id);
      if (error) toast.error("Error: " + error.message);
      else toast.success("Branding guardado");
    } else {
      const { data, error } = await supabase
        .from("partner_portal_branding")
        .insert(payload)
        .select()
        .single();
      if (error) toast.error("Error: " + error.message);
      else {
        setBranding(data as unknown as BrandingData);
        toast.success("Branding creado");
      }
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Color config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" /> Colores del Portal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Color Primario</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={branding.primary_color}
                  onChange={e => setBranding(b => ({ ...b, primary_color: e.target.value }))}
                  className="w-10 h-10 rounded border border-border cursor-pointer"
                />
                <Input
                  value={branding.primary_color}
                  onChange={e => setBranding(b => ({ ...b, primary_color: e.target.value }))}
                  className="font-mono text-sm"
                  maxLength={7}
                />
              </div>
              <p className="text-xs text-muted-foreground">Botones, bordes activos, acentos</p>
            </div>
            <div className="space-y-2">
              <Label>Color de Acento</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={branding.accent_color}
                  onChange={e => setBranding(b => ({ ...b, accent_color: e.target.value }))}
                  className="w-10 h-10 rounded border border-border cursor-pointer"
                />
                <Input
                  value={branding.accent_color}
                  onChange={e => setBranding(b => ({ ...b, accent_color: e.target.value }))}
                  className="font-mono text-sm"
                  maxLength={7}
                />
              </div>
              <p className="text-xs text-muted-foreground">Highlights, textos especiales</p>
            </div>
          </div>

          {/* Preview swatch */}
          <div className="flex items-center gap-3 pt-2">
            <span className="text-xs text-muted-foreground">Vista previa:</span>
            <div className="flex gap-1">
              <div className="w-8 h-8 rounded" style={{ background: branding.primary_color }} title="Primario" />
              <div className="w-8 h-8 rounded" style={{ background: branding.accent_color }} title="Acento" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" /> Logo del Portal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {logoPreview ? (
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-lg border border-border bg-muted/20 flex items-center justify-center overflow-hidden">
                <img src={logoPreview} alt="Logo" className="max-w-full max-h-full object-contain" />
              </div>
              <Button variant="destructive" size="sm" onClick={removeLogo} className="gap-1">
                <Trash2 className="w-3 h-3" /> Eliminar
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin logo. Se usará el ícono por defecto.</p>
          )}
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          <Button variant="outline" size="sm" onClick={() => logoRef.current?.click()} className="gap-1">
            <Upload className="w-3 h-3" /> Cargar Logo
          </Button>
          <p className="text-xs text-muted-foreground">PNG o JPG, máximo 2MB. Se recomienda fondo transparente.</p>
        </CardContent>
      </Card>

      {/* Display Name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Type className="w-4 h-4 text-primary" /> Nombre Visible
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Nombre personalizado del portal</Label>
            <Input
              value={branding.display_name_override || ""}
              onChange={e => setBranding(b => ({ ...b, display_name_override: e.target.value || null }))}
              placeholder="Dejar vacío para usar el nombre por defecto"
            />
            <p className="text-xs text-muted-foreground">Se mostrará en la pantalla de login y el header del portal.</p>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" className="gap-1" asChild>
          <a href={`/partner/${portalSlug}`} target="_blank" rel="noopener noreferrer">
            <Eye className="w-3 h-3" /> Ver Portal
          </a>
        </Button>
        <Button onClick={handleSave} disabled={saving} className="gap-1" style={{ backgroundColor: btnBg }}>
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Palette className="w-3 h-3" />}
          {saving ? "Guardando..." : "Guardar Branding"}
        </Button>
      </div>
    </div>
  );
};

export default PortalBrandingConfig;
