import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Mail, MessageSquare, Phone, Pencil, Trash2, ChevronRight, Workflow } from "lucide-react";
import { toast } from "sonner";

type Sequence = {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  is_active: boolean;
};
type Step = {
  id: string;
  sequence_id: string;
  step_order: number;
  day_offset: number;
  channel: string;
  subject: string | null;
  content: string;
  is_active: boolean;
};

const CHANNEL_ICON: Record<string, any> = { email: Mail, whatsapp: MessageSquare, call_task: Phone };

export default function NurturingPanel() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [activeSeq, setActiveSeq] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [seqDialog, setSeqDialog] = useState<Partial<Sequence> | null>(null);
  const [stepDialog, setStepDialog] = useState<Partial<Step> | null>(null);

  const loadSequences = async () => {
    setLoading(true);
    const { data } = await supabase.from("lead_nurturing_sequences").select("*").order("created_at", { ascending: false });
    setSequences((data ?? []) as Sequence[]);
    if (!activeSeq && data?.[0]) setActiveSeq(data[0].id);
    setLoading(false);
  };
  const loadSteps = async (seqId: string) => {
    const { data } = await supabase.from("lead_nurturing_steps").select("*").eq("sequence_id", seqId).order("step_order");
    setSteps((data ?? []) as Step[]);
  };

  useEffect(() => { loadSequences(); }, []);
  useEffect(() => { if (activeSeq) loadSteps(activeSeq); }, [activeSeq]);

  const saveSequence = async () => {
    if (!seqDialog?.name) { toast.error("Nombre requerido"); return; }
    const payload = {
      name: seqDialog.name,
      description: seqDialog.description ?? null,
      trigger_type: seqDialog.trigger_type ?? "manual",
      is_active: seqDialog.is_active ?? true,
    };
    const { error } = seqDialog.id
      ? await supabase.from("lead_nurturing_sequences").update(payload).eq("id", seqDialog.id)
      : await supabase.from("lead_nurturing_sequences").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Guardado");
    setSeqDialog(null);
    loadSequences();
  };
  const deleteSequence = async (id: string) => {
    if (!confirm("¿Eliminar secuencia y todos sus pasos?")) return;
    await supabase.from("lead_nurturing_sequences").delete().eq("id", id);
    loadSequences();
    if (activeSeq === id) setActiveSeq(null);
  };
  const toggleSeq = async (s: Sequence) => {
    await supabase.from("lead_nurturing_sequences").update({ is_active: !s.is_active }).eq("id", s.id);
    loadSequences();
  };

  const saveStep = async () => {
    if (!stepDialog || !activeSeq) return;
    const payload = {
      sequence_id: activeSeq,
      step_order: stepDialog.step_order ?? steps.length + 1,
      day_offset: stepDialog.day_offset ?? 0,
      channel: stepDialog.channel ?? "email",
      subject: stepDialog.subject ?? null,
      content: stepDialog.content ?? "",
      is_active: stepDialog.is_active ?? true,
    };
    const { error } = stepDialog.id
      ? await supabase.from("lead_nurturing_steps").update(payload).eq("id", stepDialog.id)
      : await supabase.from("lead_nurturing_steps").insert(payload);
    if (error) { toast.error(error.message); return; }
    setStepDialog(null);
    loadSteps(activeSeq);
  };
  const deleteStep = async (id: string) => {
    await supabase.from("lead_nurturing_steps").delete().eq("id", id);
    if (activeSeq) loadSteps(activeSeq);
  };

  return (
    <div className="grid md:grid-cols-[300px_1fr] gap-4">
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2"><Workflow className="w-4 h-4 text-primary" /> Secuencias</CardTitle>
          <Button size="sm" onClick={() => setSeqDialog({ is_active: true, trigger_type: "manual" })}><Plus className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : sequences.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Sin secuencias.</p>
          ) : sequences.map((s) => (
            <div key={s.id} className={`p-2 rounded-lg border cursor-pointer ${activeSeq === s.id ? "border-primary bg-primary/10" : "border-border bg-secondary/30"}`} onClick={() => setActiveSeq(s.id)}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground">{s.trigger_type}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Switch checked={s.is_active} onCheckedChange={() => toggleSeq(s)} />
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                </div>
              </div>
              <div className="flex gap-1 mt-1">
                <Button size="sm" variant="ghost" className="h-6 px-2" onClick={(e) => { e.stopPropagation(); setSeqDialog(s); }}><Pencil className="w-3 h-3" /></Button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-destructive" onClick={(e) => { e.stopPropagation(); deleteSequence(s.id); }}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Pasos {activeSeq && `(${steps.length})`}</CardTitle>
          {activeSeq && <Button size="sm" onClick={() => setStepDialog({ step_order: steps.length + 1, day_offset: 0, channel: "email", is_active: true })}><Plus className="w-4 h-4" /> Paso</Button>}
        </CardHeader>
        <CardContent className="space-y-2">
          {!activeSeq ? <p className="text-sm text-muted-foreground text-center py-8">Selecciona una secuencia.</p> :
            steps.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Aún sin pasos.</p> :
            steps.map((st) => {
              const Icon = CHANNEL_ICON[st.channel] ?? Mail;
              return (
                <div key={st.id} className="p-3 rounded-lg border border-border bg-secondary/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Badge variant="outline">#{st.step_order}</Badge>
                        <Icon className="w-3 h-3" /> {st.channel}
                        <Badge variant="secondary">D+{st.day_offset}</Badge>
                        {!st.is_active && <Badge variant="outline" className="text-muted-foreground">off</Badge>}
                      </div>
                      {st.subject && <div className="text-xs mt-1 font-medium">{st.subject}</div>}
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{st.content}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setStepDialog(st)}><Pencil className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteStep(st.id)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>

      <Dialog open={!!seqDialog} onOpenChange={(o) => !o && setSeqDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{seqDialog?.id ? "Editar" : "Nueva"} secuencia</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nombre" value={seqDialog?.name ?? ""} onChange={(e) => setSeqDialog({ ...seqDialog, name: e.target.value })} />
            <Textarea placeholder="Descripción" value={seqDialog?.description ?? ""} onChange={(e) => setSeqDialog({ ...seqDialog, description: e.target.value })} />
            <Select value={seqDialog?.trigger_type ?? "manual"} onValueChange={(v) => setSeqDialog({ ...seqDialog, trigger_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="lead_created">Al crear lead</SelectItem>
                <SelectItem value="stage_changed">Cambio de stage</SelectItem>
                <SelectItem value="no_contact">Sin contacto</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2"><Switch checked={seqDialog?.is_active ?? true} onCheckedChange={(v) => setSeqDialog({ ...seqDialog, is_active: v })} /> Activa</div>
          </div>
          <DialogFooter><Button onClick={saveSequence}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!stepDialog} onOpenChange={(o) => !o && setStepDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{stepDialog?.id ? "Editar" : "Nuevo"} paso</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Orden" value={stepDialog?.step_order ?? ""} onChange={(e) => setStepDialog({ ...stepDialog, step_order: parseInt(e.target.value) })} />
              <Input type="number" placeholder="Día (offset)" value={stepDialog?.day_offset ?? ""} onChange={(e) => setStepDialog({ ...stepDialog, day_offset: parseInt(e.target.value) })} />
            </div>
            <Select value={stepDialog?.channel ?? "email"} onValueChange={(v) => setStepDialog({ ...stepDialog, channel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="call_task">Tarea llamada</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Asunto (email)" value={stepDialog?.subject ?? ""} onChange={(e) => setStepDialog({ ...stepDialog, subject: e.target.value })} />
            <Textarea rows={5} placeholder="Contenido / mensaje" value={stepDialog?.content ?? ""} onChange={(e) => setStepDialog({ ...stepDialog, content: e.target.value })} />
            <div className="flex items-center gap-2"><Switch checked={stepDialog?.is_active ?? true} onCheckedChange={(v) => setStepDialog({ ...stepDialog, is_active: v })} /> Activo</div>
          </div>
          <DialogFooter><Button onClick={saveStep}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
