import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toastUtils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Instagram, Youtube, Eye, EyeOff, Save, CheckCircle, AlertCircle, ExternalLink, Loader2, Unplug } from "lucide-react";

interface SocialCredentialsConfigProps {
  portalId: string;
}

interface PlatformCredential {
  id?: string;
  platform: string;
  client_id: string;
  client_secret: string;
  status: string;
  connected_account_name: string | null;
}

const PLATFORMS = [
  {
    key: "instagram",
    label: "Instagram / Meta",
    icon: Instagram,
    color: "text-pink-500",
    guide: [
      { step: "1", text: "Ve a Meta for Developers (developers.facebook.com) e inicia sesión con tu cuenta de Facebook." },
      { step: "2", text: "Crea una nueva App de tipo \"Business\". Selecciona \"Otra\" como caso de uso." },
      { step: "3", text: "En Products, agrega \"Instagram Graph API\"." },
      { step: "4", text: "En Settings > Basic, copia el App ID (Client ID) y el App Secret (Client Secret)." },
      { step: "5", text: "En Settings > Advanced, agrega tu URL de redirección OAuth." },
      { step: "6", text: "Asegúrate de tener una cuenta de Instagram Business o Creator vinculada a una página de Facebook." },
    ],
    docsUrl: "https://developers.facebook.com/docs/instagram-api/getting-started",
  },
  {
    key: "tiktok",
    label: "TikTok",
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.63a8.28 8.28 0 0 0 3.76.9V6.08a4.84 4.84 0 0 1 0 .61z" />
      </svg>
    ),
    color: "text-foreground",
    guide: [
      { step: "1", text: "Ve a TikTok for Developers (developers.tiktok.com) y crea una cuenta de desarrollador." },
      { step: "2", text: "Crea una nueva aplicación y selecciona los permisos de \"Content Posting API\"." },
      { step: "3", text: "Completa la información de la app (nombre, descripción, ícono, URL de privacidad)." },
      { step: "4", text: "En la sección de configuración, copia el Client Key (Client ID) y Client Secret." },
      { step: "5", text: "Agrega tu URL de redirección OAuth en la configuración de la app." },
      { step: "6", text: "Envía la app para revisión. El proceso puede tomar 1-3 días hábiles." },
    ],
    docsUrl: "https://developers.tiktok.com/doc/getting-started",
  },
  {
    key: "youtube",
    label: "YouTube",
    icon: Youtube,
    color: "text-red-500",
    guide: [
      { step: "1", text: "Ve a Google Cloud Console (console.cloud.google.com) e inicia sesión." },
      { step: "2", text: "Crea un nuevo proyecto o selecciona uno existente." },
      { step: "3", text: "En APIs & Services > Library, busca y habilita \"YouTube Data API v3\"." },
      { step: "4", text: "En APIs & Services > Credentials, crea credenciales OAuth 2.0 (tipo Web Application)." },
      { step: "5", text: "Copia el Client ID y Client Secret generados." },
      { step: "6", text: "Configura la pantalla de consentimiento OAuth (OAuth consent screen) con los scopes necesarios." },
      { step: "7", text: "Agrega tu URL de redirección autorizada en la configuración de credenciales." },
    ],
    docsUrl: "https://developers.google.com/youtube/v3/getting-started",
  },
];

