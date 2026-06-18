import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/lib/toastUtils";
import { usePortalTiers } from "@/hooks/usePortalTiers";
import {
  Calendar, MapPin, Globe, Lock, Clock, CheckCircle2,
  Loader2, ExternalLink, Users, Video, Coins, CreditCard
} from "lucide-react";
import MuxPlayer from "@mux/mux-player-react";
import { CARD_PAYMENT_ENABLED } from "@/lib/paymentConfig";

interface PortalEventsClientProps {
  portalId: string;
  userId: string;
  userTier: string;
  // Bullfy eCommerce del portal. Si OFF, todos los eventos son gratis (sin precio ni pago).
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
  media_type: string;
  video_thumbnail_path: string | null;
  mux_playback_id: string | null;
  mux_status: string | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const EVENT_TYPE_LABELS: Record<string, string> = {
  webinar: "Webinar",
  workshop: "Workshop",
  live_session: "Sesión en Vivo",
  other: "Evento",
};

const useCountdown = (target: string) => {
  const [text, setText] = useState("");
  useEffect(() => {
    const tick = () => {
      const diff = new Date(target).getTime() - Date.now();
      if (diff <= 0) { setText("En curso"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      if (d > 0) setText(`En ${d}d ${h}h`);
      else if (h > 0) setText(`En ${h}h ${m}m`);
      else setText(`En ${m} min`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [target]);
  return text;
};

const EventCountdown = ({ startsAt }: { startsAt: string }) => {
  const text = useCountdown(startsAt);
  return <span>{text}</span>;
};

const getEventCardImage = (ev: PortalEvent): string | null => {
  if (ev.media_type === "image") return ev.cover_image_url;
  if (ev.media_type === "video" && ev.mux_status === "ready" && ev.mux_playback_id) {
    if (ev.video_thumbnail_path) {
      return `${SUPABASE_URL}/storage/v1/object/public/academy-thumbnails/${ev.video_thumbnail_path}`;
    }
    return `https://image.mux.com/${ev.mux_playback_id}/thumbnail.jpg?time=5`;
  }
  return null;
};

const PortalEventsClient = ({ portalId, userId, userTier, commerceEnabled = false }: PortalEventsClientProps) => {
  const { labelFor } = usePortalTiers(portalId);
  // Sin eCommerce, todos los eventos se tratan como gratis (inscripción directa, sin pago).
  const isEventFree = (ev: PortalEvent) => !commerceEnabled || ev.is_free;
  const [events, setEvents] = useState<PortalEvent[]>([]);
  const [registeredIds, setRegisteredIds] = useState<Set<string>>(new Set());
  const [registrationCounts, setRegistrationCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<PortalEvent | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [eventsRes, regsRes] = await Promise.all([
      supabase
        .from("portal_events")
        .select("*")
        .eq("portal_id", portalId)
        .eq("status", "published")
        .order("starts_at", { ascending: true }),
      supabase
        .from("portal_event_registrations")
        .select("event_id")
        .eq("partner_user_id", userId),
    ]);

    const evs = (eventsRes.data as PortalEvent[]) || [];
    setEvents(evs);
    setRegisteredIds(new Set((regsRes.data || []).map((r: any) => r.event_id)));

    if (evs.length > 0) {
      const counts: Record<string, number> = {};
      await Promise.all(
        evs.filter(e => e.capacity).map(async e => {
          const { count } = await supabase
            .from("portal_event_registrations")
            .select("*", { count: "exact", head: true })
            .eq("event_id", e.id);
          counts[e.id] = count || 0;
        })
      );
      setRegistrationCounts(counts);
    }
    setLoading(false);
  };

  const hasTierAccess = (ev: PortalEvent) => {
    if (!ev.required_tiers || ev.required_tiers.length === 0) return true;
    return ev.required_tiers.includes(userTier);
  };

  const isAtCapacity = (ev: PortalEvent) => {
    if (!ev.capacity) return false;
    return (registrationCounts[ev.id] || 0) >= ev.capacity;
  };

  const registerFree = async (ev: PortalEvent) => {
    if (!hasTierAccess(ev)) return;
    if (isAtCapacity(ev)) { toast.error("Este evento ya no tiene cupos disponibles"); return; }
    setRegistering(ev.id);
    const { error } = await supabase.from("portal_event_registrations").insert({
      event_id: ev.id,
      partner_user_id: userId,
      granted_by: "free",
    });
    if (error) {
      if (error.code === "23505") toast.info("Ya estás inscrito en este evento");
      // El trigger de cupo atómico rechaza con check_violation (23514) y
      // mensaje EVENT_FULL cuando se llenó el aforo entre el check y el insert.
      else if (error.code === "23514" || /EVENT_FULL/i.test(error.message)) {
        toast.error("Este evento acaba de llenarse, ya no hay cupos disponibles");
        fetchData();
      }
      else toast.error("Error al inscribirte: " + error.message);
    } else {
      toast.success("¡Inscripción exitosa!");
      setRegisteredIds(prev => new Set([...prev, ev.id]));
      // C7: notificar (usuario + IB) — best-effort, no bloquea la UI.
      supabase.functions.invoke("portal-notifications", {
        body: { event: "event_registration", portal_id: portalId, event_id: ev.id, partner_user_id: userId },
      }).catch(() => {});
    }
    setRegistering(null);
  };

  // Confirmación del pago (polling): consulta verify_payment hasta que la orden
  // quede 'paid'; al confirmar, el backend ya creó la inscripción al evento.
  const pollEventPayment = async (orderId: string, eventId: string) => {
    for (let i = 0; i < 50; i++) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const { data } = await supabase.functions.invoke("portal-commerce", {
          body: { action: "verify_payment", order_id: orderId },
        });
        if (data?.ok && data.status === "paid") {
          toast.success("¡Pago confirmado! Quedaste inscrito en el evento.");
          setRegisteredIds(prev => new Set([...prev, eventId]));
          fetchData();
          return;
        }
      } catch { /* reintentar */ }
    }
    toast.info("Tu pago puede tardar unos minutos en confirmarse. Revisa tu inscripción más tarde.");
    fetchData();
  };

  // Retorno desde la pasarela (?payment=success): busca la última orden cripto
  // pendiente del usuario y la confirma por polling (el backend ya creó la inscripción).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "success") return;
    window.history.replaceState({}, "", window.location.pathname);
    (async () => {
      const { data } = await supabase
        .from("portal_orders")
        .select("id, event_id")
        .eq("partner_user_id", userId)
        .in("payment_gateway", ["coinsbuy", "nowpayments", "stripe_gateway"])
        .eq("payment_status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.id) pollEventPayment(data.id, data.event_id ?? "");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Evento de pago: crea la orden y abre la pasarela cripto (Coinsbuy). La
  // inscripción se crea en el backend al confirmar el pago.
  const startPaidRegistration = async (ev: PortalEvent, gateway: string = "crypto") => {
    if (!hasTierAccess(ev)) return;
    if (isAtCapacity(ev)) { toast.error("Este evento ya no tiene cupos disponibles"); return; }
    setRegistering(ev.id);
    try {
      const redirectUrl = `${window.location.origin}${window.location.pathname}?payment=success`;
      const { data, error } = await supabase.functions.invoke("portal-commerce", {
        body: {
          action: "checkout_event",
          partner_user_id: userId,
          portal_id: portalId,
          event_id: ev.id,
          payment_gateway: gateway,
          redirect_url: redirectUrl,
        },
      });
      if (error) throw error;
      if (data?.ok) {
        if (data.payment_url) {
          // Misma pestaña: window.open(_blank) tras el await lo bloquea el navegador.
          // Al volver, ?payment=success confirma la inscripción.
          toast.success("Redirigiendo a la pasarela de pago. Tu inscripción se confirma al completar el pago.");
          window.location.href = data.payment_url;
          return;
        } else if (data.gateway_result?.simulated) {
          toast.success("¡Inscripción confirmada!");
          setRegisteredIds(prev => new Set([...prev, ev.id]));
          fetchData();
        } else {
          // Cripto sin payment_url = el depósito falló.
          toast.error(data.gateway_result?.error || "No se pudo iniciar el pago. Inténtalo de nuevo.");
        }
      } else {
        toast.error(data?.error || "No se pudo iniciar el pago");
      }
    } catch (e: any) {
      toast.error("Error al iniciar el pago: " + (e.message || e));
    } finally {
      setRegistering(null);
    }
  };

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString("es", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const isPast = (ev: PortalEvent) => {
    const end = ev.ends_at || ev.starts_at;
    return new Date(end) < new Date();
  };

  const upcoming = events.filter(e => !isPast(e));
  const past = events.filter(e => isPast(e));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderEvent = (ev: PortalEvent) => {
    const tierOk = hasTierAccess(ev);
    const registered = registeredIds.has(ev.id);
    const full = isAtCapacity(ev);
    const cancelled = ev.status === "cancelled";
    const cardImage = getEventCardImage(ev);
    const hasVideo = ev.media_type === "video" && ev.mux_status === "ready" && ev.mux_playback_id;

    return (
      <Card
        key={ev.id}
        className={`cursor-pointer hover:border-primary/40 transition-colors ${!tierOk || cancelled ? "opacity-60" : ""}`}
        onClick={() => setSelectedEvent(ev)}
      >
        {cardImage && (
          <div className="aspect-video overflow-hidden rounded-t-lg relative bg-muted">
            {/* Fondo difuminado para rellenar el espacio lateral sin barras negras */}
            <img
              src={cardImage}
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-40"
            />
            {/* Imagen/miniatura completa en primer plano (sin recorte) */}
            <img
              src={cardImage}
              alt={ev.title}
              className="relative w-full h-full object-contain"
              loading="lazy"
            />
            {hasVideo && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Video className="w-6 h-6 text-white" />
                </div>
              </div>
            )}
          </div>
        )}
        <CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap gap-1.5 items-center">
            <Badge variant="outline" className="text-xs">{EVENT_TYPE_LABELS[ev.event_type] || ev.event_type}</Badge>
            {isEventFree(ev)
              ? <Badge variant="outline" className="text-xs text-green-500 border-green-500/30">Gratuito</Badge>
              : <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500/30">${ev.price_usd} USD</Badge>
            }
            {ev.required_tiers && ev.required_tiers.length > 0 && (
              <Badge variant="outline" className="text-xs gap-1">
                <Lock className="w-3 h-3" />
                {ev.required_tiers.map(t => labelFor(t)).join(" · ")}
              </Badge>
            )}
            {cancelled && <Badge variant="destructive" className="text-xs">Cancelado</Badge>}
            {registered && !cancelled && <Badge className="text-xs bg-green-600 gap-1"><CheckCircle2 className="w-3 h-3" />Inscrito</Badge>}
            {full && !registered && <Badge variant="secondary" className="text-xs">Sin cupos</Badge>}
          </div>

          <h3 className="font-semibold text-foreground leading-tight">{ev.title}</h3>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>{formatDateTime(ev.starts_at)}</span>
            {!isPast(ev) && !cancelled && (
              <span className="text-primary font-medium">· <EventCountdown startsAt={ev.starts_at} /></span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {ev.location_type === "online"
              ? <Globe className="w-3.5 h-3.5 shrink-0" />
              : <MapPin className="w-3.5 h-3.5 shrink-0" />
            }
            <span>{ev.location_type === "online" ? "Online" : "Presencial"}</span>
            {ev.capacity && (
              <span className="ml-auto flex items-center gap-1">
                <Users className="w-3 h-3" />
                {registrationCounts[ev.id] || 0}/{ev.capacity}
              </span>
            )}
          </div>

          {!cancelled && (
            <div className="pt-1" onClick={e => e.stopPropagation()}>
              {!tierOk ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Exclusivo para {ev.required_tiers!.map(t => labelFor(t)).join(" / ")}
                </p>
              ) : registered ? (
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Ya estás inscrito
                </p>
              ) : isEventFree(ev) ? (
                <Button size="sm" className="w-full" disabled={!!registering || full} onClick={() => registerFree(ev)}>
                  {registering === ev.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : full ? "Sin cupos" : "Inscribirme"}
                </Button>
              ) : (
                <div className="space-y-1.5">
                  <Button size="sm" className="w-full gap-1.5" disabled={full || registering === ev.id} onClick={() => startPaidRegistration(ev, "crypto")}>
                    {registering === ev.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : full ? "Sin cupos" : <><Coins className="w-3.5 h-3.5" /> {CARD_PAYMENT_ENABLED ? "Pagar con cripto" : <>Inscribirme · ${ev.price_usd} USD</>}</>}
                  </Button>
                  {CARD_PAYMENT_ENABLED && (
                    <Button size="sm" variant="outline" className="w-full gap-1.5" disabled={full || registering === ev.id} onClick={() => startPaidRegistration(ev, "stripe_gateway")}>
                      <CreditCard className="w-3.5 h-3.5" /> Pagar con tarjeta
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Eventos</h2>
        <p className="text-sm text-muted-foreground mt-1">Próximas sesiones y actividades</p>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No hay eventos disponibles en este momento</p>
            <p className="text-sm text-muted-foreground mt-1">Vuelve más tarde para ver las próximas actividades</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Próximos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcoming.map(renderEvent)}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Anteriores</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70">
                {past.map(renderEvent)}
              </div>
            </section>
          )}
        </>
      )}

      {/* Event detail dialog */}
      {selectedEvent && (
        <Dialog open={true} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent className="w-[96vw] max-w-[1500px] max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl leading-tight pr-6">{selectedEvent.title}</DialogTitle>
            </DialogHeader>

            {(() => {
              const hasMedia =
                (selectedEvent.media_type === "video" &&
                  (selectedEvent.mux_status === "ready" || selectedEvent.mux_status === "preparing")) ||
                !!getEventCardImage(selectedEvent);

              const mediaNode =
                selectedEvent.media_type === "video" && selectedEvent.mux_status === "ready" && selectedEvent.mux_playback_id ? (
                  <div className="aspect-video rounded-lg overflow-hidden bg-black w-full">
                    <MuxPlayer
                      playbackId={selectedEvent.mux_playback_id}
                      metadata={{ video_id: selectedEvent.id, video_title: selectedEvent.title }}
                      autoPlay={false}
                      playsInline
                      style={{ width: "100%", height: "100%" }}
                    />
                  </div>
                ) : selectedEvent.media_type === "video" && selectedEvent.mux_status === "preparing" ? (
                  <div className="aspect-video rounded-lg bg-muted flex flex-col items-center justify-center gap-2 px-4 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Procesando el video, disponible muy pronto…</span>
                  </div>
                ) : getEventCardImage(selectedEvent) ? (
                  <div className="relative rounded-lg overflow-hidden bg-muted flex items-center justify-center aspect-video">
                    <img
                      src={getEventCardImage(selectedEvent)!}
                      aria-hidden
                      className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-40"
                    />
                    <img
                      src={getEventCardImage(selectedEvent)!}
                      alt={selectedEvent.title}
                      className="relative w-full h-full object-contain"
                      loading="lazy"
                    />
                  </div>
                ) : null;

              const infoNode = (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{EVENT_TYPE_LABELS[selectedEvent.event_type] || selectedEvent.event_type}</Badge>
                    {isEventFree(selectedEvent)
                      ? <Badge variant="outline" className="text-green-500 border-green-500/30">Gratuito</Badge>
                      : <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">${selectedEvent.price_usd} USD</Badge>
                    }
                    {selectedEvent.status === "cancelled" && <Badge variant="destructive">Cancelado</Badge>}
                    {registeredIds.has(selectedEvent.id) && (
                      <Badge className="bg-green-600 gap-1"><CheckCircle2 className="w-3 h-3" />Inscrito</Badge>
                    )}
                  </div>

                  <div className="flex items-start gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <div>{formatDateTime(selectedEvent.starts_at)}</div>
                      {selectedEvent.ends_at && (
                        <div className="text-muted-foreground">hasta {formatDateTime(selectedEvent.ends_at)}</div>
                      )}
                      {!isPast(selectedEvent) && selectedEvent.status !== "cancelled" && (
                        <div className="text-primary font-medium text-xs mt-0.5">
                          <EventCountdown startsAt={selectedEvent.starts_at} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-sm">
                    {selectedEvent.location_type === "online"
                      ? <Globe className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      : <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    }
                    <div>
                      <div>{selectedEvent.location_type === "online" ? "Online" : "Presencial"}</div>
                      {selectedEvent.location_url && registeredIds.has(selectedEvent.id) && (
                        <a
                          href={selectedEvent.location_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1 text-xs mt-0.5"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Unirse al evento
                        </a>
                      )}
                      {selectedEvent.location_url && !registeredIds.has(selectedEvent.id) && (
                        <p className="text-xs text-muted-foreground mt-0.5">El link se mostrará al inscribirte</p>
                      )}
                    </div>
                  </div>

                  {selectedEvent.required_tiers && selectedEvent.required_tiers.length > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <Lock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        Exclusivo para {selectedEvent.required_tiers.map(t => labelFor(t)).join(", ")}
                        {!hasTierAccess(selectedEvent) && (
                          <p className="text-xs text-destructive mt-0.5">Tu membresía ({labelFor(userTier)}) no tiene acceso. Contacta al administrador.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedEvent.capacity && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{registrationCounts[selectedEvent.id] || 0} de {selectedEvent.capacity} cupos</span>
                    </div>
                  )}

                  {selectedEvent.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{selectedEvent.description}</p>
                  )}

                  {selectedEvent.status !== "cancelled" && hasTierAccess(selectedEvent) && (
                    <div>
                      {registeredIds.has(selectedEvent.id) ? (
                        <div className="flex items-center gap-2 text-green-500 text-sm font-medium">
                          <CheckCircle2 className="w-4 h-4" /> Ya estás inscrito
                        </div>
                      ) : isEventFree(selectedEvent) ? (
                        <Button
                          className="w-full"
                          disabled={!!registering || isAtCapacity(selectedEvent)}
                          onClick={() => registerFree(selectedEvent)}
                        >
                          {registering === selectedEvent.id
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Inscribiendo...</>
                            : isAtCapacity(selectedEvent) ? "Sin cupos disponibles" : "Inscribirme gratis"
                          }
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <Button
                            className="w-full gap-1.5"
                            disabled={isAtCapacity(selectedEvent) || registering === selectedEvent.id}
                            onClick={() => startPaidRegistration(selectedEvent, "crypto")}
                          >
                            {registering === selectedEvent.id
                              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Procesando...</>
                              : isAtCapacity(selectedEvent) ? "Sin cupos disponibles"
                              : <><Coins className="w-4 h-4" /> {CARD_PAYMENT_ENABLED ? "Pagar con cripto" : `Inscribirme · $${selectedEvent.price_usd} USD`}</>
                            }
                          </Button>
                          {CARD_PAYMENT_ENABLED && (
                            <Button
                              variant="outline"
                              className="w-full gap-1.5"
                              disabled={isAtCapacity(selectedEvent) || registering === selectedEvent.id}
                              onClick={() => startPaidRegistration(selectedEvent, "stripe_gateway")}
                            >
                              <CreditCard className="w-4 h-4" /> Pagar con tarjeta
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );

              return hasMedia ? (
                <div className="grid md:grid-cols-[1.8fr_1fr] gap-6 items-start">
                  <div>{mediaNode}</div>
                  {infoNode}
                </div>
              ) : (
                infoNode
              );
            })()}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default PortalEventsClient;
