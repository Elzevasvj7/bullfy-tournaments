import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toastUtils";
import { usePortalTiers } from "@/hooks/usePortalTiers";
import {
  Globe, MapPin, Lock, Clock, CheckCircle2, Loader2, ExternalLink, Users,
  ChevronLeft, ChevronRight, CalendarClock,
} from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths,
  format, isSameDay, isSameMonth, parseISO,
} from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  portalId: string;
  userId: string;
  userTier: string;
}

interface PortalClass {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location_type: string;
  location_url: string | null;
  required_tiers: string[] | null;
  capacity: number | null;
  status: string;
}

const PortalClassesClient = ({ portalId, userId, userTier }: Props) => {
  const { labelFor } = usePortalTiers(portalId);
  const [classes, setClasses] = useState<PortalClass[]>([]);
  const [registeredIds, setRegisteredIds] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(() => new Date());

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [clsRes, regRes] = await Promise.all([
      supabase.from("portal_classes").select("*").eq("portal_id", portalId).eq("status", "published").order("starts_at", { ascending: true }),
      supabase.from("portal_class_registrations").select("class_id").eq("partner_user_id", userId),
    ]);
    const cls = (clsRes.data as PortalClass[]) || [];
    setClasses(cls);
    setRegisteredIds(new Set((regRes.data || []).map((r: any) => r.class_id)));
    const c: Record<string, number> = {};
    await Promise.all(cls.filter(x => x.capacity).map(async x => {
      const { count } = await supabase.from("portal_class_registrations").select("*", { count: "exact", head: true }).eq("class_id", x.id);
      c[x.id] = count || 0;
    }));
    setCounts(c);
    setLoading(false);
  };

  const hasTierAccess = (c: PortalClass) => !c.required_tiers || c.required_tiers.length === 0 || c.required_tiers.includes(userTier);
  const atCapacity = (c: PortalClass) => !!c.capacity && (counts[c.id] || 0) >= c.capacity;

  const register = async (c: PortalClass) => {
    if (!hasTierAccess(c)) return;
    if (atCapacity(c)) { toast.error("Esta clase ya no tiene cupos"); return; }
    setBusyId(c.id);
    const { error } = await supabase.from("portal_class_registrations").insert({ class_id: c.id, partner_user_id: userId });
    if (error) {
      if (error.code === "23505") toast.info("Ya estás inscrito");
      // Trigger de cupo atómico: check_violation (23514) / CLASS_FULL cuando se
      // llenó el aforo entre el check del cliente y el insert.
      else if (error.code === "23514" || /CLASS_FULL/i.test(error.message)) {
        toast.error("Esta clase acaba de llenarse, ya no hay cupos");
        fetchData();
      }
      else toast.error("Error: " + error.message);
    } else {
      toast.success("¡Te inscribiste a la clase!");
      setRegisteredIds(prev => new Set([...prev, c.id]));
      setCounts(prev => ({ ...prev, [c.id]: (prev[c.id] || 0) + 1 }));
      // C7: notificar (usuario + IB) — best-effort, no bloquea la UI.
      supabase.functions.invoke("portal-notifications", {
        body: { event: "class_registration", portal_id: portalId, class_id: c.id, partner_user_id: userId },
      }).catch(() => {});
    }
    setBusyId(null);
  };

  const unregister = async (c: PortalClass) => {
    setBusyId(c.id);
    const { error } = await supabase.from("portal_class_registrations").delete().eq("class_id", c.id).eq("partner_user_id", userId);
    if (error) toast.error("Error: " + error.message);
    else {
      toast.success("Cancelaste tu inscripción");
      setRegisteredIds(prev => { const n = new Set(prev); n.delete(c.id); return n; });
      setCounts(prev => ({ ...prev, [c.id]: Math.max(0, (prev[c.id] || 1) - 1) }));
    }
    setBusyId(null);
  };

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);
  const classesOnDay = (day: Date) => classes.filter(c => isSameDay(parseISO(c.starts_at), day));
  const fmtTime = (iso: string) => format(parseISO(iso), "HH:mm");

  const myClasses = classes.filter(c => registeredIds.has(c.id) && parseISO(c.ends_at || c.starts_at) >= new Date())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const renderClassRow = (c: PortalClass) => {
    const tierOk = hasTierAccess(c);
    const registered = registeredIds.has(c.id);
    const full = atCapacity(c);
    const past = parseISO(c.ends_at || c.starts_at) < new Date();
    return (
      <div key={c.id} className={`rounded-md border p-3 ${!tierOk ? "opacity-60 border-border" : registered ? "border-green-600/40" : "border-border"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-foreground">{c.title}</span>
              {registered && <Badge className="text-xs bg-green-600 gap-1"><CheckCircle2 className="w-3 h-3" />Inscrito</Badge>}
              {c.required_tiers && c.required_tiers.length > 0 && <Badge variant="outline" className="text-xs gap-1"><Lock className="w-3 h-3" />{c.required_tiers.map(t => labelFor(t)).join(" · ")}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtTime(c.starts_at)}{c.ends_at ? `–${fmtTime(c.ends_at)}` : ""}</span>
              <span className="flex items-center gap-1">{c.location_type === "online" ? <Globe className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}{c.location_type === "online" ? "Online" : "Presencial"}</span>
              {c.capacity && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{counts[c.id] || 0}/{c.capacity}</span>}
            </p>
            {c.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
            {registered && c.location_url && (
              <a href={c.location_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 text-xs mt-1">
                <ExternalLink className="w-3 h-3" />Unirse a la clase
              </a>
            )}
          </div>
          <div className="shrink-0">
            {!tierOk ? (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Lock className="w-3 h-3" />Exclusivo</span>
            ) : past ? (
              <span className="text-[11px] text-muted-foreground">Finalizada</span>
            ) : registered ? (
              <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => unregister(c)}>
                {busyId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Cancelar"}
              </Button>
            ) : (
              <Button size="sm" disabled={busyId === c.id || full} onClick={() => register(c)}>
                {busyId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : full ? "Sin cupos" : "Asistir"}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2"><CalendarClock className="w-5 h-5 text-primary" />Calendario de clases</h2>
        <p className="text-sm text-muted-foreground mt-1">Programa tu asistencia a las clases disponibles</p>
      </div>

      {/* Mis próximas clases */}
      {myClasses.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Mis próximas clases</h3>
            {myClasses.map(renderClassRow)}
          </CardContent>
        </Card>
      )}

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft className="w-4 h-4" /></Button>
        <span className="font-semibold text-foreground capitalize">{format(month, "MMMM yyyy", { locale: es })}</span>
        <Button variant="ghost" size="sm" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="w-4 h-4" /></Button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => <div key={d} className="text-[11px] font-medium text-muted-foreground py-1">{d}</div>)}
        {days.map((day, i) => {
          const dayClasses = classesOnDay(day);
          const inMonth = isSameMonth(day, month);
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          const isToday = isSameDay(day, new Date());
          return (
            <button key={i} onClick={() => setSelectedDay(day)}
              className={`min-h-[56px] sm:min-h-[76px] rounded-md border p-1 text-left transition-colors ${isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"} ${inMonth ? "" : "opacity-40"}`}>
              <div className={`text-[11px] font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>{format(day, "d")}</div>
              <div className="space-y-0.5 mt-0.5">
                {dayClasses.slice(0, 2).map(c => (
                  <div key={c.id} className={`text-[9px] sm:text-[10px] truncate rounded px-1 py-0.5 ${registeredIds.has(c.id) ? "bg-green-600/30 text-foreground" : "bg-primary/20 text-foreground"}`}>
                    {fmtTime(c.starts_at)} {c.title}
                  </div>
                ))}
                {dayClasses.length > 2 && <div className="text-[9px] text-muted-foreground">+{dayClasses.length - 2}</div>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected day classes */}
      {selectedDay && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-foreground capitalize">{format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}</h3>
            {classesOnDay(selectedDay).length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay clases este día.</p>
            ) : (
              <div className="space-y-2">
                {classesOnDay(selectedDay).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).map(renderClassRow)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {classes.length === 0 && (
        <Card><CardContent className="py-12 text-center">
          <CalendarClock className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No hay clases programadas por ahora</p>
          <p className="text-sm text-muted-foreground mt-1">Vuelve más tarde para ver el calendario</p>
        </CardContent></Card>
      )}
    </div>
  );
};

export default PortalClassesClient;