const SocialCredentialsConfig = ({ portalId }: SocialCredentialsConfigProps) => {
  const [credentials, setCredentials] = useState<Record<string, PlatformCredential>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCredentials();
  }, [portalId]);

  const fetchCredentials = async () => {
    const { data } = await supabase
      .from("portal_social_credentials")
      .select("*")
      .eq("portal_id", portalId);

    const map: Record<string, PlatformCredential> = {};
    PLATFORMS.forEach(p => {
      const existing = data?.find((d: any) => d.platform === p.key);
      map[p.key] = existing
        ? { id: existing.id, platform: p.key, client_id: existing.client_id || "", client_secret: existing.client_secret || "", status: existing.status, connected_account_name: existing.connected_account_name }
        : { platform: p.key, client_id: "", client_secret: "", status: "disconnected", connected_account_name: null };
    });
    setCredentials(map);
    setLoading(false);
  };

  const handleSave = async (platform: string) => {
    const cred = credentials[platform];
    if (!cred.client_id || !cred.client_secret) {
      toast.error("Completa ambos campos: Client ID y Client Secret");
      return;
    }

    setSaving(platform);
    try {
      const payload = {
        portal_id: portalId,
        platform,
        client_id: cred.client_id.trim(),
        client_secret: cred.client_secret.trim(),
        status: "configured" as const,
      };

      if (cred.id) {
        const { error } = await supabase.from("portal_social_credentials").update(payload).eq("id", cred.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("portal_social_credentials").insert(payload);
        if (error) throw error;
      }

      toast.success(`Credenciales de ${PLATFORMS.find(p => p.key === platform)?.label} guardadas`);
      fetchCredentials();
    } catch (err: any) {
      toast.error("Error al guardar: " + (err.message || "Error desconocido"));
    } finally {
      setSaving(null);
    }
  };

  const handleDisconnect = async (platform: string) => {
    const cred = credentials[platform];
    if (!cred.id) return;

    const { error } = await supabase.from("portal_social_credentials").update({
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      connected_account_name: null,
      status: "disconnected",
    }).eq("id", cred.id);

    if (error) {
      toast.error("Error al desconectar");
    } else {
      toast.success("Plataforma desconectada");
      fetchCredentials();
    }
  };

  const updateField = (platform: string, field: "client_id" | "client_secret", value: string) => {
    setCredentials(prev => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Conexiones Sociales</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configura tus credenciales de API para publicar contenido directamente a tus redes sociales
        </p>
      </div>

      <Accordion type="single" collapsible className="space-y-3">
        {PLATFORMS.map(platform => {
          const cred = credentials[platform.key];
          const Icon = platform.icon;
          const statusBadge = cred.status === "connected"
            ? <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="w-3 h-3 mr-1" /> Conectado</Badge>
            : cred.status === "configured"
            ? <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" /> Configurado</Badge>
            : <Badge variant="outline">No configurado</Badge>;

          return (
            <AccordionItem key={platform.key} value={platform.key} className="border rounded-lg px-0">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-3 flex-1">
                  <Icon className={`w-5 h-5 ${platform.color}`} />
                  <span className="font-semibold text-foreground">{platform.label}</span>
                  {statusBadge}
                  {cred.connected_account_name && (
                    <span className="text-xs text-muted-foreground ml-2">@{cred.connected_account_name}</span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                {/* Guide */}
                <Card className="bg-muted/50 border-dashed">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      📋 Guía para obtener credenciales
                      <a href={platform.docsUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-xs font-normal">
                        Documentación oficial <ExternalLink className="w-3 h-3" />
                      </a>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ol className="space-y-1.5">
                      {platform.guide.map(g => (
                        <li key={g.step} className="text-sm text-muted-foreground flex gap-2">
                          <span className="font-bold text-foreground shrink-0">{g.step}.</span>
                          {g.text}
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>

                {/* Credentials form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Client ID / App ID</Label>
                    <Input
                      value={cred.client_id}
                      onChange={e => updateField(platform.key, "client_id", e.target.value)}
                      placeholder="Ej: 123456789012345"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Client Secret / App Secret</Label>
                    <div className="relative">
                      <Input
                        type={showSecrets[platform.key] ? "text" : "password"}
                        value={cred.client_secret}
                        onChange={e => updateField(platform.key, "client_secret", e.target.value)}
                        placeholder="••••••••••••"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecrets(prev => ({ ...prev, [platform.key]: !prev[platform.key] }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showSecrets[platform.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => handleSave(platform.key)} disabled={saving === platform.key} className="gap-1.5">
                    {saving === platform.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar Credenciales
                  </Button>
                  {cred.status === "connected" && (
                    <Button variant="outline" onClick={() => handleDisconnect(platform.key)} className="gap-1.5 text-destructive">
                      <Unplug className="w-4 h-4" /> Desconectar
                    </Button>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};

export default SocialCredentialsConfig;
