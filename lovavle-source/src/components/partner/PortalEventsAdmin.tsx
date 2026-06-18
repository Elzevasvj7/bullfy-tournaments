import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toastUtils";
import { usePortalTiers } from "@/hooks/usePortalTiers";
import { usePortalBrand, brandText } from "@/lib/portalBrand";
import * as UpChunk from "@mux/upchunk";
import MuxPlayer from "@mux/mux-player-react";
import {
  Plus, Trash2, Edit, Users, Calendar, MapPin, Globe, Lock,
  Eye, EyeOff, Loader2, UserPlus, X, Clock, Ban,
  ImageIcon, Video, AlertCircle
} from "lucide-react";

// commerceEnabled: Bullfy eCommerce del portal. Si OFF, no se pueden poner precios
// (los eventos se publican gratis); se ocultan los campos de precio/gratuito.
interface PortalEventsAdminProps {
  portalId: string;
  commerceEnabled?: boolean;
}

interface PortalEvent {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  event_type: string;
  location_type: string;
  location_url: string | null;
  is_free: boolean;
  price_usd: number;
  required_tiers: string[] | null;
  capacity: number | null;
  status: string;
  created_at: string;
  media_type: string;
  video_thumbnail_path: string | null;
  mux_upload_id: string | null;
  mux_asset_id: string | null;
  mux_playback_id: string | null;
  mux_status: string | null;
  mux_error_message: string | null;
}

interface Registration {
  id: string;
  partner_user_id: string;
  registered_at: string;
  granted_by: string;
  partner_users: { nombre: string; email: string };
}

interface PartnerUser {
  id: string;
  nombre: string;
  email: string;
}


const EVENT_TYPES = [
  { value: "webinar", label: "Webinar" },
  { value: "workshop", label: "Workshop" },
  { value: "live_session", label: "Sesión en Vivo" },
  { value: "other", label: "Otro" },
];

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Borrador", variant: "secondary" },
  published: { label: "Publicado", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  completed: { label: "Completado", variant: "outline" },
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const emptyForm = {
  title: "",
  description: "",
  starts_at: "",
  ends_at: "",
  timezone: "America/Bogota",
  event_type: "webinar",
  location_type: "online",
  location_url: "",
  is_free: true,
  price_usd: 0,
  required_tiers: [] as string[],
  capacity: "",
  status: "published",
};

const toLocalDatetimeInput = (iso: string) => {
  if (!iso) return "";
  return iso.slice(0, 16);
};

const toISO = (localDt: string) => {
  if (!localDt) return null;
  return new Date(localDt).toISOString();
};

const getThumbUrl = (path: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/academy-thumbnails/${path}`;

// Miniatura a mostrar en la lista: imagen de portada, miniatura del video, o
// el auto-thumbnail que genera Mux a partir del playback.
const getEventThumb = (ev: PortalEvent): string | null => {
  if (ev.media_type === "image") return ev.cover_image_url;
  if (ev.media_type === "video") {
    if (ev.video_thumbnail_path) return getThumbUrl(ev.video_thumbnail_path);
    if (ev.mux_status === "ready" && ev.mux_playback_id) {
      return `https://image.mux.com/${ev.mux_playback_id}/thumbnail.jpg?time=5`;
    }
  }
  return null;
};

