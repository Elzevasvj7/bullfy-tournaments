import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AlertOctagon, Clock, Eye, EyeOff } from "lucide-react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { supabase } from "@/integrations/supabase/client";
import { useLiveKitReady } from "@/hooks/useLiveKitReady";
import { useSessionStorageState } from "@/hooks/useSessionStorageState";
import { toast } from "@/hooks/use-toast";

interface RedEvent {
  title: string;
  country: string;
  date: string; // MM-DD-YYYY
  time: string; // e.g. "8:30am" or "All Day"
  impact: "high" | "medium" | "low";
}

interface NextRedFolderBadgeProps {
  /** "host" shows the badge to host + exposes a toggle to share with viewers; "viewer" only renders when host enables it */
  mode?: "host" | "viewer";
}

const SS_KEY_HOST_ACTIVE = "bullfy-red-folder-host-active";
const SS_KEY_VIEWER = "bullfy-red-folder-viewer";

function loadViewerPersisted(): { event: RedEvent | null; visible: boolean } {
  try {
    const raw = sessionStorage.getItem(SS_KEY_VIEWER);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { event: null, visible: false };
}

function persistViewer(event: RedEvent | null, visible: boolean) {
  try {
    sessionStorage.setItem(SS_KEY_VIEWER, JSON.stringify({ event, visible }));
  } catch {}
}

/**
 * Parses a ForexFactory event (US/Eastern) into a UTC Date.
 */
function parseEasternToDate(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const t = time.trim().toLowerCase();
  if (!/\d/.test(t)) return null;
  const [mm, dd, yyyy] = date.split("-").map((n) => parseInt(n, 10));
  if (!mm || !dd || !yyyy) return null;

  const m = t.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/);
  if (!m) return null;
  let hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);
  const ampm = m[3];
  if (ampm === "pm" && hours < 12) hours += 12;
  if (ampm === "am" && hours === 12) hours = 0;

  const utcAsNy = Date.UTC(yyyy, mm - 1, dd, hours, minutes, 0);
  const offsetMin = nyOffsetMinutes(new Date(utcAsNy));
  return new Date(utcAsNy + offsetMin * 60_000);
}

