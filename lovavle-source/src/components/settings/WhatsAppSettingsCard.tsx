import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  MessageCircle, Save, Loader2, Plus, FileText, RefreshCw, Trash2, Copy, ExternalLink,
} from "lucide-react";

const WhatsAppSettingsCard = () => {
  const qc = useQueryClient();
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [senderNumber, setSenderNumber] = useState("");
  const [sandboxMode, setSandboxMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tplDialog, setTplDialog] = useState(false);
  const [editingTpl, setEditingTpl] = useState<any>(null);
  const webhookUrl = "https://dpfqhwcjyecpnvtchudo.supabase.co/functions/v1/whatsapp-webhook-receive";

  // Load config
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("integration_settings" as any)
        .select("*")
        .eq("service_name", "whatsapp_business")
        .maybeSingle();
      if (data) {
        const d = data as any;
        setSettingsId(d.id);
        setEnabled(d.enabled);
        setSenderNumber(d.config?.sender_number || "");
        setSandboxMode(d.config?.sandbox_mode ?? true);
      }
      setLoading(false);
    };
    load();
  }, []);

  // Templates
  const { data: templates = [], refetch: refetchTpls } = useQuery({
    queryKey: ["whatsapp-templates-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleSave = async () => {
    setSaving(true);
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    const config = { sender_number: senderNumber, sandbox_mode: sandboxMode, webhook_url: webhookUrl };

    if (settingsId) {
      const { error } = await supabase
        .from("integration_settings" as any)
        .update({ enabled, config, updated_by: userId })
        .eq("id", settingsId);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("integration_settings" as any)
        .insert({ service_name: "whatsapp_business", enabled, config, updated_by: userId })
        .select()
        .single();
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      setSettingsId((data as any).id);
    }
    toast({ title: "✅ Configuración guardada" });
    setSaving(false);
  };

  const deleteTpl = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("whatsapp_templates" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-templates-admin"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast({ title: "Plantilla eliminada" });
    },
  });

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: "URL copiada al portapapeles" });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando WhatsApp...
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-emerald-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="w-5 h-5 text-emerald-500" />
            WhatsApp Business — Lead System
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Mensajería WhatsApp vía Twilio para conversaciones bidireccionales con leads.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enable */}
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Servicio activo</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {enabled && (
            <>
              {/* Sender number */}
              <div className="space-y-1">
                <Label className="text-sm">Número remitente (E.164)</Label>
                <Input
                  value={senderNumber}
                  onChange={(e) => setSenderNumber(e.target.value)}
                  placeholder="+14155238886 (sandbox de Twilio)"
                  className="h-9 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  El sandbox de Twilio usa <code className="bg-muted px-1 rounded">+14155238886</code>. Cuando tengas un número aprobado, reemplázalo.
                </p>
              </div>

              {/* Sandbox toggle */}
              <div className="flex items-center justify-between bg-yellow-500/5 border border-yellow-500/20 rounded-md p-3">
                <div>
                  <Label className="text-sm font-medium">Modo Sandbox</Label>
                  <p className="text-xs text-muted-foreground">
                    Activado mientras esperas aprobación de WhatsApp Business. Solo envía a números que se hayan unido al sandbox.
                  </p>
                </div>
                <Switch checked={sandboxMode} onCheckedChange={setSandboxMode} />
              </div>

              {/* Webhook */}
              <div className="space-y-1">
                <Label className="text-sm">Webhook URL (configurar en Twilio Console)</Label>
                <div className="flex gap-2">
                  <Input value={webhookUrl} readOnly className="h-8 text-xs font-mono" />
                  <Button size="sm" variant="outline" onClick={copyWebhook} className="h-8">
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <a
                  href="https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Configurar en Twilio Sandbox <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Guardando..." : "Guardar configuración"}
              </Button>

              {/* Templates */}
              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-primary" /> Plantillas aprobadas
                  </Label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1"
                    onClick={() => { setEditingTpl(null); setTplDialog(true); }}
                  >
                    <Plus className="w-3 h-3" /> Nueva
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Plantillas pre-aprobadas por Meta. Necesarias para iniciar conversaciones fuera de la ventana de 24h.
                </p>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {templates.length === 0 && (
                    <p className="text-xs text-muted-foreground py-3 text-center">Sin plantillas aún</p>
                  )}
                  {templates.map((t: any) => (
                    <div key={t.id} className="flex items-start gap-2 bg-secondary/30 rounded-md p-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{t.name}</span>
                          <Badge variant="outline" className="text-[9px]">{t.language}</Badge>
                          <Badge variant="secondary" className="text-[9px]">{t.category}</Badge>
                          {t.active ? (
                            <Badge className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">activa</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px]">inactiva</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.body}</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => {
                          if (confirm(`¿Eliminar plantilla "${t.name}"?`)) deleteTpl.mutate(t.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <TemplateDialog
        open={tplDialog}
        onClose={() => { setTplDialog(false); setEditingTpl(null); refetchTpls(); }}
        editing={editingTpl}
      />
    </>
  );
};

// ─── Template Dialog ───
const TemplateDialog = ({
  open, onClose, editing,
}: { open: boolean; onClose: () => void; editing: any }) => {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("es");
  const [category, setCategory] = useState("MARKETING");
  const [body, setBody] = useState("");
  const [contentSid, setContentSid] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name); setLanguage(editing.language); setCategory(editing.category);
      setBody(editing.body); setContentSid(editing.twilio_content_sid || ""); setActive(editing.active);
    } else {
      setName(""); setLanguage("es"); setCategory("MARKETING");
      setBody(""); setContentSid(""); setActive(true);
    }
  }, [editing, open]);

  const handleSave = async () => {
    if (!name.trim() || !body.trim()) {
      toast({ title: "Nombre y cuerpo requeridos", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    // Count {{N}} variables
    const matches = body.match(/\{\{(\d+)\}\}/g) || [];
    const varsCount = new Set(matches).size;

    const payload: any = {
      name: name.trim(),
      language,
      category,
      body: body.trim(),
      twilio_content_sid: contentSid.trim() || null,
      variables_count: varsCount,
      active,
    };

    if (editing) {
      const { error } = await supabase.from("whatsapp_templates" as any).update(payload).eq("id", editing.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    } else {
      payload.created_by = userId;
      const { error } = await supabase.from("whatsapp_templates" as any).insert(payload);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }
    toast({ title: "✅ Plantilla guardada" });
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar plantilla" : "Nueva plantilla WhatsApp"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Nombre interno</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="welcome_lead" className="h-8 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Idioma</Label>
              <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="es" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Categoría</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="MARKETING" className="h-8 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cuerpo (usa {`{{1}}, {{2}}`} para variables)</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hola {{1}}, gracias por unirte a Bullfy. Tu primer paso es..."
              rows={4}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Twilio Content SID (opcional, sólo producción)</Label>
            <Input value={contentSid} onChange={(e) => setContentSid(e.target.value)} placeholder="HXxxxxxxxx..." className="h-8 text-sm font-mono" />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Activa</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsAppSettingsCard;
