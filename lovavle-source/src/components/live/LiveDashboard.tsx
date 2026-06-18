import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RoomTypeSelectorDialog, { type RoomTypeChoice } from "./RoomTypeSelectorDialog";
import MeetingWizardDialog, { type MeetingMode } from "./MeetingWizardDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/lib/toastUtils";
import { Video, Plus, Users, Eye, Copy, Trash2, Radio, Heart, Film, BarChart3, DollarSign, Trophy, Settings, Tv, FileBarChart, Shield, Clock, Lock, Sparkles, Globe } from "lucide-react";
import { usePortalBranding, dimHex } from "@/hooks/usePortalBranding";
import { usePortalTiers } from "@/hooks/usePortalTiers";
import { useLiveFeatureAccessBulk, type LiveFeatureKey } from "@/hooks/useLiveFeatureAccess";
import BullfyFamilyInviteSelector from "./BullfyFamilyInviteSelector";

const LIVE_FEATURE_KEYS: LiveFeatureKey[] = ["meeting_mode", "webinar_pro_controls", "bullfy_family_mode"];
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LiveStreamHost from "./LiveStreamHost";
import LiveStreamViewer from "./LiveStreamViewer";
import InviteCodeManager from "./InviteCodeManager";
import InvitationButton from "./InvitationButton";
import RecordingsManager from "./RecordingsManager";
import FakeStreamManager from "./FakeStreamManager";
import LiveStreamerStats from "./LiveStreamerStats";
import LiveMonetizationConfig from "./LiveMonetizationConfig";
import LiveEarningsDashboard from "./LiveEarningsDashboard";
import LiveStreamerMonetizationAdmin from "./LiveStreamerMonetizationAdmin";
import LiveStreamerReports from "./LiveStreamerReports";
import AlertKeywordsConfig from "./AlertKeywordsConfig";
import WaitingRoomConfig from "./WaitingRoomConfig";

interface LiveRoom {
  id: string;
  title: string;
  description: string | null;
  host_id: string;
  status: string;
  livekit_room_name: string;
  viewer_count: number;
  max_viewers: number;
  started_at: string | null;
  created_at: string;
  is_public_stream: boolean;
  room_type?: string;
}

interface LiveDashboardProps {
  portalId?: string;
  tierStreamsEnabled?: boolean;
}