function nyOffsetMinutes(at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
  });
  const parts = dtf.formatToParts(at);
  const tzPart = parts.find((p) => p.type === "timeZoneName")?.value || "GMT-5";
  const m = tzPart.match(/GMT([+-]?)(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 300;
  const sign = m[1] === "-" ? 1 : -1;
  const h = parseInt(m[2], 10);
  const mins = m[3] ? parseInt(m[3], 10) : 0;
  return sign * (h * 60 + mins);
}

const NextRedFolderBadge = ({ mode = "viewer" }: NextRedFolderBadgeProps) => {
  const room = useRoomContext();
  const isLkReady = useLiveKitReady(room);

  // ===== HOST state =====
  const [events, setEvents] = useState<RedEvent[]>([]);
  const [now, setNow] = useState<Date>(new Date());
  const [hostActive, setHostActive] = useSessionStorageState<boolean>(SS_KEY_HOST_ACTIVE, false);

  // ===== VIEWER state =====
  const persisted = useRef(loadViewerPersisted());
  const [viewerEvent, setViewerEvent] = useState<RedEvent | null>(persisted.current.event);
  const [viewerVisible, setViewerVisible] = useState<boolean>(persisted.current.visible);
  const hasSentSyncRef = useRef(false);
  const lastPayloadRef = useRef<object | null>(null);
  const hostActiveRef = useRef(hostActive);
  useEffect(() => { hostActiveRef.current = hostActive; }, [hostActive]);

  // ===== HOST: fetch events =====
  useEffect(() => {
    if (mode !== "host") return;
    let mounted = true;
    const load = async () => {
      try {
        const { data } = await supabase.functions.invoke("live-news-ticker-feed", {
          body: { includeEconomicCalendar: true, maxHeadlines: 1 },
        });
        if (!mounted) return;
        const reds = Array.isArray(data?.red_folder_events) ? data.red_folder_events : [];
        setEvents(reds);
      } catch {}
    };
    load();
    const id = setInterval(load, 15 * 60_000);
    return () => { mounted = false; clearInterval(id); };
  }, [mode]);

  // Tick countdown (host only)
  useEffect(() => {
    if (mode !== "host") return;
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [mode]);

  const next = useMemo(() => {
    if (mode !== "host") return null;
    const candidates = events
      .map((e) => ({ event: e, when: parseEasternToDate(e.date, e.time) }))
      .filter((x): x is { event: RedEvent; when: Date } => !!x.when);
    const future = candidates.filter((x) => x.when.getTime() > now.getTime() - 30 * 60_000);
    future.sort((a, b) => a.when.getTime() - b.when.getTime());
    return future[0] || null;
  }, [events, now, mode]);

  // ===== HOST: broadcast on toggle / next-event change =====
  const sendData = useCallback((payload: object) => {
    if (!room || !isLkReady) return;
    try {
      const data = new TextEncoder().encode(JSON.stringify(payload));
      room.localParticipant.publishData(data, { reliable: true });
    } catch {}
  }, [room, isLkReady]);

  useEffect(() => {
    if (mode !== "host") return;
    if (hostActive && next) {
      const payload = { type: "red-folder-update", action: "show", event: next.event };
      lastPayloadRef.current = payload;
      console.log("[RedFolder] Host broadcasting SHOW:", next.event.title, next.event.country);
      sendData(payload);
    } else if (!hostActive) {
      lastPayloadRef.current = null;
      console.log("[RedFolder] Host broadcasting HIDE");
      sendData({ type: "red-folder-update", action: "hide" });
    } else if (hostActive && !next) {
      console.warn("[RedFolder] Host active but no upcoming red folder event available");
    }
  }, [mode, hostActive, next, sendData]);

  // ===== HOST: respond to sync requests + new participants =====
  useEffect(() => {
    if (mode !== "host" || !room || !isLkReady) return;
    const onParticipant = () => {
      if (hostActiveRef.current && lastPayloadRef.current) {
        setTimeout(() => sendData(lastPayloadRef.current!), 600);
      }
    };
    const onData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === "red-folder-sync-request" && hostActiveRef.current && lastPayloadRef.current) {
          sendData(lastPayloadRef.current);
        }
      } catch {}
    };
    room.on(RoomEvent.ParticipantConnected, onParticipant);
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.ParticipantConnected, onParticipant);
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [mode, room, isLkReady, sendData]);

  // ===== VIEWER: listen for host updates =====
  useEffect(() => {
    if (mode !== "viewer" || !room || !isLkReady) return;
    const handle = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type !== "red-folder-update") return;
        if (msg.action === "show" && msg.event) {
          setViewerEvent(msg.event);
          setViewerVisible(true);
          persistViewer(msg.event, true);
        } else if (msg.action === "hide") {
          setViewerVisible(false);
          persistViewer(null, false);
        }
      } catch {}
    };
    room.on(RoomEvent.DataReceived, handle);
    return () => { room.off(RoomEvent.DataReceived, handle); };
  }, [mode, room, isLkReady]);

  // ===== VIEWER: send sync request once on mount =====
  useEffect(() => {
    if (mode !== "viewer" || hasSentSyncRef.current || !room || !isLkReady) return;
    hasSentSyncRef.current = true;
    const t = setTimeout(() => {
      try {
        const data = new TextEncoder().encode(JSON.stringify({ type: "red-folder-sync-request" }));
        room.localParticipant.publishData(data, { reliable: true });
      } catch {}
    }, 1200);
    return () => clearTimeout(t);
  }, [mode, room, isLkReady]);

  // ===== Render =====
  // Resolve event/time depending on mode
  let displayEvent: RedEvent | null = null;
  let when: Date | null = null;
  if (mode === "host") {
    displayEvent = next?.event ?? null;
    when = next?.when ?? null;
  } else {
    displayEvent = viewerVisible ? viewerEvent : null;
    when = displayEvent ? parseEasternToDate(displayEvent.date, displayEvent.time) : null;
  }

  // Viewer: only render when host has shared an event
  if (mode === "viewer" && !displayEvent) return null;

  const localTime = when
    ? when.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : displayEvent?.time ?? "";
  const localDate = when
    ? when.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" })
    : displayEvent?.date ?? "";

  let countdown = "";
  if (when) {
    const diffMin = Math.round((when.getTime() - now.getTime()) / 60_000);
    if (diffMin < -5) countdown = "en curso";
    else if (diffMin <= 0) countdown = "ahora";
    else if (diffMin < 60) countdown = `en ${diffMin} min`;
    else if (diffMin < 60 * 24) countdown = `en ${Math.round(diffMin / 60)} h`;
    else countdown = `en ${Math.round(diffMin / (60 * 24))} d`;
  }

  const handleHostToggle = () => {
    if (!hostActive && !next) {
      toast({
        title: "Sin eventos de carpeta roja",
        description: "No hay próximos eventos de alta impacto disponibles para mostrar.",
        variant: "destructive",
      });
      return;
    }
    setHostActive((v) => {
      const newVal = !v;
      toast({
        title: newVal ? "Carpeta roja visible para viewers" : "Carpeta roja oculta",
        description: newVal && next ? `Mostrando: ${next.event.title}` : undefined,
      });
      return newVal;
    });
  };

  return (
    <div className="absolute top-16 left-2 z-40 max-w-[min(70vw,320px)]">
      {displayEvent && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/15 backdrop-blur-md px-2.5 py-1.5 shadow-lg pointer-events-none">
          <AlertOctagon className="w-3.5 h-3.5 text-destructive shrink-0 mt-[2px]" />
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
              Carpeta roja
              <span className="text-white/70 font-semibold normal-case tracking-normal">· {displayEvent.country}</span>
            </div>
            <div className="text-[11px] font-semibold text-white truncate">
              {displayEvent.title}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-white/80">
              <Clock className="w-2.5 h-2.5" />
              <span>{localDate} · {localTime}</span>
              {countdown && <span className="text-white/60">({countdown})</span>}
            </div>
          </div>
        </div>
      )}

      {mode === "host" && !displayEvent && (
        <div className="rounded-lg border border-white/20 bg-black/40 backdrop-blur-md px-2.5 py-1.5 text-[10px] text-white/70">
          Sin próximo evento de carpeta roja
        </div>
      )}

      {mode === "host" && (
        <button
          type="button"
          onClick={handleHostToggle}
          className={`mt-1 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide backdrop-blur-md border transition-colors ${
            hostActive
              ? "bg-primary/20 border-primary/50 text-primary hover:bg-primary/30"
              : "bg-black/40 border-white/20 text-white/80 hover:bg-black/60"
          }`}
          title={hostActive ? "Ocultar a viewers" : "Mostrar a viewers"}
        >
          {hostActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          {hostActive ? "Visible para viewers" : "Oculto a viewers"}
        </button>
      )}
    </div>
  );
};

export default NextRedFolderBadge;