const PortalEventsAdmin = ({ portalId, commerceEnabled = false }: PortalEventsAdminProps) => {
  const { tiers, labelFor } = usePortalTiers(portalId);
  const { isWhiteLabel } = usePortalBrand();
  const activeTiers = tiers.filter(t => t.active);
  const [events, setEvents] = useState<PortalEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<PortalEvent | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [users, setUsers] = useState<PartnerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PortalEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [selectedAddUser, setSelectedAddUser] = useState("");
  const [form, setForm] = useState(emptyForm);

  // Media dialog state
  const [mediaEvent, setMediaEvent] = useState<PortalEvent | null>(null);
  const [mediaType, setMediaType] = useState<"none" | "image" | "video">("none");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const thumbFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchEvents(); }, []);

  // Polling while a video is processing
  useEffect(() => {
    if (!mediaEvent || mediaEvent.mux_status !== "preparing") return;
    const id = window.setInterval(async () => {
      const { data } = await supabase
        .from("portal_events")
        .select("mux_status, mux_playback_id, mux_error_message")
        .eq("id", mediaEvent.id)
        .maybeSingle();
      if (!data || data.mux_status === mediaEvent.mux_status) return;
      const upd = {
        mux_status: data.mux_status as string,
        mux_playback_id: data.mux_playback_id as string | null,
        mux_error_message: data.mux_error_message as string | null,
      };
      setMediaEvent(prev => prev ? { ...prev, ...upd } : null);
      setEvents(prev => prev.map(e => e.id === mediaEvent.id ? { ...e, ...upd } : e));
    }, 5000);
    return () => window.clearInterval(id);
  }, [mediaEvent?.id, mediaEvent?.mux_status]);

  const fetchEvents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("portal_events")
      .select("*")
      .eq("portal_id", portalId)
      .order("starts_at", { ascending: true });
    setEvents((data as PortalEvent[]) || []);
    setLoading(false);
  };

  const fetchRegistrations = async (eventId: string) => {
    const { data } = await supabase
      .from("portal_event_registrations")
      .select("id, partner_user_id, registered_at, granted_by, partner_users(nombre, email)")
      .eq("event_id", eventId)
      .order("registered_at", { ascending: false });
    setRegistrations((data as unknown as Registration[]) || []);
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("partner_users")
      .select("id, nombre, email")
      .eq("portal_id", portalId)
      .eq("status", "approved")
      .or("is_host.is.null,is_host.eq.false")
      .order("nombre");
    setUsers((data as PartnerUser[]) || []);
  };

  const openCreate = () => {
    setEditingEvent(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (ev: PortalEvent) => {
    setEditingEvent(ev);
    setForm({
      title: ev.title,
      description: ev.description || "",
      starts_at: toLocalDatetimeInput(ev.starts_at),
      ends_at: ev.ends_at ? toLocalDatetimeInput(ev.ends_at) : "",
      timezone: ev.timezone,
      event_type: ev.event_type,
      location_type: ev.location_type,
      location_url: ev.location_url || "",
      is_free: ev.is_free,
      price_usd: ev.price_usd,
      required_tiers: ev.required_tiers || [],
      capacity: ev.capacity ? String(ev.capacity) : "",
      status: ev.status,
    });
    setShowForm(true);
  };

  const openMedia = (ev: PortalEvent) => {
    setMediaEvent(ev);
    setMediaType((ev.media_type as "none" | "image" | "video") || "none");
  };

  const saveEvent = async () => {
    if (!form.title.trim() || !form.starts_at) {
      toast.error("Título y fecha de inicio son requeridos");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        portal_id: portalId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        starts_at: toISO(form.starts_at),
        ends_at: form.ends_at ? toISO(form.ends_at) : null,
        timezone: form.timezone,
        event_type: form.event_type,
        location_type: form.location_type,
        location_url: form.location_url.trim() || null,
        is_free: form.is_free,
        price_usd: form.is_free ? 0 : Number(form.price_usd),
        required_tiers: form.required_tiers.length > 0 ? form.required_tiers : null,
        capacity: form.capacity ? Number(form.capacity) : null,
        status: form.status,
        updated_at: new Date().toISOString(),
      };

      if (editingEvent) {
        const { error } = await supabase.from("portal_events").update(payload).eq("id", editingEvent.id);
        if (error) throw error;
        toast.success("Evento actualizado");
      } else {
        const { error } = await supabase.from("portal_events").insert(payload as any);
        if (error) throw error;
        toast.success("Evento creado");
      }
      setShowForm(false);
      fetchEvents();
    } catch (err: any) {
      toast.error("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (id: string) => {
    if (!confirm("¿Eliminar este evento? Esta acción no se puede deshacer.")) return;
    setDeletingId(id);
    const { error } = await supabase.from("portal_events").delete().eq("id", id);
    if (error) toast.error("Error al eliminar: " + error.message);
    else {
      toast.success("Evento eliminado");
      if (selectedEvent?.id === id) setSelectedEvent(null);
      fetchEvents();
    }
    setDeletingId(null);
  };

  const quickStatus = async (ev: PortalEvent, status: string) => {
    const { error } = await supabase.from("portal_events").update({ status, updated_at: new Date().toISOString() }).eq("id", ev.id);
    if (error) toast.error(error.message);
    else {
      toast.success(status === "published" ? "Evento publicado" : status === "cancelled" ? "Evento cancelado" : "Actualizado");
      fetchEvents();
      if (selectedEvent?.id === ev.id) setSelectedEvent({ ...selectedEvent, status });
    }
  };

  const openAttendees = async (ev: PortalEvent) => {
    setSelectedEvent(ev);
    await fetchRegistrations(ev.id);
    await fetchUsers();
  };

  const addManualRegistration = async () => {
    if (!selectedEvent || !selectedAddUser) return;
    setAddingUserId(selectedAddUser);
    const { error } = await supabase.from("portal_event_registrations").insert({
      event_id: selectedEvent.id,
      partner_user_id: selectedAddUser,
      granted_by: "admin_manual",
    });
    if (error) {
      if (error.code === "23505") toast.error("El usuario ya está inscrito");
      // El trigger de cupo atómico también aplica a inscripciones manuales.
      else if (error.code === "23514" || /EVENT_FULL/i.test(error.message)) {
        toast.error("El evento está lleno; aumenta el aforo para inscribir más usuarios");
      } else toast.error(error.message);
    } else {
      toast.success("Usuario inscrito correctamente");
      fetchRegistrations(selectedEvent.id);
      setSelectedAddUser("");
    }
    setAddingUserId(null);
  };

  const removeRegistration = async (regId: string) => {
    const { error } = await supabase.from("portal_event_registrations").delete().eq("id", regId);
    if (error) toast.error(error.message);
    else {
      toast.success("Inscripción eliminada");
      if (selectedEvent) fetchRegistrations(selectedEvent.id);
    }
  };

  const toggleTier = (tier: string) => {
    setForm(f => ({
      ...f,
      required_tiers: f.required_tiers.includes(tier)
        ? f.required_tiers.filter(t => t !== tier)
        : [...f.required_tiers, tier],
    }));
  };

  // --- Media handlers ---

  const handleVideoUpload = async (file: File) => {
    if (!mediaEvent) return;
    if (file.size > 500 * 1024 * 1024) {
      toast.error("El video no puede superar los 500MB");
      return;
    }
    setUploadingVideo(true);
    setUploadProgress(0);
    try {
      // El EF valida el usuario con auth.getUser(token). functions.invoke a veces
      // envía la anon key (token sin usuario) cuando el access_token de la sesión
      // no está adjunto/refrescado, lo que hacía que el EF respondiera
      // "No autenticado". getSession() refresca el token si está vencido; pasamos
      // el Authorization explícito para garantizar un token de usuario válido.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Tu sesión expiró. Recarga la página e inicia sesión de nuevo.");
        setUploadingVideo(false);
        return;
      }
      const { data: muxData, error: muxErr } = await supabase.functions.invoke(
        "portal-event-mux-upload",
        {
          body: { event_id: mediaEvent.id },
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );
      if (muxErr || !muxData?.ok || !muxData?.upload_url) {
        toast.error(muxData?.error || muxErr?.message || "Error preparando la subida del video");
        setUploadingVideo(false);
        return;
      }

      const upload = UpChunk.createUpload({
        endpoint: muxData.upload_url,
        file,
        chunkSize: 5120,
      });

      upload.on("error", (event: any) => {
        console.error("UpChunk error", event.detail);
        toast.error("Error subiendo video: " + (event.detail?.message || "desconocido"));
        setUploadingVideo(false);
        setUploadProgress(0);
      });

      upload.on("progress", (event: any) => {
        setUploadProgress(Math.round(event.detail));
      });

      upload.on("success", () => {
        toast.success("Video subido. Mux lo está procesando (1-5 min)…");
        setUploadingVideo(false);
        setUploadProgress(0);
        const upd = { mux_status: "preparing", media_type: "video" };
        setMediaEvent(prev => prev ? { ...prev, ...upd } : null);
        setEvents(prev => prev.map(e => e.id === mediaEvent.id ? { ...e, ...upd } : e));
      });
    } catch (e: any) {
      toast.error("Error: " + e.message);
      setUploadingVideo(false);
    }
  };

  const handleCoverUpload = async (file: File) => {
    if (!mediaEvent) return;
    if (!file.type.startsWith("image/")) { toast.error("Solo se permiten imágenes"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("La imagen no puede superar 5MB"); return; }
    setUploadingCover(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `events/${mediaEvent.id}/cover.${ext}`;
      const { error: storErr } = await supabase.storage
        .from("academy-thumbnails")
        .upload(path, file, { upsert: true });
      if (storErr) throw storErr;
      const { data: urlData } = supabase.storage.from("academy-thumbnails").getPublicUrl(path);
      const { error: updErr } = await supabase.from("portal_events").update({
        cover_image_url: urlData.publicUrl,
        media_type: "image",
        updated_at: new Date().toISOString(),
      }).eq("id", mediaEvent.id);
      if (updErr) throw updErr;
      const upd = { cover_image_url: urlData.publicUrl, media_type: "image" };
      setMediaEvent(prev => prev ? { ...prev, ...upd } : null);
      setEvents(prev => prev.map(e => e.id === mediaEvent.id ? { ...e, ...upd } : e));
      toast.success("Imagen de portada actualizada");
    } catch (e: any) {
      toast.error("Error al subir la imagen: " + e.message);
    } finally {
      setUploadingCover(false);
    }
  };

  const handleThumbUpload = async (file: File) => {
    if (!mediaEvent) return;
    if (!file.type.startsWith("image/")) { toast.error("Solo se permiten imágenes"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("La imagen no puede superar 5MB"); return; }
    setUploadingThumb(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `events/${mediaEvent.id}/thumb.${ext}`;
      const { error: storErr } = await supabase.storage
        .from("academy-thumbnails")
        .upload(path, file, { upsert: true });
      if (storErr) throw storErr;
      const { error: updErr } = await supabase.from("portal_events").update({
        video_thumbnail_path: path,
        updated_at: new Date().toISOString(),
      }).eq("id", mediaEvent.id);
      if (updErr) throw updErr;
      setMediaEvent(prev => prev ? { ...prev, video_thumbnail_path: path } : null);
      setEvents(prev => prev.map(e => e.id === mediaEvent.id ? { ...e, video_thumbnail_path: path } : e));
      toast.success("Miniatura actualizada");
    } catch (e: any) {
      toast.error("Error al subir la miniatura: " + e.message);
    } finally {
      setUploadingThumb(false);
    }
  };

  const handleRemoveMedia = async () => {
    if (!mediaEvent) return;
    if (!confirm("¿Quitar la media de este evento?")) return;
    const cleared = {
      media_type: "none",
      cover_image_url: null as string | null,
      video_thumbnail_path: null as string | null,
      mux_upload_id: null as string | null,
      mux_asset_id: null as string | null,
      mux_playback_id: null as string | null,
      mux_status: null as string | null,
      mux_error_message: null as string | null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("portal_events").update(cleared).eq("id", mediaEvent.id);
    if (error) { toast.error(error.message); return; }
    setMediaEvent(prev => prev ? { ...prev, ...cleared } : null);
    setEvents(prev => prev.map(e => e.id === mediaEvent.id ? { ...e, ...cleared } : e));
    setMediaType("none");
    toast.success("Media eliminada");
  };

  // --- Render helpers ---

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" });

  const isUpcoming = (ev: PortalEvent) => new Date(ev.starts_at) > new Date();

  const notEnrolled = users.filter(u => !registrations.some(r => r.partner_user_id === u.id));

  const mediaIcon = (ev: PortalEvent) => {
    if (ev.media_type === "image") return <span title="Imagen"><ImageIcon className="w-3 h-3 text-blue-400" /></span>;
    if (ev.media_type === "video") {
      if (ev.mux_status === "ready") return <span title="Video listo"><Video className="w-3 h-3 text-green-400" /></span>;
      if (ev.mux_status === "preparing") return <span title="Video procesando"><Loader2 className="w-3 h-3 animate-spin text-yellow-400" /></span>;
      if (ev.mux_status === "errored") return <span title="Error en video"><AlertCircle className="w-3 h-3 text-destructive" /></span>;
      return <Video className="w-3 h-3 text-muted-foreground" />;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Gestión de Eventos</h2>
          <p className="text-sm text-muted-foreground mt-1">Crea y administra eventos para tus usuarios</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Nuevo Evento
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground font-medium">Aún no hay eventos</p>
            <p className="text-sm text-muted-foreground mt-1">Crea tu primer evento para tus usuarios</p>
            <Button onClick={openCreate} className="mt-4 gap-2">
              <Plus className="w-4 h-4" /> Crear Evento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map(ev => {
            const st = STATUS_LABELS[ev.status] || { label: ev.status, variant: "secondary" as const };
            return (
              <Card key={ev.id} className={ev.status === "cancelled" ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {getEventThumb(ev) && (
                      <div className="w-40 h-24 shrink-0 rounded-md overflow-hidden bg-black/40 flex items-center justify-center relative">
                        <img
                          src={getEventThumb(ev)!}
                          alt={ev.title}
                          className="max-w-full max-h-full object-contain"
                          loading="lazy"
                        />
                        {ev.media_type === "video" && ev.mux_status === "ready" && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                              <Video className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{ev.title}</h3>
                        <Badge variant={st.variant}>{st.label}</Badge>
                        {ev.is_free
                          ? <Badge variant="outline" className="text-green-500 border-green-500/30">Gratuito</Badge>
                          : <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">${ev.price_usd} USD</Badge>
                        }
                        {ev.required_tiers && ev.required_tiers.length > 0 && (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Lock className="w-3 h-3" />
                            {ev.required_tiers.map(t => labelFor(t)).join(" · ")}
                          </Badge>
                        )}
                        {isUpcoming(ev) && (
                          <Badge variant="outline" className="text-blue-400 border-blue-400/30 text-xs gap-1">
                            <Clock className="w-3 h-3" />Próximo
                          </Badge>
                        )}
                        {mediaIcon(ev) && (
                          <span className="flex items-center gap-1">{mediaIcon(ev)}</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(ev.starts_at)}
                        {ev.ends_at ? ` → ${formatDate(ev.ends_at)}` : ""}
                      </p>
                      {ev.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{ev.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                      <Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5 text-xs" onClick={() => openAttendees(ev)}>
                        <Users className="w-3.5 h-3.5" /> Asistentes
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5 text-xs" onClick={() => openMedia(ev)}>
                        <ImageIcon className="w-3.5 h-3.5" /> Media
                      </Button>
                      {ev.status === "draft" && (
                        <Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5 text-xs text-green-500" onClick={() => quickStatus(ev, "published")}>
                          <Eye className="w-3.5 h-3.5" /> Publicar
                        </Button>
                      )}
                      {ev.status === "published" && (
                        <Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5 text-xs" onClick={() => quickStatus(ev, "draft")}>
                          <EyeOff className="w-3.5 h-3.5" /> Borrador
                        </Button>
                      )}
                      {ev.status !== "cancelled" && ev.status !== "completed" && (
                        <Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5 text-xs text-destructive" onClick={() => quickStatus(ev, "cancelled")}>
                          <Ban className="w-3.5 h-3.5" /> Cancelar
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(ev)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                        onClick={() => deleteEvent(ev.id)}
                        disabled={deletingId === ev.id}
                      >
                        {deletingId === ev.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Attendees dialog */}
      {selectedEvent && (
        <Dialog open={true} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Asistentes — {selectedEvent.title}
              </DialogTitle>
            </DialogHeader>

            <div className="flex gap-2">
              <Select value={selectedAddUser} onValueChange={setSelectedAddUser}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Seleccionar usuario para inscribir..." />
                </SelectTrigger>
                <SelectContent>
                  {notEnrolled.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nombre} — {u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={addManualRegistration}
                disabled={!selectedAddUser || !!addingUserId}
                className="gap-1.5 shrink-0"
              >
                {addingUserId ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Inscribir
              </Button>
            </div>

            {registrations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aún no hay inscritos</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Inscrito</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map(reg => (
                    <TableRow key={reg.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{reg.partner_users?.nombre}</div>
                        <div className="text-xs text-muted-foreground">{reg.partner_users?.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {reg.granted_by === "admin_manual" ? "Admin" : reg.granted_by === "free" ? "Gratuito" : reg.granted_by}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(reg.registered_at).toLocaleDateString("es")}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeRegistration(reg.id)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="text-xs text-muted-foreground text-right pt-1">
              {registrations.length} inscrito{registrations.length !== 1 ? "s" : ""}
              {selectedEvent.capacity ? ` / ${selectedEvent.capacity} cupos` : ""}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Media dialog */}
      {mediaEvent && (
        <Dialog open={true} onOpenChange={() => setMediaEvent(null)}>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Media — {mediaEvent.title}
              </DialogTitle>
            </DialogHeader>

            {/* Type selector */}
            <div className="space-y-2">
              <Label>Tipo de media de promoción</Label>
              <div className="flex gap-2">
                {([
                  { key: "none", label: "Ninguna", Icon: X },
                  { key: "image", label: "Imagen", Icon: ImageIcon },
                  { key: "video", label: "Video", Icon: Video },
                ] as const).map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMediaType(key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                      mediaType === key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* None */}
            {mediaType === "none" && (
              <div className="py-6 text-center">
                <ImageIcon className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Sin media de promoción</p>
                <p className="text-xs text-muted-foreground mt-1">Selecciona "Imagen" o "Video" para añadir contenido visual al evento</p>
                {(mediaEvent.cover_image_url || mediaEvent.mux_status) && (
                  <Button variant="ghost" size="sm" className="text-destructive gap-1.5 mt-3" onClick={handleRemoveMedia}>
                    <Trash2 className="w-3.5 h-3.5" /> Confirmar eliminación de media
                  </Button>
                )}
              </div>
            )}

            {/* Image */}
            {mediaType === "image" && (
              <div className="space-y-3">
                {mediaEvent.cover_image_url && (
                  <div className="h-40 overflow-hidden rounded-lg border border-border bg-black/40 flex items-center justify-center">
                    <img src={mediaEvent.cover_image_url} alt="" className="max-w-full max-h-full object-contain" />
                  </div>
                )}
                <input
                  ref={coverFileRef}
                  type="file" accept="image/*" className="hidden"
                  onChange={async e => {
                    const f = e.target.files?.[0];
                    if (f) await handleCoverUpload(f);
                    if (coverFileRef.current) coverFileRef.current.value = "";
                  }}
                />
                <Button
                  onClick={() => coverFileRef.current?.click()}
                  disabled={uploadingCover}
                  variant="outline" className="w-full gap-2"
                >
                  {uploadingCover ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                  {uploadingCover ? "Subiendo..." : mediaEvent.cover_image_url ? "Cambiar imagen" : "Subir imagen de portada"}
                </Button>
                <p className="text-xs text-muted-foreground">Recomendado: 1200×630px · Máx 5MB</p>
                {mediaEvent.cover_image_url && (
                  <Button variant="ghost" size="sm" className="text-destructive gap-1.5" onClick={handleRemoveMedia}>
                    <Trash2 className="w-3.5 h-3.5" /> Quitar imagen
                  </Button>
                )}
              </div>
            )}

            {/* Video */}
            {mediaType === "video" && (
              <div className="space-y-4">
                {/* Current video status / player */}
                {mediaEvent.mux_status === "ready" && mediaEvent.mux_playback_id ? (
                  <div className="aspect-video rounded-lg overflow-hidden bg-black">
                    <MuxPlayer
                      playbackId={mediaEvent.mux_playback_id}
                      metadata={{ video_id: mediaEvent.id, video_title: mediaEvent.title }}
                      autoPlay={false}
                      playsInline
                      style={{ width: "100%", height: "100%" }}
                    />
                  </div>
                ) : mediaEvent.mux_status === "preparing" ? (
                  <div className="aspect-video rounded-lg bg-muted flex flex-col items-center justify-center gap-2 px-4 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Procesando tu video, no cierres esta ventana</p>
                    <p className="text-xs text-muted-foreground">Puede tardar unos minutos · se actualizará automáticamente</p>
                  </div>
                ) : mediaEvent.mux_status === "errored" ? (
                  <div className="rounded-lg bg-destructive/10 p-4 text-center space-y-1">
                    <AlertCircle className="w-6 h-6 mx-auto text-destructive" />
                    <p className="text-sm font-medium text-destructive">Error al procesar el video</p>
                    {mediaEvent.mux_error_message && (
                      <p className="text-xs text-muted-foreground">{mediaEvent.mux_error_message}</p>
                    )}
                  </div>
                ) : null}

                {/* Thumbnail */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" /> Miniatura del video
                  </Label>
                  {mediaEvent.video_thumbnail_path && (
                    <div className="h-28 overflow-hidden rounded-md border border-border bg-black/40 flex items-center justify-center">
                      <img
                        src={getThumbUrl(mediaEvent.video_thumbnail_path)}
                        alt=""
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  )}
                  <input
                    ref={thumbFileRef}
                    type="file" accept="image/*" className="hidden"
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      if (f) await handleThumbUpload(f);
                      if (thumbFileRef.current) thumbFileRef.current.value = "";
                    }}
                  />
                  <Button
                    onClick={() => thumbFileRef.current?.click()}
                    disabled={uploadingThumb}
                    variant="outline" size="sm" className="gap-2"
                  >
                    {uploadingThumb ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                    {uploadingThumb ? "Subiendo..." : mediaEvent.video_thumbnail_path ? "Cambiar miniatura" : "Subir miniatura"}
                  </Button>
                  <p className="text-xs text-muted-foreground">Recomendado: 16:9 · Máx 5MB</p>
                </div>

                {/* Video upload (always show unless actively preparing) */}
                {mediaEvent.mux_status !== "preparing" && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5" />
                      {mediaEvent.mux_status === "ready" ? "Reemplazar video" : "Subir video de promoción"}
                    </Label>
                    <p className="text-xs text-muted-foreground">Máx 5 minutos · Máx 500MB · Se recomienda MP4 1080p</p>
                    {uploadingVideo && (
                      <div className="space-y-1">
                        <Progress value={uploadProgress} className="h-2" />
                        <p className="text-xs text-muted-foreground">{uploadProgress}% — No cierres esta ventana</p>
                      </div>
                    )}
                    <input
                      ref={videoFileRef}
                      type="file" accept="video/*" className="hidden"
                      onChange={async e => {
                        const f = e.target.files?.[0];
                        if (f) await handleVideoUpload(f);
                        if (videoFileRef.current) videoFileRef.current.value = "";
                      }}
                    />
                    <Button
                      onClick={() => videoFileRef.current?.click()}
                      disabled={uploadingVideo}
                      variant="outline" className="w-full gap-2"
                    >
                      {uploadingVideo
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Subiendo {uploadProgress}%</>
                        : <><Video className="w-4 h-4" />Seleccionar video</>
                      }
                    </Button>
                  </div>
                )}

                {/* Remove */}
                {(mediaEvent.mux_status || mediaEvent.video_thumbnail_path) && (
                  <Button variant="ghost" size="sm" className="text-destructive gap-1.5" onClick={handleRemoveMedia}>
                    <Trash2 className="w-3.5 h-3.5" /> Quitar media del evento
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Create / Edit form */}
      <Dialog open={showForm} onOpenChange={v => { if (!saving) setShowForm(v); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Editar Evento" : "Nuevo Evento"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Título *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej: Webinar de Estrategias Forex" />
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="published">Publicado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                    <SelectItem value="completed">Completado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción del evento..." rows={3} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fecha y hora de inicio *</Label>
                <Input type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha y hora de fin</Label>
                <Input type="datetime-local" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo de evento</Label>
                <Select value={form.event_type} onValueChange={v => setForm(f => ({ ...f, event_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Modalidad</Label>
                <Select value={form.location_type} onValueChange={v => setForm(f => ({ ...f, location_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="in_person">Presencial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                {form.location_type === "online" ? <Globe className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                {form.location_type === "online" ? "Link de acceso (Zoom, Meet, etc.)" : "Dirección"}
              </Label>
              <Input
                value={form.location_url}
                onChange={e => setForm(f => ({ ...f, location_url: e.target.value }))}
                placeholder={form.location_type === "online" ? "https://meet.google.com/..." : "Av. Ejemplo 123, Ciudad"}
              />
            </div>

            {commerceEnabled ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Switch
                    id="is-free"
                    checked={form.is_free}
                    onCheckedChange={v => setForm(f => ({ ...f, is_free: v, price_usd: v ? 0 : f.price_usd }))}
                  />
                  <Label htmlFor="is-free">Evento gratuito</Label>
                </div>
                {!form.is_free && (
                  <div className="space-y-1.5">
                    <Label>Precio (USD)</Label>
                    <Input
                      type="number" min="0" step="0.01"
                      value={form.price_usd}
                      onChange={e => setForm(f => ({ ...f, price_usd: parseFloat(e.target.value) || 0 }))}
                      placeholder="29.99"
                      className="max-w-[160px]"
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground rounded-md border border-border bg-muted/40 p-2">
                Sin {brandText(isWhiteLabel, "Bullfy eCommerce")} activo, tus eventos se publican <strong>gratis</strong> para tus usuarios. Para cobrar entradas, pide activar el eCommerce.
              </p>
            )}

            <div className="space-y-2">
              <Label>Acceso por tier</Label>
              <p className="text-xs text-muted-foreground">Sin selección = accesible para todos los tiers</p>
              <div className="flex gap-2 flex-wrap">
                {activeTiers.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTier(t.slug)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                      form.required_tiers.includes(t.slug)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Cupos máximos (opcional)</Label>
              <Input
                type="number" min="1"
                value={form.capacity}
                onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
                placeholder="Sin límite"
                className="max-w-[160px]"
              />
            </div>

            {editingEvent && (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-md p-2">
                Para añadir imagen o video de promoción, cierra este formulario y usa el botón "Media" en la lista.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={saveEvent} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingEvent ? "Guardar cambios" : "Crear Evento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortalEventsAdmin;
