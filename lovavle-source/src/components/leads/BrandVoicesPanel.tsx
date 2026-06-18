import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mic2, Loader2, Trash2, Plus, Play, Pencil, RefreshCw } from "lucide-react";
import { toast } from "@/lib/toastUtils";

interface VoiceTemplate {
  id: string;
  title: string;
  text: string;
  created_at: string;
}

interface BrandVoice {
  id: string;
  voice_id: string;
  voice_name: string;
  alias: string;
  preview_url?: string;
  templates: VoiceTemplate[];
  // legacy
  name?: string;
  description?: string;
  sample_text?: string;
}

interface ElevenVoice {
  voice_id: string;
  name: string;
  preview_url?: string;
}

function normalize(v: any): BrandVoice {
  const templates: VoiceTemplate[] = Array.isArray(v.templates)
    ? v.templates
    : v.sample_text
    ? [{ id: crypto.randomUUID(), title: "Default", text: v.sample_text, created_at: new Date().toISOString() }]
    : [];
  return {
    id: v.id,
    voice_id: v.voice_id,
    voice_name: v.voice_name || v.name || "",
    alias: v.alias || v.name || "",
    preview_url: v.preview_url,
    templates,
  };
}

const BrandVoicesPanel = () => {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [alias, setAlias] = useState("");
  const [saving, setSaving] = useState(false);

  // template dialog state
  const [tplDialogOpen, setTplDialogOpen] = useState(false);
  const [tplVoiceId, setTplVoiceId] = useState<string | null>(null);
  const [tplEditingId, setTplEditingId] = useState<string | null>(null);
  const [tplTitle, setTplTitle] = useState("");
  const [tplText, setTplText] = useState("");

  const [previewLoading, setPreviewLoading] = useState<string | null>(null);

  const { data: cfgRow } = useQuery({
    queryKey: ["lead-system-config-voices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("integration_settings")
        .select("*")
        .eq("service_name", "lead_system_config")
        .maybeSingle();
      return data;
    },
  });

  const brandVoices: BrandVoice[] = useMemo(
    () => (((cfgRow?.config as any)?.brand_voices ?? []) as any[]).map(normalize),
    [cfgRow]
  );

  const { data: elevenVoices = [], isLoading: loadingVoices, refetch: refetchVoices } = useQuery({
    queryKey: ["elevenlabs-voices"],
    queryFn: async (): Promise<ElevenVoice[]> => {
      const { data, error } = await supabase.functions.invoke("elevenlabs-voice-design", {
        body: { action: "list_voices" },
      });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || "Error listando voces");
      return data.voices ?? [];
    },
    enabled: showAdd,
  });

  const availableVoices = useMemo(() => {
    const used = new Set(brandVoices.map((v) => v.voice_id));
    return elevenVoices.filter((v) => !used.has(v.voice_id));
  }, [elevenVoices, brandVoices]);

  async function persist(next: BrandVoice[]) {
    const config = { ...((cfgRow?.config as any) ?? {}), brand_voices: next };
    if (cfgRow) {
      const { error } = await supabase.from("integration_settings").update({ config }).eq("id", cfgRow.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("integration_settings")
        .insert({ service_name: "lead_system_config", enabled: true, config });
      if (error) throw error;
    }
    qc.invalidateQueries({ queryKey: ["lead-system-config-voices"] });
    qc.invalidateQueries({ queryKey: ["lead-system-config"] });
    qc.invalidateQueries({ queryKey: ["telegram-brand-voices"] });
  }

  async function addVoice() {
    if (!selectedVoiceId) return toast.error("Selecciona una voz");
    if (!alias.trim()) return toast.error("Alias requerido");
    const ev = elevenVoices.find((v) => v.voice_id === selectedVoiceId);
    if (!ev) return toast.error("Voz no encontrada");
    setSaving(true);
    try {
      const newVoice: BrandVoice = {
        id: crypto.randomUUID(),
        voice_id: ev.voice_id,
        voice_name: ev.name,
        alias: alias.trim(),
        preview_url: ev.preview_url,
        templates: [],
      };
      await persist([...brandVoices, newVoice]);
      setShowAdd(false);
      setSelectedVoiceId("");
      setAlias("");
      toast.success("Voz añadida");
    } catch (e: any) {
      toast.error(e.message || "Error guardando");
    } finally {
      setSaving(false);
    }
  }

  async function removeVoice(id: string) {
    if (!confirm("¿Eliminar esta voz y todas sus plantillas?")) return;
    try {
      await persist(brandVoices.filter((v) => v.id !== id));
      toast.success("Voz eliminada");
    } catch (e: any) {
      toast.error(e.message || "Error");
    }
  }

  function openNewTemplate(voiceId: string) {
    setTplVoiceId(voiceId);
    setTplEditingId(null);
    setTplTitle("");
    setTplText("");
    setTplDialogOpen(true);
  }

  function openEditTemplate(voiceId: string, tpl: VoiceTemplate) {
    setTplVoiceId(voiceId);
    setTplEditingId(tpl.id);
    setTplTitle(tpl.title);
    setTplText(tpl.text);
    setTplDialogOpen(true);
  }

  async function saveTemplate() {
    if (!tplVoiceId) return;
    if (!tplTitle.trim() || !tplText.trim()) return toast.error("Título y texto requeridos");
    const next = brandVoices.map((v) => {
      if (v.id !== tplVoiceId) return v;
      let templates = v.templates;
      if (tplEditingId) {
        templates = templates.map((t) =>
          t.id === tplEditingId ? { ...t, title: tplTitle.trim(), text: tplText.trim() } : t
        );
      } else {
        templates = [
          ...templates,
          { id: crypto.randomUUID(), title: tplTitle.trim(), text: tplText.trim(), created_at: new Date().toISOString() },
        ];
      }
      return { ...v, templates };
    });
    try {
      await persist(next);
      setTplDialogOpen(false);
      toast.success(tplEditingId ? "Plantilla actualizada" : "Plantilla creada");
    } catch (e: any) {
      toast.error(e.message || "Error");
    }
  }

  async function deleteTemplate(voiceId: string, tplId: string) {
    if (!confirm("¿Eliminar plantilla?")) return;
    const next = brandVoices.map((v) =>
      v.id === voiceId ? { ...v, templates: v.templates.filter((t) => t.id !== tplId) } : v
    );
    try {
      await persist(next);
      toast.success("Plantilla eliminada");
    } catch (e: any) {
      toast.error(e.message || "Error");
    }
  }

  async function playTemplate(voice_id: string, text: string, key: string) {
    setPreviewLoading(key);
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-voice-design", {
        body: { action: "tts_preview", voice_id, text },
      });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || "Error generando audio");
      const audio = new Audio(`data:${data.media_type || "audio/mpeg"};base64,${data.audio_base_64}`);
      await audio.play();
    } catch (e: any) {
      toast.error(e.message || "Error reproduciendo");
    } finally {
      setPreviewLoading(null);
    }
  }

  // Auto-migration: if any stored voice still has legacy `sample_text` and no `templates`, persist normalized once
  useEffect(() => {
    if (!cfgRow) return;
    const raw = (cfgRow.config as any)?.brand_voices ?? [];
    const needsMigration = raw.some((v: any) => !Array.isArray(v.templates) && (v.sample_text || v.name));
    if (needsMigration) {
      persist(brandVoices).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfgRow]);

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Mic2 className="w-4 h-4 text-primary" /> Voces de Marca (ElevenLabs)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Selecciona voces de tu cuenta de ElevenLabs y guarda múltiples plantillas de mensajes por voz para enviar notas de voz por Telegram.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {brandVoices.length === 0 && !showAdd && (
          <p className="text-xs text-muted-foreground italic">Aún no hay voces. Añade la primera desde tu cuenta de ElevenLabs.</p>
        )}

        {brandVoices.map((v) => (
          <div key={v.id} className="border border-border rounded-lg bg-muted/30 p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{v.alias}</p>
                <p className="text-[11px] text-muted-foreground">
                  {v.voice_name} · <span className="font-mono">{v.voice_id}</span>
                </p>
                {v.preview_url && (
                  <audio controls src={v.preview_url} className="mt-2 h-8 w-full max-w-sm" />
                )}
              </div>
              <Button size="icon" variant="ghost" onClick={() => removeVoice(v.id)} className="text-destructive shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="border-t border-border pt-2 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Plantillas ({v.templates.length})</Label>
                <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => openNewTemplate(v.id)}>
                  <Plus className="w-3 h-3" /> Nueva plantilla
                </Button>
              </div>
              {v.templates.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">Sin plantillas aún.</p>
              ) : (
                <div className="space-y-1.5">
                  {v.templates.map((t) => {
                    const key = `${v.id}:${t.id}`;
                    return (
                      <div key={t.id} className="flex items-start gap-2 p-2 rounded border border-border bg-background">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium">{t.title}</p>
                          <p className="text-[11px] text-muted-foreground line-clamp-2">{t.text}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => playTemplate(v.voice_id, t.text, key)}
                            disabled={previewLoading === key}
                            title="Probar"
                          >
                            {previewLoading === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditTemplate(v.id, t)} title="Editar">
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => deleteTemplate(v.id, t.id)}
                            title="Eliminar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {showAdd ? (
          <div className="space-y-3 p-3 border border-primary/30 rounded-lg bg-primary/5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Voz de ElevenLabs</Label>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => refetchVoices()} title="Refrescar">
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
            <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId} disabled={loadingVoices}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder={loadingVoices ? "Cargando..." : "Selecciona una voz"} />
              </SelectTrigger>
              <SelectContent>
                {availableVoices.length === 0 && !loadingVoices ? (
                  <div className="p-2 text-xs text-muted-foreground">No hay voces nuevas disponibles.</div>
                ) : (
                  availableVoices.map((v) => (
                    <SelectItem key={v.voice_id} value={v.voice_id}>
                      {v.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {selectedVoiceId && (() => {
              const ev = elevenVoices.find((x) => x.voice_id === selectedVoiceId);
              return ev?.preview_url ? <audio controls src={ev.preview_url} className="w-full h-8" /> : null;
            })()}

            <div>
              <Label className="text-xs">Alias interno</Label>
              <Input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Bullfy Comercial" className="text-sm" />
            </div>

            <div className="flex gap-2">
              <Button onClick={addVoice} disabled={saving} size="sm">
                {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                Añadir voz
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setShowAdd(false); setSelectedVoiceId(""); setAlias(""); }}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)} className="gap-1.5">
            <Plus className="w-3 h-3" /> Añadir voz desde ElevenLabs
          </Button>
        )}
      </CardContent>

      <Dialog open={tplDialogOpen} onOpenChange={setTplDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tplEditingId ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Título</Label>
              <Input value={tplTitle} onChange={(e) => setTplTitle(e.target.value)} placeholder="Saludo inicial" className="text-sm" />
            </div>
            <div>
              <Label className="text-xs">Mensaje</Label>
              <Textarea
                value={tplText}
                onChange={(e) => setTplText(e.target.value)}
                rows={5}
                placeholder="Hola, soy un asesor de Bullfy..."
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTplDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveTemplate}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default BrandVoicesPanel;
