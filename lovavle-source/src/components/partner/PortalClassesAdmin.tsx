import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toastUtils";
import { usePortalTiers } from "@/hooks/usePortalTiers";
import {
  Plus, Trash2, Edit, Users, Globe, MapPin, Lock, Eye, EyeOff, Ban,
  Loader2, UserPlus, X, ChevronLeft, ChevronRight, Clock, CalendarClock,
} from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths,
  format, isSameDay, isSameMonth, parseISO,
} from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  portalId: string;
}

interface PortalClass {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  location_type: string;
  location_url: string | null;
  required_tiers: string[] | null;
  capacity: number | null;
  status: string;
}

interface Registration {
  id: string;
  partner_user_id: string;
  registered_at: string;
  partner_users: { nombre: string; email: string };
}

interface PartnerUser { id: string; nombre: string; email: string; }


const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Borrador", variant: "secondary" },
  published: { label: "Publicada", variant: "default" },
  cancelled: { label: "Cancelada", variant: "destructive" },
  completed: { label: "Completada", variant: "outline" },
};

const emptyForm = {
  title: "", description: "", starts_at: "", ends_at: "",
  timezone: "America/Bogota", location_type: "online", location_url: "",
  required_tiers: [] as string[], capacity: "", status: "published",
};

const toLocalInput = (iso: string) => (iso ? iso.slice(0, 16) : "");
const toISO = (local: string) => (local ? new Date(local).toISOString() : null);

