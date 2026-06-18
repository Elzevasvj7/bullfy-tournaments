import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Users, Heart, GraduationCap, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toastUtils";
import BullfyFamilyInviteSelector from "./BullfyFamilyInviteSelector";
import WaitingRoomConfig from "./WaitingRoomConfig";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUPPORTED_TIMEZONES, detectBrowserTimezone } from "@/lib/timezones";

export type MeetingMode = "meeting" | "bullfy_family" | "webinar_pro";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: MeetingMode;
  portalId?: string;
  onCreated: (roomId: string) => void;
}

const MODE_META: Record<MeetingMode, { label: string; icon: typeof Users; tagline: string }> = {
  meeting: { label: "Meeting", icon: Users, tagline: "Reunión interactiva con asistentes" },
  bullfy_family: { label: "Bullfy Family", icon: Heart, tagline: "Sala privada para miembros family" },
  webinar_pro: { label: "Webinar Pro", icon: GraduationCap, tagline: "Webinar con sub-salas y controles avanzados" },
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

const MeetingWizardDialog = ({ open, onOpenChange, mode, portalId, onCreated }: Props) => {
  const { user } = useAuth();
  const meta = MODE_META[mode];
  const Icon = meta.icon;

  const [step, setStep] = useState<"form" | "waiting_room">("form");
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduleNow, setScheduleNow] = useState(true);
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState("10:00");
  const [useDefaultWaiting, setUseDefaultWaiting] = useState(true);
  const [autoApprove, setAutoApprove] = useState(false);
  const [familyInvitedIds, setFamilyInvitedIds] = useState<string[]>([]);
  const [notifyFamily, setNotifyFamily] = useState(true);
  const [enablePublicGuestLink, setEnablePublicGuestLink] = useState(false);
  const [creating, setCreating] = useState(false);
  const [scheduledTimezone, setScheduledTimezone] = useState<string>(detectBrowserTimezone());

  const reset = () => {
    setStep("form");
    setCreatedRoomId(null);
    setTitle("");
    setDescription("");
    setScheduleNow(true);
    setScheduledDate(undefined);
    setScheduledTime("10:00");
    setUseDefaultWaiting(true);
    setAutoApprove(false);
    setFamilyInvitedIds([]);
    setNotifyFamily(true);
    setEnablePublicGuestLink(false);
    setCreating(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleCreate = async () => {
    if (!user || !title.trim()) return;
    if (mode === "bullfy_family" && familyInvitedIds.length === 0 && !enablePublicGuestLink) {
      toast.error("Selecciona al menos un miembro o habilita el link público");
      return;
    }
    if (!scheduleNow && !scheduledDate) {
      toast.error("Selecciona una fecha para programar la sesión");
      return;
    }

    setCreating(true);

    let scheduledAt: string | null = null;
    if (!scheduleNow && scheduledDate) {
      const [h, m] = scheduledTime.split(":").map(Number);
      const d = new Date(scheduledDate);
      d.setHours(h || 0, m || 0, 0, 0);
      scheduledAt = d.toISOString();
    }

    const baseSlug = slugify(title.trim()) || "sala";
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
    const roomName = `bullfy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const { data, error } = await supabase
      .from("live_rooms")
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        host_id: user.id,
        livekit_room_name: roomName,
        status: "scheduled",
        portal_id: portalId || null,
        room_type: mode,
        is_public_stream: mode === "bullfy_family" ? enablePublicGuestLink : false,
        scheduled_at: scheduledAt,
        slug,
        auto_approve_join_requests: autoApprove,
      } as any)
      .select()
      .single();

    if (error || !data) {
      toast.error("Error al crear sala: " + (error?.message || "desconocido"));
      setCreating(false);
      return;
    }

    // Bullfy Family invitations
    if (mode === "bullfy_family" && familyInvitedIds.length > 0) {
      const inviteRows = familyInvitedIds.map((uid) => ({
        room_id: data.id,
        invited_user_id: uid,
        invited_by: user.id,
      }));
      const { error: invErr } = await supabase.from("live_room_invitations").insert(inviteRows);
      if (invErr) {
        toast.error("Sala creada, pero falló registrar invitaciones: " + invErr.message);
      } else if (notifyFamily) {
        supabase.functions
          .invoke("send-bullfy-family-invitation", { body: { roomId: data.id } })
          .then(({ data: res, error: emailErr }) => {
            if (emailErr) toast.error("Error enviando correos: " + emailErr.message);
            else if (res?.sent != null) toast.success(`${res.sent} invitación(es) enviadas`);
          });
        // Si está programada, enviar también .ics
        if (scheduledAt) {
          supabase.functions
            .invoke("notify-family-live-event", { body: { roomId: data.id, timezone: scheduledTimezone } })
            .then(({ data: res, error: icsErr }) => {
              if (icsErr) console.warn("ICS error:", icsErr);
              else if (res?.sent) toast.success(`📅 Calendario enviado a ${res.sent} miembros`);
            });
        }
      }
    }

    setCreatedRoomId(data.id);
    setCreating(false);

    if (useDefaultWaiting) {
      toast.success(`${meta.label} creada exitosamente`);
      onCreated(data.id);
      handleClose(false);
    } else {
      setStep("waiting_room");
    }
  };

  const finishWaitingConfig = () => {
    if (createdRoomId) onCreated(createdRoomId);
    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-primary" />
            Crear {meta.label}
          </DialogTitle>
          <DialogDescription>{meta.tagline}</DialogDescription>
        </DialogHeader>

        {step === "form" ? (
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nombre de la sala *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Reunión equipo marketing"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                El link de invitación incluirá una versión legible del nombre.
              </p>
            </div>

            <div>
              <Label>Descripción (opcional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Agenda, objetivos, etc."
                rows={2}
              />
            </div>

            {/* Programación */}
            <div className="border border-border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Iniciar ahora</p>
                  <p className="text-[11px] text-muted-foreground">
                    Si lo desactivas, podrás programar fecha y hora.
                  </p>
                </div>
                <Switch checked={scheduleNow} onCheckedChange={setScheduleNow} />
              </div>

              {!scheduleNow && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <Label className="text-xs">Fecha</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal h-9",
                            !scheduledDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {scheduledDate ? format(scheduledDate, "PPP") : "Elegir"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={scheduledDate}
                          onSelect={setScheduledDate}
                          disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className="text-xs">Hora</Label>
                    <Input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Zona horaria</Label>
                    <Select value={scheduledTimezone} onValueChange={setScheduledTimezone}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground mt-1">El calendario de cada invitado mostrará la hora en su zona local automáticamente.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Sala de espera */}
            <div className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Sala de espera por defecto</p>
                  <p className="text-[11px] text-muted-foreground">
                    Si lo desactivas, podrás personalizar la sala de espera ahora.
                  </p>
                </div>
                <Switch checked={useDefaultWaiting} onCheckedChange={setUseDefaultWaiting} />
              </div>
            </div>

            {/* Aprobación automática */}
            <div className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Auto-aceptar todas las solicitudes</p>
                  <p className="text-[11px] text-muted-foreground">
                    Cualquier persona con el link entra sin tu aprobación. Puedes cambiarlo durante la sesión.
                  </p>
                </div>
                <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
              </div>
            </div>

            {/* Bullfy Family selector */}
            {mode === "bullfy_family" && (
              <>
                <div className="border border-primary/20 rounded-lg p-3 bg-primary/5">
                  <BullfyFamilyInviteSelector
                    selectedIds={familyInvitedIds}
                    onChange={setFamilyInvitedIds}
                  />
                  <label className="flex items-center gap-2 mt-3 pt-3 border-t border-primary/10 cursor-pointer">
                    <Checkbox
                      checked={notifyFamily}
                      onCheckedChange={(c) => setNotifyFamily(!!c)}
                    />
                    <span className="text-xs">Notificar a invitados por correo automáticamente</span>
                  </label>
                </div>

                <div className="border border-border rounded-lg p-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <Checkbox
                      checked={enablePublicGuestLink}
                      onCheckedChange={(c) => setEnablePublicGuestLink(!!c)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-primary" />
                        Link público para invitados externos
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Permite invitar personas fuera del rol Bullfy Family con un link compartible.
                      </p>
                    </div>
                  </label>
                </div>
              </>
            )}

            <Button
              onClick={handleCreate}
              disabled={creating || !title.trim()}
              className="w-full"
              size="lg"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creando...
                </>
              ) : (
                `Crear ${meta.label}`
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Personaliza la sala de espera que verán los invitados antes de iniciar la sesión.
            </p>
            {createdRoomId && (
              <WaitingRoomConfig roomId={createdRoomId} onSaved={finishWaitingConfig} />
            )}
            <Button variant="outline" onClick={finishWaitingConfig} className="w-full" size="sm">
              Omitir y usar plantilla por defecto
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MeetingWizardDialog;
