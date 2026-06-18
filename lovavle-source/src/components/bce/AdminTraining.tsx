import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Shield, Plus, Pencil, Trash2, MessageSquare, ScrollText, Loader2, Save, Sparkles,
} from "lucide-react";
import AITrainer from "./AITrainer";

/* ── Types ── */
interface Objection {
  id: string;
  texto_objecion: string;
  respuesta_logica: string;
  respuesta_emocional: string;
  reframe: string;
  contra_pregunta: string;
  cierre_sugerido: string;
  categoria: string | null;
  source: string | null;
}

interface Script {
  id: string;
  flow_id: string;
  fase: string;
  texto_corto: string;
  orden: number;
}

interface Flow {
  id: string;
  nombre: string;
  tipo_lead: string;
  objetivo: string;
}

const FASES = ["apertura", "diagnostico", "presentacion", "objeciones", "cierre"];

/* ── Objection Form ── */
const emptyObjection = (): Omit<Objection, "id"> => ({
  texto_objecion: "",
  respuesta_logica: "",
  respuesta_emocional: "",
  reframe: "",
  contra_pregunta: "",
  cierre_sugerido: "",
  categoria: null,
  source: "manual",
});

const AdminTraining = () => {
  const [tab, setTab] = useState("ai-trainer");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">
          Entrenamiento del Sistema
        </h3>
        <Badge variant="outline" className="text-xs border-primary/30 text-primary">
          Master Admin
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Administra las objeciones, respuestas y scripts que alimentan al motor de cierre.
      </p>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="ai-trainer" className="gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Entrenador IA
          </TabsTrigger>
          <TabsTrigger value="objections" className="gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> Objeciones
          </TabsTrigger>
          <TabsTrigger value="scripts" className="gap-1.5">
            <ScrollText className="w-3.5 h-3.5" /> Scripts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai-trainer" className="mt-4">
          <AITrainer />
        </TabsContent>
        <TabsContent value="objections" className="mt-4">
          <ObjectionsManager />
        </TabsContent>
        <TabsContent value="scripts" className="mt-4">
          <ScriptsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

/* ═══════════════════════════════════════════════════
   OBJECTIONS MANAGER
   ═══════════════════════════════════════════════════ */
const ObjectionsManager = () => {
  const [objections, setObjections] = useState<Objection[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Objection | null>(null);
  const [form, setForm] = useState(emptyObjection());
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    const { data } = await supabase
      .from("bce_objections")
      .select("*")
      .order("texto_objecion");
    setObjections(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyObjection());
    setDialogOpen(true);
  };

  const openEdit = (o: Objection) => {
    setEditing(o);
    setForm({
      texto_objecion: o.texto_objecion,
      respuesta_logica: o.respuesta_logica,
      respuesta_emocional: o.respuesta_emocional,
      reframe: o.reframe,
      contra_pregunta: o.contra_pregunta,
      cierre_sugerido: o.cierre_sugerido,
      categoria: o.categoria,
      source: o.source,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.texto_objecion.trim()) {
      toast({ title: "Error", description: "El texto de la objeción es obligatorio", variant: "destructive" });
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from("bce_objections")
        .update(form)
        .eq("id", editing.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Actualizado", description: "Objeción actualizada correctamente" });
      }
    } else {
      const { error } = await supabase.from("bce_objections").insert(form);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Creado", description: "Objeción agregada correctamente" });
      }
    }
    setSaving(false);
    setDialogOpen(false);
    fetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta objeción?")) return;
    const { error } = await supabase.from("bce_objections").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Eliminado" });
      fetch();
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{objections.length} objeción(es) registradas</p>
        <Button size="sm" onClick={openNew}><Plus className="w-3.5 h-3.5 mr-1" /> Nueva Objeción</Button>
      </div>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {objections.map(o => (
          <Card key={o.id} className="bg-card/60">
            <CardContent className="py-3 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <p className="font-medium text-foreground text-sm">"{o.texto_objecion}"</p>
                <div className="flex gap-2 flex-wrap">
                  {o.categoria && <Badge variant="secondary" className="text-[10px]">{o.categoria}</Badge>}
                  <Badge variant="outline" className="text-[10px]">{o.source ?? "manual"}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                  <p><span className="font-medium text-foreground/70">Reframe:</span> {o.reframe.slice(0, 60)}…</p>
                  <p><span className="font-medium text-foreground/70">Contra-pregunta:</span> {o.contra_pregunta.slice(0, 60)}…</p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(o)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(o.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Objeción" : "Nueva Objeción"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Texto de la objeción *</label>
              <Input value={form.texto_objecion} onChange={e => setForm(f => ({ ...f, texto_objecion: e.target.value }))} placeholder='"No tengo dinero"' />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Categoría</label>
              <Input value={form.categoria ?? ""} onChange={e => setForm(f => ({ ...f, categoria: e.target.value || null }))} placeholder="confianza, dinero, competencia…" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Respuesta lógica *</label>
                <Textarea rows={3} value={form.respuesta_logica} onChange={e => setForm(f => ({ ...f, respuesta_logica: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Respuesta emocional *</label>
                <Textarea rows={3} value={form.respuesta_emocional} onChange={e => setForm(f => ({ ...f, respuesta_emocional: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Reframe *</label>
              <Textarea rows={2} value={form.reframe} onChange={e => setForm(f => ({ ...f, reframe: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Contra-pregunta *</label>
              <Textarea rows={2} value={form.contra_pregunta} onChange={e => setForm(f => ({ ...f, contra_pregunta: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Cierre sugerido *</label>
              <Textarea rows={2} value={form.cierre_sugerido} onChange={e => setForm(f => ({ ...f, cierre_sugerido: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
              {editing ? "Guardar cambios" : "Crear objeción"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ═══════════════════════════════════════════════════
   SCRIPTS MANAGER
   ═══════════════════════════════════════════════════ */
const ScriptsManager = () => {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFlow, setSelectedFlow] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Script | null>(null);
  const [form, setForm] = useState({ flow_id: "", fase: "apertura", texto_corto: "", orden: 0 });
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    const [flowRes, scriptRes] = await Promise.all([
      supabase.from("bce_call_flows").select("*").order("tipo_lead"),
      supabase.from("bce_scripts").select("*").order("orden"),
    ]);
    setFlows(flowRes.data ?? []);
    setScripts(scriptRes.data ?? []);
    if (!selectedFlow && flowRes.data?.length) setSelectedFlow(flowRes.data[0].id);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = scripts.filter(s => s.flow_id === selectedFlow);
  const grouped = FASES.map(f => ({ fase: f, items: filtered.filter(s => s.fase === f) }));

  const openNew = (fase: string) => {
    setEditing(null);
    const maxOrden = filtered.filter(s => s.fase === fase).reduce((m, s) => Math.max(m, s.orden), 0);
    setForm({ flow_id: selectedFlow, fase, texto_corto: "", orden: maxOrden + 1 });
    setDialogOpen(true);
  };

  const openEdit = (s: Script) => {
    setEditing(s);
    setForm({ flow_id: s.flow_id, fase: s.fase, texto_corto: s.texto_corto, orden: s.orden });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.texto_corto.trim()) {
      toast({ title: "Error", description: "El texto del script es obligatorio", variant: "destructive" });
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from("bce_scripts").update(form).eq("id", editing.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Actualizado" });
    } else {
      const { error } = await supabase.from("bce_scripts").insert(form);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Script creado" });
    }
    setSaving(false);
    setDialogOpen(false);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este script?")) return;
    await supabase.from("bce_scripts").delete().eq("id", id);
    fetchAll();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Flow selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Flujo:</label>
        <Select value={selectedFlow} onValueChange={setSelectedFlow}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Selecciona un flujo" />
          </SelectTrigger>
          <SelectContent>
            {flows.map(f => (
              <SelectItem key={f.id} value={f.id}>
                {f.nombre} ({f.tipo_lead} → {f.objetivo})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Phases */}
      {selectedFlow && grouped.map(g => (
        <Card key={g.fase} className="bg-card/60">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm capitalize text-foreground">{g.fase}</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => openNew(g.fase)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Agregar
            </Button>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {g.items.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Sin scripts en esta fase</p>
            )}
            {g.items.map(s => (
              <div key={s.id} className="flex items-center gap-2 group">
                <span className="text-xs text-muted-foreground w-6 text-right">{s.orden}.</span>
                <p className="text-sm text-foreground flex-1">{s.texto_corto}</p>
                <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => openEdit(s)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => handleDelete(s.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Script" : "Nuevo Script"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Fase</label>
              <Select value={form.fase} onValueChange={v => setForm(f => ({ ...f, fase: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FASES.map(f => <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Orden</label>
              <Input type="number" value={form.orden} onChange={e => setForm(f => ({ ...f, orden: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Texto del script *</label>
              <Textarea rows={3} value={form.texto_corto} onChange={e => setForm(f => ({ ...f, texto_corto: e.target.value }))} placeholder="Frase corta para el BD…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
              {editing ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTraining;
