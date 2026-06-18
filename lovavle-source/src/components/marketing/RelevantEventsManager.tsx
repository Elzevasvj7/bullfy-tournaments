import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/lib/toastUtils";
import { CalendarClock, Plus, Send, Trash2, Edit, Loader2, Mail, Users, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  SUPPORTED_TIMEZONES,
  REMINDER_OPTIONS,
  detectBrowserTimezone,
  parseEmailList,
} from "@/lib/timezones";

interface RelevantEvent {
  id: string;
  title: string;
  topic: string;
  description: string | null;
  starts_at: string;
  duration_minutes: number;
  timezone: string;
  relevance_score: number;
  selected_reminders: number[];
  recipient_mode: "all" | "manual";
  manual_recipients: string[] | null;
  status: string;
  notification_sent_at: string | null;
  created_at: string;
}

const RelevantEventsManager = () => {
  const { user, isAdmin, isGlobalAdmin } = useAuth();
  const [events, setEvents] = useState<RelevantEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(60);
  const [timezone, setTimezone] = useState(detectBrowserTimezone());
  const [relevance, setRelevance] = useState(5);
  const [selectedReminders, setSelectedReminders] = useState<number[]>([600, 120, 10]);
  const [recipientMode, setRecipientMode] = useState<"all" | "manual">("all");
  const [manualEmailsRaw, setManualEmailsRaw] = useState("");

  const emailParse = parseEmailList(manualEmailsRaw);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("relevant_events")
      .select("*")
      .order("starts_at", { ascending: true });
    if (error) toast.error("Error cargando eventos: " + error.message);
    else setEvents((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setTopic("");
    setDescription("");
    setDate("");
    setTime("10:00");
    setDuration(60);
    setTimezone(detectBrowserTimezone());
    setRelevance(5);
    setSelectedReminders([600, 120, 10]);
    setRecipientMode("all");
    setManualEmailsRaw("");
  };

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (ev: RelevantEvent) => {
    setEditingId(ev.id);
    setTitle(ev.title);
    setTopic(ev.topic);
    setDescription(ev.description || "");
    const d = new Date(ev.starts_at);
    setDate(d.toISOString().slice(0, 10));
    setTime(d.toTimeString().slice(0, 5));
    setDuration(ev.duration_minutes);
    setTimezone(ev.timezone);
    setRelevance(ev.relevance_score);
    setSelectedReminders(ev.selected_reminders || []);
    setRecipientMode(ev.recipient_mode);
    setManualEmailsRaw((ev.manual_recipients || []).join("\n"));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !title.trim() || !topic.trim() || !date) {
      toast.error("Completa título, tema y fecha");
      return;
    }
    if (recipientMode === "manual" && emailParse.valid.length === 0) {
      toast.error("Agrega al menos un correo válido en la lista manual");
      return;
    }

    const startsAt = new Date(`${date}T${time}:00`).toISOString();

    const payload = {
      title: title.trim(),
      topic: topic.trim(),
      description: description.trim() || null,
      starts_at: startsAt,
      duration_minutes: duration,
      timezone,
      relevance_score: relevance,
      selected_reminders: selectedReminders,
      recipient_mode: recipientMode,
      manual_recipients: recipientMode === "manual" ? emailParse.valid : [],
      created_by: user.id,
    };

    if (editingId) {
      const { error } = await supabase.from("relevant_events").update(payload).eq("id", editingId);
      if (error) {
        toast.error("Error: " + error.message);
        return;
      }
      toast.success("Evento actualizado");
    } else {
      const { error } = await supabase.from("relevant_events").insert(payload);
      if (error) {
        toast.error("Error: " + error.message);
        return;
      }
      toast.success("Evento creado");
    }

    setDialogOpen(false);
    resetForm();
    load();
  };

  const handleSend = async (id: string) => {
    setSending(id);
    try {
      const { data, error } = await supabase.functions.invoke("notify-relevant-event", {
        body: { eventId: id, action: "send" },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error || "Error desconocido");
      toast.success(`Notificación enviada a ${data?.sent ?? 0} de ${data?.total ?? 0} destinatarios`);
      load();
    } catch (err: any) {
      toast.error("Error enviando: " + err.message);
    } finally {
      setSending(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("¿Cancelar este evento? Se enviará un email de cancelación a los destinatarios.")) return;
    setSending(id);
    try {
      await supabase.from("relevant_events").update({ status: "cancelled" }).eq("id", id);
      const { error } = await supabase.functions.invoke("notify-relevant-event", {
        body: { eventId: id, action: "cancel" },
      });
      if (error) throw error;
      toast.success("Evento cancelado y notificado");
      load();
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setSending(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este evento permanentemente?")) return;
    const { error } = await supabase.from("relevant_events").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Evento eliminado");
      load();
    }
  };

  const canDelete = isAdmin || isGlobalAdmin;

  const relevanceBadge = (score: number) => {
    if (score >= 9) return { label: "🔥 Alta", className: "bg-destructive/20 text-destructive border-destructive/30" };
    if (score >= 7) return { label: "⭐ Importante", className: "bg-orange-500/20 text-orange-500 border-orange-500/30" };
    if (score >= 4) return { label: "📌 Relevante", className: "bg-primary/20 text-primary border-primary/30" };
    return { label: "📍 Info", className: "bg-muted text-muted-foreground" };
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-primary" />
              Eventos Relevantes
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Programa eventos importantes y notifica a Bullfy Family por calendario (.ics) con recordatorios automáticos.
            </p>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" /> Nuevo Evento
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarClock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay eventos creados todavía</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((ev) => {
                const badge = relevanceBadge(ev.relevance_score);
                const isPast = new Date(ev.starts_at) < new Date();
                return (
                  <div
                    key={ev.id}
                    className="border border-border rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-semibold text-foreground">{ev.title}</h4>
                        <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
                        {ev.status === "sent" && <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/30">✓ Enviado</Badge>}
                        {ev.status === "cancelled" && <Badge variant="outline" className="bg-destructive/20 text-destructive">Cancelado</Badge>}
                        {isPast && ev.status === "scheduled" && <Badge variant="outline" className="text-muted-foreground">Pasado</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <em>{ev.topic}</em>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        📅 {format(new Date(ev.starts_at), "PPP 'a las' HH:mm", { locale: es })} ({ev.timezone}) · {ev.duration_minutes}min · {ev.selected_reminders?.length || 0} recordatorios
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ev.recipient_mode === "all" ? (
                          <><Users className="inline w-3 h-3 mr-1" /> Todos los Bullfy Family</>
                        ) : (
                          <><Mail className="inline w-3 h-3 mr-1" /> {ev.manual_recipients?.length || 0} correos manuales</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        onClick={() => handleSend(ev.id)}
                        disabled={sending === ev.id || ev.status === "cancelled"}
                        className="gap-1"
                      >
                        {sending === ev.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        {ev.status === "sent" ? "Reenviar" : "Enviar"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(ev)} className="gap-1">
                        <Edit className="w-3 h-3" /> Editar
                      </Button>
                      {ev.status !== "cancelled" && (
                        <Button size="sm" variant="outline" onClick={() => handleCancel(ev.id)} disabled={sending === ev.id}>
                          Cancelar
                        </Button>
                      )}
                      {canDelete && (
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(ev.id)} className="gap-1">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar evento" : "Nuevo evento relevante"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Lanzamiento producto Q2" />
            </div>
            <div>
              <Label>Tema *</Label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ej: Estrategia de marketing" />
            </div>
            <div>
              <Label>Descripción (opcional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha *</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <Label>Hora *</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Duración (minutos)</Label>
                <Input type="number" min={5} value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 60)} />
              </div>
              <div>
                <Label>Zona horaria</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Relevancia: {relevance}/10 {relevanceBadge(relevance).label}</Label>
              <Slider value={[relevance]} min={1} max={10} step={1} onValueChange={(v) => setRelevance(v[0])} className="mt-2" />
            </div>
            <div>
              <Label className="mb-2 block">Recordatorios (se enviarán en el calendario del receptor)</Label>
              <div className="grid grid-cols-2 gap-2 border border-border rounded-lg p-3">
                {REMINDER_OPTIONS.map((opt) => (
                  <label key={opt.minutes} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={selectedReminders.includes(opt.minutes)}
                      onCheckedChange={(c) => {
                        if (c) setSelectedReminders([...selectedReminders, opt.minutes].sort((a, b) => b - a));
                        else setSelectedReminders(selectedReminders.filter((m) => m !== opt.minutes));
                      }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Destinatarios</Label>
              <RadioGroup value={recipientMode} onValueChange={(v) => setRecipientMode(v as any)}>
                <div className="flex items-center gap-2 border border-border rounded-lg p-3">
                  <RadioGroupItem value="all" id="rec-all" />
                  <Label htmlFor="rec-all" className="cursor-pointer flex items-center gap-2">
                    <Users className="w-4 h-4" /> Todos los usuarios Bullfy Family
                  </Label>
                </div>
                <div className="flex items-start gap-2 border border-border rounded-lg p-3">
                  <RadioGroupItem value="manual" id="rec-manual" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="rec-manual" className="cursor-pointer flex items-center gap-2">
                      <Mail className="w-4 h-4" /> Lista manual de correos
                    </Label>
                    {recipientMode === "manual" && (
                      <div className="mt-2">
                        <Textarea
                          value={manualEmailsRaw}
                          onChange={(e) => setManualEmailsRaw(e.target.value)}
                          placeholder="correo1@ejemplo.com&#10;correo2@ejemplo.com&#10;..."
                          rows={5}
                          className="font-mono text-xs"
                        />
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <span className="text-green-500">✓ {emailParse.valid.length} válidos</span>
                          {emailParse.invalid.length > 0 && (
                            <span className="text-destructive flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> {emailParse.invalid.length} inválidos
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </RadioGroup>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>{editingId ? "Actualizar" : "Crear evento"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RelevantEventsManager;