const PortalClassesAdmin = ({ portalId }: Props) => {
  const { tiers, labelFor } = usePortalTiers(portalId);
  const activeTiers = tiers.filter(t => t.active);
  const [classes, setClasses] = useState<PortalClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PortalClass | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [attendeesClass, setAttendeesClass] = useState<PortalClass | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [users, setUsers] = useState<PartnerUser[]>([]);
  const [addUser, setAddUser] = useState("");
  const [addingUser, setAddingUser] = useState(false);

  useEffect(() => { fetchClasses(); }, [portalId]);

  const fetchClasses = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("portal_classes").select("*").eq("portal_id", portalId).order("starts_at", { ascending: true });
    setClasses((data as PortalClass[]) || []);
    setLoading(false);
  };

  const fetchRegistrations = async (classId: string) => {
    const { data } = await supabase
      .from("portal_class_registrations")
      .select("id, partner_user_id, registered_at, partner_users(nombre, email)")
      .eq("class_id", classId)
      .order("registered_at", { ascending: false });
    setRegistrations((data as unknown as Registration[]) || []);
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("partner_users").select("id, nombre, email")
      .eq("portal_id", portalId).eq("status", "approved")
      .or("is_host.is.null,is_host.eq.false").order("nombre");
    setUsers((data as PartnerUser[]) || []);
  };

  // ---- Calendar grid ----
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const classesOnDay = (day: Date) => classes.filter(c => isSameDay(parseISO(c.starts_at), day));

  // ---- Form ----
  const openCreate = (day?: Date) => {
    setEditing(null);
    const base = { ...emptyForm };
    if (day) {
      const d = new Date(day); d.setHours(18, 0, 0, 0);
      base.starts_at = toLocalInput(d.toISOString());
    }
    setForm(base);
    setShowForm(true);
  };

  const openEdit = (c: PortalClass) => {
    setEditing(c);
    setForm({
      title: c.title, description: c.description || "",
      starts_at: toLocalInput(c.starts_at), ends_at: c.ends_at ? toLocalInput(c.ends_at) : "",
      timezone: c.timezone, location_type: c.location_type, location_url: c.location_url || "",
      required_tiers: c.required_tiers || [], capacity: c.capacity ? String(c.capacity) : "", status: c.status,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.starts_at) { toast.error("Título y fecha/hora de inicio son requeridos"); return; }
    setSaving(true);
    try {
      const payload = {
        portal_id: portalId, title: form.title.trim(), description: form.description.trim() || null,
        starts_at: toISO(form.starts_at), ends_at: form.ends_at ? toISO(form.ends_at) : null,
        timezone: form.timezone, location_type: form.location_type, location_url: form.location_url.trim() || null,
        required_tiers: form.required_tiers.length > 0 ? form.required_tiers : null,
        capacity: form.capacity ? Number(form.capacity) : null, status: form.status,
        updated_at: new Date().toISOString(),
      };
      const { error } = editing
        ? await supabase.from("portal_classes").update(payload).eq("id", editing.id)
        : await supabase.from("portal_classes").insert(payload as any);
      if (error) throw error;
      toast.success(editing ? "Clase actualizada" : "Clase creada");
      setShowForm(false);
      fetchClasses();
    } catch (e: any) {
      toast.error("Error al guardar: " + e.message);
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta clase?")) return;
    setDeletingId(id);
    const { error } = await supabase.from("portal_classes").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Clase eliminada"); fetchClasses(); }
    setDeletingId(null);
  };

  const quickStatus = async (c: PortalClass, status: string) => {
    const { error } = await supabase.from("portal_classes").update({ status, updated_at: new Date().toISOString() }).eq("id", c.id);
    if (error) toast.error(error.message); else { toast.success("Actualizada"); fetchClasses(); }
  };

  const openAttendees = async (c: PortalClass) => {
    setAttendeesClass(c);
    await fetchRegistrations(c.id);
    await fetchUsers();
  };

  const addRegistration = async () => {
    if (!attendeesClass || !addUser) return;
    setAddingUser(true);
    const { error } = await supabase.from("portal_class_registrations").insert({ class_id: attendeesClass.id, partner_user_id: addUser });
    if (error) {
      if (error.code === "23505") toast.error("El usuario ya está inscrito");
      else if (error.code === "23514" || /CLASS_FULL/i.test(error.message)) toast.error("La clase está llena; aumenta el aforo para inscribir más usuarios");
      else toast.error(error.message);
    }
    else { toast.success("Usuario inscrito"); fetchRegistrations(attendeesClass.id); setAddUser(""); }
    setAddingUser(false);
  };

  const removeRegistration = async (regId: string) => {
    const { error } = await supabase.from("portal_class_registrations").delete().eq("id", regId);
    if (error) toast.error(error.message);
    else if (attendeesClass) fetchRegistrations(attendeesClass.id);
  };

  const toggleTier = (t: string) =>
    setForm(f => ({ ...f, required_tiers: f.required_tiers.includes(t) ? f.required_tiers.filter(x => x !== t) : [...f.required_tiers, t] }));

  const fmtTime = (iso: string) => format(parseISO(iso), "HH:mm");
  const notEnrolled = users.filter(u => !registrations.some(r => r.partner_user_id === u.id));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" /> Calendario de clases
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Programa clases y mira quiénes se inscriben</p>
        </div>
        <Button onClick={() => openCreate(selectedDay || new Date())} className="gap-2">
          <Plus className="w-4 h-4" /> Nueva clase
        </Button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft className="w-4 h-4" /></Button>
        <span className="font-semibold text-foreground capitalize">{format(month, "MMMM yyyy", { locale: es })}</span>
        <Button variant="ghost" size="sm" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="w-4 h-4" /></Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => (
              <div key={d} className="text-[11px] font-medium text-muted-foreground py-1">{d}</div>
            ))}
            {days.map((day, i) => {
              const dayClasses = classesOnDay(day);
              const inMonth = isSameMonth(day, month);
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              const isToday = isSameDay(day, new Date());
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(day)}
                  className={`min-h-[64px] sm:min-h-[84px] rounded-md border p-1 text-left transition-colors ${
                    isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  } ${inMonth ? "" : "opacity-40"}`}
                >
                  <div className={`text-[11px] font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5 mt-0.5">
                    {dayClasses.slice(0, 3).map(c => (
                      <div key={c.id} className={`text-[9px] sm:text-[10px] truncate rounded px-1 py-0.5 ${
                        c.status === "published" ? "bg-primary/20 text-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        {fmtTime(c.starts_at)} {c.title}
                      </div>
                    ))}
                    {dayClasses.length > 3 && <div className="text-[9px] text-muted-foreground">+{dayClasses.length - 3} más</div>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected day panel */}
          {selectedDay && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground capitalize">{format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}</h3>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openCreate(selectedDay)}>
                    <Plus className="w-3.5 h-3.5" /> Crear aquí
                  </Button>
                </div>
                {classesOnDay(selectedDay).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay clases programadas este día.</p>
                ) : (
                  <div className="space-y-2">
                    {classesOnDay(selectedDay).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).map(c => {
                      const st = STATUS_LABELS[c.status] || { label: c.status, variant: "secondary" as const };
                      return (
                        <div key={c.id} className="flex items-start gap-3 rounded-md border border-border p-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-foreground">{c.title}</span>
                              <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                              {c.required_tiers && c.required_tiers.length > 0 && (
                                <Badge variant="outline" className="text-xs gap-1"><Lock className="w-3 h-3" />{c.required_tiers.map(t => labelFor(t)).join(" · ")}</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtTime(c.starts_at)}{c.ends_at ? `–${fmtTime(c.ends_at)}` : ""}</span>
                              <span className="flex items-center gap-1">{c.location_type === "online" ? <Globe className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}{c.location_type === "online" ? "Online" : "Presencial"}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1" onClick={() => openAttendees(c)}><Users className="w-3.5 h-3.5" />Inscritos</Button>
                            {c.status === "draft" && <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-green-500 gap-1" onClick={() => quickStatus(c, "published")}><Eye className="w-3.5 h-3.5" />Publicar</Button>}
                            {c.status === "published" && <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1" onClick={() => quickStatus(c, "draft")}><EyeOff className="w-3.5 h-3.5" />Ocultar</Button>}
                            {c.status !== "cancelled" && c.status !== "completed" && <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-destructive gap-1" onClick={() => quickStatus(c, "cancelled")}><Ban className="w-3.5 h-3.5" />Cancelar</Button>}
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Edit className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(c.id)} disabled={deletingId === c.id}>
                              {deletingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Attendees dialog */}
      {attendeesClass && (
        <Dialog open={true} onOpenChange={() => setAttendeesClass(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="w-4 h-4" />Inscritos — {attendeesClass.title}</DialogTitle></DialogHeader>
            <div className="flex gap-2">
              <Select value={addUser} onValueChange={setAddUser}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Inscribir usuario manualmente..." /></SelectTrigger>
                <SelectContent>{notEnrolled.map(u => <SelectItem key={u.id} value={u.id}>{u.nombre} — {u.email}</SelectItem>)}</SelectContent>
              </Select>
              <Button onClick={addRegistration} disabled={!addUser || addingUser} className="gap-1.5 shrink-0">
                {addingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}Inscribir
              </Button>
            </div>
            {registrations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><Users className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">Aún no hay inscritos</p></div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead>Inscrito</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                <TableBody>
                  {registrations.map(r => (
                    <TableRow key={r.id}>
                      <TableCell><div className="font-medium text-sm">{r.partner_users?.nombre}</div><div className="text-xs text-muted-foreground">{r.partner_users?.email}</div></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(r.registered_at).toLocaleDateString("es")}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeRegistration(r.id)}><X className="w-3.5 h-3.5" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="text-xs text-muted-foreground text-right pt-1">
              {registrations.length} inscrito{registrations.length !== 1 ? "s" : ""}{attendeesClass.capacity ? ` / ${attendeesClass.capacity} cupos` : ""}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create/edit dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!saving) setShowForm(v); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar clase" : "Nueva clase"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5"><Label>Título *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej: Clase de análisis técnico" /></div>
              <div className="space-y-1.5"><Label>Estado</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="draft">Borrador</SelectItem><SelectItem value="published">Publicada</SelectItem><SelectItem value="cancelled">Cancelada</SelectItem><SelectItem value="completed">Completada</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Descripción</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Inicio *</Label><Input type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Fin</Label><Input type="datetime-local" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Modalidad</Label>
                <Select value={form.location_type} onValueChange={v => setForm(f => ({ ...f, location_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="online">Online</SelectItem><SelectItem value="in_person">Presencial</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Cupos (opcional)</Label><Input type="number" min="1" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder="Sin límite" /></div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">{form.location_type === "online" ? <Globe className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}{form.location_type === "online" ? "Link de acceso" : "Dirección"}</Label>
              <Input value={form.location_url} onChange={e => setForm(f => ({ ...f, location_url: e.target.value }))} placeholder={form.location_type === "online" ? "https://meet.google.com/..." : "Av. Ejemplo 123"} />
            </div>
            <div className="space-y-2">
              <Label>Acceso por nivel</Label>
              <p className="text-xs text-muted-foreground">Sin selección = todos los niveles</p>
              <div className="flex gap-2 flex-wrap">
                {activeTiers.map(t => (
                  <button key={t.id} type="button" onClick={() => toggleTier(t.slug)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${form.required_tiers.includes(t.slug) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />}{editing ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortalClassesAdmin;
