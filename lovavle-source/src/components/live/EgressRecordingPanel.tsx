import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Video, StopCircle, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "@/lib/toastUtils";

interface EgressRecordingPanelProps {
  roomId: string;
  livekitRoomName: string;
}

const emit = (name: string, detail: any) => {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {}
};

const EgressRecordingPanel = ({ roomId, livekitRoomName }: EgressRecordingPanelProps) => {
  const [recording, setRecording] = useState(false);
  const [egressId, setEgressId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const refreshFromDb = useCallback(async () => {
    const { data } = await supabase
      .from("live_rooms")
      .select("egress_id, recording_enabled")
      .eq("id", roomId)
      .maybeSingle();
    if (data?.egress_id) {
      setEgressId(data.egress_id);
      setRecording(!!data.recording_enabled);
    } else {
      setEgressId(null);
      setRecording(false);
    }
  }, [roomId]);

  useEffect(() => {
    refreshFromDb();
  }, [refreshFromDb]);

  const handleStart = async () => {
    setBusy(true);
    setLastError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const jwt = sessionData?.session?.access_token;
      if (!jwt) throw new Error("Sin sesión activa");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/livekit-egress-start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ roomId, livekitRoomName }),
        }
      );

      let json: any = {};
      try { json = await res.json(); } catch {}

      // Edge function may return HTTP 200 with { ok: false, error: "..." }
      const failed = !res.ok || json?.ok === false || !json?.egressId;
      if (failed) {
        const msg = json?.error || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      setEgressId(json.egressId);
      setRecording(true);
      emit("stream-recording-started", {
        startedAt: new Date().toISOString(),
        roomId,
        source: "egress",
        egressId: json.egressId,
      });
      toast.success("Grabación iniciada en servidor");
    } catch (e: any) {
      const msg = e?.message || String(e);
      setLastError(msg);
      // Make sure UI doesn't get stuck thinking it's recording
      setRecording(false);
      setEgressId(null);
      emit("stream-recording-upload-failed", {
        finishedAt: new Date().toISOString(),
        roomId,
        source: "egress",
        error: `Inicio falló: ${msg}`,
      });
      toast.error("No se pudo iniciar grabación servidor: " + msg);
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    setBusy(true);
    setLastError(null);

    // If we lost the egressId in memory, try the DB before bailing.
    let effectiveEgressId = egressId;
    if (!effectiveEgressId) {
      const { data } = await supabase
        .from("live_rooms")
        .select("egress_id")
        .eq("id", roomId)
        .maybeSingle();
      effectiveEgressId = data?.egress_id || null;
    }

    if (!effectiveEgressId) {
      // Nothing to stop on LiveKit side — just clear the UI/DB flag.
      await supabase
        .from("live_rooms")
        .update({ recording_enabled: false })
        .eq("id", roomId);
      setRecording(false);
      setEgressId(null);
      setBusy(false);
      toast.info("No había grabación de servidor activa. UI restablecida.");
      return;
    }

    emit("stream-recording-upload-start", {
      startedAt: new Date().toISOString(),
      roomId,
      source: "egress",
    });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const jwt = sessionData?.session?.access_token;
      if (!jwt) throw new Error("Sin sesión activa");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/livekit-egress-stop`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ roomId, egressId: effectiveEgressId }),
        }
      );

      let json: any = {};
      try { json = await res.json(); } catch {}
      const failed = !res.ok || json?.ok === false;
      if (failed) {
        const msg = json?.error || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      setRecording(false);
      setEgressId(null);
      emit("stream-recording-uploaded", {
        finishedAt: new Date().toISOString(),
        roomId,
        source: "egress",
      });
      toast.success("Grabación detenida");
    } catch (e: any) {
      const msg = e?.message || String(e);
      setLastError(msg);
      // Even if LiveKit StopEgress failed, clear the local flags so the user isn't stuck.
      await supabase
        .from("live_rooms")
        .update({ recording_enabled: false })
        .eq("id", roomId)
        .then(() => undefined, () => undefined);
      setRecording(false);
      setEgressId(null);
      emit("stream-recording-upload-failed", {
        finishedAt: new Date().toISOString(),
        roomId,
        source: "egress",
        error: msg,
      });
      toast.error("Error deteniendo grabación: " + msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Video className="w-3.5 h-3.5 text-primary" /> Grabación Servidor
          {recording && <Badge variant="destructive" className="text-[10px] animate-pulse">REC</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!recording ? (
          <Button size="sm" className="w-full gap-1.5 text-xs" onClick={handleStart} disabled={busy}>
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Video className="w-3 h-3" />}
            Iniciar Grabación
          </Button>
        ) : (
          <Button size="sm" variant="destructive" className="w-full gap-1.5 text-xs" onClick={handleStop} disabled={busy}>
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <StopCircle className="w-3 h-3" />}
            Detener Grabación
          </Button>
        )}
        {lastError && (
          <div className="mt-2 flex items-start gap-1.5 rounded border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[10px] text-destructive">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
            <span className="break-words">{lastError}</span>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Grabación procesada por LiveKit Egress y almacenada en el servidor. Si esta opción
          falla, usa el botón <strong>Grabar</strong> en la barra superior (grabación local).
        </p>
      </CardContent>
    </Card>
  );
};

export default EgressRecordingPanel;