const LiveDashboard = ({ portalId, tierStreamsEnabled }: LiveDashboardProps = {}) => {
  const { tiers: portalTiers } = usePortalTiers(portalId);
  const activeTiers = portalTiers.filter(t => t.active);
  const { branding } = usePortalBranding(portalId);
  const btnBg = dimHex(branding.primary_color, 0.7);
  const { user, profile, isAdmin, isGlobalAdmin, isIBExterno } = useAuth();
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false); // Stream-only legacy dialog
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [meetingMode, setMeetingMode] = useState<MeetingMode | null>(null);
  const [activeRoom, setActiveRoom] = useState<LiveRoom | null>(null);
  const [viewingRoom, setViewingRoom] = useState<LiveRoom | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [selectedTiers, setSelectedTiers] = useState<string[]>([]);
  const [roomType, setRoomType] = useState<"broadcast" | "meeting" | "webinar_pro" | "bullfy_family">("broadcast");
  const [familyInvitedIds, setFamilyInvitedIds] = useState<string[]>([]);
  const [enablePublicGuestLink, setEnablePublicGuestLink] = useState(false);

  const handleTypeSelected = (choice: RoomTypeChoice) => {
    setShowTypeSelector(false);
    if (choice === "broadcast") {
      setRoomType("broadcast");
      setShowCreate(true);
    } else {
      setMeetingMode(choice);
    }
  };
  const [dashTab, setDashTab] = useState<"rooms" | "fake" | "stats" | "earnings" | "reports" | "alerts" | "config">("rooms");
  const featureAccess = useLiveFeatureAccessBulk(LIVE_FEATURE_KEYS);

  const fetchRooms = async () => {
    let query = supabase
      .from("live_rooms")
      .select("*")
      .order("created_at", { ascending: false });
    if (portalId) {
      query = query.eq("portal_id", portalId);
    } else {
      query = query.is("portal_id", null);
    }
    const { data } = await query;
    let allRooms = (data as LiveRoom[]) || [];

    // Bullfy Family rooms: only host, invited members, or admins can see them
    if (!isAdmin && !isGlobalAdmin && user) {
      const familyRoomIds = allRooms
        .filter((r) => r.room_type === "bullfy_family" && r.host_id !== user.id)
        .map((r) => r.id);

      if (familyRoomIds.length > 0) {
        const { data: invites } = await supabase
          .from("live_room_invitations")
          .select("room_id")
          .eq("invited_user_id", user.id)
          .in("room_id", familyRoomIds);
        const invitedRoomIds = new Set((invites || []).map((i) => i.room_id));
        allRooms = allRooms.filter(
          (r) => r.room_type !== "bullfy_family" || r.host_id === user.id || invitedRoomIds.has(r.id)
        );
      }
    }

    setRooms(allRooms);
    setLoading(false);
  };

  useEffect(() => {
    fetchRooms();
    const channel = supabase
      .channel("live_rooms_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_rooms" }, () => fetchRooms())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleCreate = async () => {
    if (!newTitle.trim() || !user) return;
    if (roomType === "bullfy_family" && familyInvitedIds.length === 0 && !enablePublicGuestLink) {
      toast.error("Selecciona al menos un miembro o habilita el link público para invitados");
      return;
    }
    setCreating(true);
    const roomName = `bullfy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { data, error } = await supabase.from("live_rooms").insert({
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      host_id: user.id,
      livekit_room_name: roomName,
      status: "scheduled",
      portal_id: portalId || null,
      required_tiers: selectedTiers.length > 0 ? selectedTiers : null,
      room_type: roomType,
      is_public_stream: roomType === "bullfy_family" ? enablePublicGuestLink : false,
    }).select().single();

    if (error) {
      toast.error("Error al crear sala: " + error.message);
      setCreating(false);
      return;
    }

    // Bullfy Family: insert invitations + send emails
    if (roomType === "bullfy_family" && familyInvitedIds.length > 0) {
      const inviteRows = familyInvitedIds.map((uid) => ({
        room_id: data.id,
        invited_user_id: uid,
        invited_by: user.id,
      }));
      const { error: invErr } = await supabase.from("live_room_invitations").insert(inviteRows);
      if (invErr) {
        toast.error("Sala creada pero no se pudieron registrar invitaciones: " + invErr.message);
      } else {
        // Fire-and-forget invitation emails
        supabase.functions.invoke("send-bullfy-family-invitation", {
          body: { roomId: data.id },
        }).then(({ data: res, error: emailErr }) => {
          if (emailErr) {
            toast.error("Error enviando correos: " + emailErr.message);
          } else if (res?.sent != null) {
            toast.success(`${res.sent} correo(s) de invitación enviados`);
          }
        });
      }
    }

    setCreatedRoomId(data.id);
    toast.success("Sala creada — configura la sala de espera");
    setCreating(false);
  };

  const handleFinishCreate = () => {
    setShowCreate(false);
    setNewTitle("");
    setNewDesc("");
    setSelectedTiers([]);
    setRoomType("broadcast");
    setFamilyInvitedIds([]);
    setEnablePublicGuestLink(false);
    setCreatedRoomId(null);
    fetchRooms();
  };

  const handleGoLive = async (room: LiveRoom) => {
    await supabase.from("live_rooms").update({ status: "waiting" }).eq("id", room.id);
    setActiveRoom({ ...room, status: "waiting" });
  };

  const [finalizingRecording, setFinalizingRecording] = useState(false);

  const handleEndStream = async () => {
    if (!activeRoom) return;
    // Ask any active StreamRecorder to stop+upload before we mark the stream as ended,
    // so the auto-clip trigger finds a live_recordings row.
    const onFinalizing = () => setFinalizingRecording(true);
    window.addEventListener("stream-recording-finalizing", onFinalizing);
    try {
      await new Promise<void>((resolve) => {
        const finalizers: Promise<void>[] = [];
        const done = () => {
          window.removeEventListener("stream-recording-finalized", done);
          resolve();
        };
        window.addEventListener("stream-recording-finalized", done, { once: true });
        // Use a cancelable event so the StreamRecorder (if mounted & recording) can
        // call preventDefault() to signal "I'll finalize, wait for me".
        const ev = new CustomEvent("stream-ending-request-finalize", { cancelable: true, detail: { finalizers } });
        const willFinalize = !window.dispatchEvent(ev); // false dispatch return = preventDefault was called
        if (!willFinalize) {
          // Nobody is recording → resolve immediately, don't wait 60s.
          window.removeEventListener("stream-recording-finalized", done);
          resolve();
          return;
        }
        if (finalizers.length > 0) {
          Promise.allSettled(finalizers).then(done);
        }
        // Safety timeout: 60s max wait for upload
        setTimeout(() => { window.removeEventListener("stream-recording-finalized", done); resolve(); }, 60000);
      });
    } catch {}
    window.removeEventListener("stream-recording-finalizing", onFinalizing);
    setFinalizingRecording(false);
    const endedRoomId = activeRoom.id;
    await supabase.from("live_rooms").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", endedRoomId);
    setActiveRoom(null);
    fetchRooms();
    // Subscribe for ~10 minutes to notify host when auto-clips become ready
    watchClipsForRoom(endedRoomId);
  };

  const watchClipsForRoom = (roomId: string) => {
    const notified = new Set<string>();
    const channel = supabase
      .channel(`video-clips-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "video_clips", filter: `source_id=eq.${roomId}` },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (!row?.id) return;
          const ready = row.render_status === "completed" || row.render_status === "done" || !!row.output_url;
          if (ready && !notified.has(row.id)) {
            notified.add(row.id);
            toast.success("🎬 Clip listo en Video Studio", {
              description: row.title || "Tu auto-clip está disponible",
              action: {
                label: "Abrir",
                onClick: () => window.open("/marketing?tab=video-studio", "_blank"),
              },
            });
          }
        }
      )
      .subscribe();
    setTimeout(() => { supabase.removeChannel(channel); }, 10 * 60 * 1000);
  };

  const handleForceEndRoom = async (roomId: string) => {
    const { error } = await supabase
      .from("live_rooms")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", roomId);
    if (error) {
      toast.error("No se pudo cerrar el stream");
      return;
    }
    toast.success("Stream cerrado para todos los viewers");
    fetchRooms();
  };

  const handleDeleteRoom = async (roomId: string) => {
    await supabase.from("live_rooms").delete().eq("id", roomId);
    fetchRooms();
    toast.success("Sala eliminada");
  };

  if (activeRoom) {
    return (
      <>
        <LiveStreamHost room={activeRoom} userName={profile?.nombre || "Host"} onEnd={handleEndStream} />
        {finalizingRecording && (
          <div className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-card border border-border rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl">
              <div className="mx-auto mb-4 w-14 h-14 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              <h3 className="text-lg font-semibold mb-2">Finalizando grabación…</h3>
              <p className="text-sm text-muted-foreground">
                Estamos subiendo tu grabación para generar los clips en Video Studio. No cierres esta ventana, esto puede tardar unos segundos según la duración del stream.
              </p>
            </div>
          </div>
        )}
      </>
    );
  }

  if (viewingRoom) {
    return <LiveStreamViewer room={viewingRoom} userName={profile?.nombre || "Viewer"} onLeave={() => setViewingRoom(null)} />;
  }

  
  const waitingRooms = rooms.filter(r => r.status === "waiting");
  const liveRooms = rooms.filter(r => r.status === "live");
  const scheduledRooms = rooms.filter(r => r.status === "scheduled");
  const endedRooms = rooms.filter(r => r.status === "ended").slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Radio className="w-6 h-6 text-primary" /> Bullfy Live System
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Streaming en vivo con interacción bidireccional</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowTypeSelector(true)} className="gap-2" style={{ backgroundColor: btnBg }}>
            <Plus className="w-4 h-4" /> Nueva Sala
          </Button>
        </div>

        {/* Type selector — opens first */}
        <RoomTypeSelectorDialog
          open={showTypeSelector}
          onOpenChange={setShowTypeSelector}
          onSelect={handleTypeSelected}
        />

        {/* Wizard for Meeting / Bullfy Family / Webinar Pro */}
        {meetingMode && (
          <MeetingWizardDialog
            open={!!meetingMode}
            onOpenChange={(v) => { if (!v) setMeetingMode(null); }}
            mode={meetingMode}
            portalId={portalId}
            onCreated={() => { setMeetingMode(null); fetchRooms(); }}
          />
        )}

        {/* Stream creation dialog (legacy flow, simplified — no room type select) */}
        <Dialog open={showCreate} onOpenChange={(open) => { if (!open) handleFinishCreate(); else setShowCreate(true); }}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{createdRoomId ? "Configurar Sala de Espera" : "Crear Stream"}</DialogTitle></DialogHeader>
            {!createdRoomId ? (
              <div className="space-y-4">
                <div>
                  <Label>Título</Label>
                  <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ej: Sesión de Trading en Vivo" />
                </div>
                <div>
                  <Label>Descripción (opcional)</Label>
                  <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Describe el contenido del live..." />
                </div>

                {tierStreamsEnabled && portalId && (
                  <div>
                    <Label className="mb-2 block">Restringir por Nivel (opcional)</Label>
                    <p className="text-xs text-muted-foreground mb-2">Si no seleccionas ninguno, el stream será abierto a todos tus clientes.</p>
                    <div className="flex gap-4">
                      {activeTiers.map(tier => (
                        <label key={tier.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={selectedTiers.includes(tier.slug)}
                            onCheckedChange={(checked) => {
                              setSelectedTiers(prev =>
                                checked
                                  ? [...prev, tier.slug]
                                  : prev.filter(t => t !== tier.slug)
                              );
                            }}
                          />
                          {tier.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <Button onClick={handleCreate} disabled={creating || !newTitle.trim()} className="w-full">
                  {creating ? "Creando..." : "Crear Stream"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <WaitingRoomConfig roomId={createdRoomId} onSaved={handleFinishCreate} />
                <Button variant="outline" onClick={handleFinishCreate} className="w-full" size="sm">
                  Omitir (usar plantilla default)
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10"><Radio className="w-5 h-5 text-destructive" /></div>
            <div>
              <p className="text-2xl font-bold">{liveRooms.length}</p>
              <p className="text-sm text-muted-foreground">En Vivo Ahora</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Video className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{scheduledRooms.length}</p>
              <p className="text-sm text-muted-foreground">Programadas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted"><Eye className="w-5 h-5 text-muted-foreground" /></div>
            <div>
              <p className="text-2xl font-bold">{rooms.reduce((s, r) => s + r.max_viewers, 0)}</p>
              <p className="text-sm text-muted-foreground">Viewers Totales</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={dashTab} onValueChange={v => setDashTab(v as any)}>
        <TabsList>
          <TabsTrigger value="rooms" className="gap-1"><Radio className="w-3 h-3" /> Salas</TabsTrigger>
          <TabsTrigger value="fake" className="gap-1"><Tv className="w-3 h-3" /> Falsos en Vivo</TabsTrigger>
          <TabsTrigger value="stats" className="gap-1"><Trophy className="w-3 h-3" /> Estadísticas</TabsTrigger>
          {isIBExterno && (
            <TabsTrigger value="earnings" className="gap-1"><DollarSign className="w-3 h-3" /> Ganancias</TabsTrigger>
          )}
          <TabsTrigger value="reports" className="gap-1"><FileBarChart className="w-3 h-3" /> Reportes</TabsTrigger>
          {(isAdmin || isGlobalAdmin) && (
            <TabsTrigger value="alerts" className="gap-1"><Shield className="w-3 h-3" /> Alertas</TabsTrigger>
          )}
          {(isAdmin || isGlobalAdmin) && (
            <TabsTrigger value="config" className="gap-1"><Settings className="w-3 h-3" /> Monetización</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="rooms" className="space-y-4 mt-4">
          {/* Waiting Rooms */}
          {waitingRooms.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" /> Sala de Espera
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {waitingRooms.map(room => (
                  <Card key={room.id} className="border-amber-500/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between">
                        {room.title}
                        <Badge className="text-xs bg-amber-600">ESPERANDO</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {room.description && <p className="text-sm text-muted-foreground mb-3">{room.description}</p>}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3" /> {room.viewer_count} viewers
                        </span>
                        {room.host_id === user?.id ? (
                          <Button size="sm" onClick={() => setActiveRoom(room)}>Volver a Sala</Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setViewingRoom(room)}>Ver Sala de Espera</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Live Now */}
          {liveRooms.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" /> En Vivo
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {liveRooms.map(room => (
                  <Card key={room.id} className="border-destructive/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between">
                        {room.title}
                        <Badge variant="destructive" className="text-xs">LIVE</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {room.description && <p className="text-sm text-muted-foreground mb-3">{room.description}</p>}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3" /> {room.viewer_count} viewers
                        </span>
                        {room.host_id === user?.id ? (
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="destructive" onClick={() => setActiveRoom(room)}>Volver al Stream</Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                                  title="Cerrar stream para todos los viewers"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Cerrar el stream para todos?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción finaliza "{room.title}" para todos los viewers conectados y ejecuta el cierre normal del stream (cálculo de earnings, auto-clip, cierre de breakouts). No se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => handleForceEndRoom(room.id)}
                                  >
                                    Cerrar stream
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        ) : (
                          <Button size="sm" onClick={() => setViewingRoom(room)}>Ver Stream</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Scheduled */}
          {scheduledRooms.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Salas Programadas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scheduledRooms.map(room => (
                  <Card key={room.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{room.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {room.description && <p className="text-sm text-muted-foreground">{room.description}</p>}
                      <div className="flex items-center gap-2">
                        {room.host_id === user?.id && (
                          <>
                            <Button size="sm" onClick={() => handleGoLive(room)} className="gap-1">
                              <Radio className="w-3 h-3" /> Iniciar Live
                            </Button>
                            {(room.room_type === "meeting" || room.room_type === "webinar_pro" || room.room_type === "bullfy_family")
                              ? <InvitationButton roomId={room.id} />
                              : <InviteCodeManager roomId={room.id} />}
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteRoom(room.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* History + Recordings */}
          {endedRooms.length > 0 && (
            <div className="space-y-3">
              <Tabs defaultValue="history">
                <TabsList>
                  <TabsTrigger value="history" className="gap-1">
                    <BarChart3 className="w-3 h-3" /> Historial
                  </TabsTrigger>
                  <TabsTrigger value="recordings" className="gap-1">
                    <Film className="w-3 h-3" /> Grabaciones
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="history">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
                    {endedRooms.map(room => (
                      <Card key={room.id} className="opacity-80 hover:opacity-100 transition-opacity">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center justify-between">
                            {room.title}
                            <Badge variant="secondary" className="text-xs">Finalizado</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {room.max_viewers} viewers</span>
                            <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {(room as any).total_likes || 0}</span>
                          </div>
                          {(isAdmin || isGlobalAdmin) && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="text-destructive text-xs gap-1 h-7">
                                  <Trash2 className="w-3 h-3" /> Eliminar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar sala y datos?</AlertDialogTitle>
                                  <AlertDialogDescription>Se eliminarán la sala, grabaciones, reacciones e historial asociados.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteRoom(room.id)}>Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="recordings" className="mt-3">
                  <RecordingsManager portalId={portalId} />
                </TabsContent>
              </Tabs>
            </div>
          )}

          {rooms.length === 0 && !loading && (
            <Card>
              <CardContent className="py-12 text-center">
                <Video className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No hay salas de streaming aún</p>
                <p className="text-sm text-muted-foreground mt-1">Crea tu primera sala para empezar a transmitir</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="fake" className="mt-4">
          <FakeStreamManager portalId={portalId} />
        </TabsContent>

        <TabsContent value="stats" className="mt-4">
          <LiveStreamerStats />
        </TabsContent>

        <TabsContent value="earnings" className="mt-4">
          <LiveEarningsDashboard />
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <LiveStreamerReports />
        </TabsContent>

        {(isAdmin || isGlobalAdmin) && (
          <TabsContent value="alerts" className="mt-4">
            <AlertKeywordsConfig />
          </TabsContent>
        )}

        {(isAdmin || isGlobalAdmin) && (
          <TabsContent value="config" className="mt-4">
            <Tabs defaultValue="streamers">
              <TabsList>
                <TabsTrigger value="streamers" className="gap-1"><Users className="w-3 h-3" /> Streamers</TabsTrigger>
                <TabsTrigger value="global" className="gap-1"><Settings className="w-3 h-3" /> Config Global</TabsTrigger>
              </TabsList>
              <TabsContent value="streamers" className="mt-4">
                <LiveStreamerMonetizationAdmin />
              </TabsContent>
              <TabsContent value="global" className="mt-4">
                <LiveMonetizationConfig />
              </TabsContent>
            </Tabs>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default LiveDashboard;
