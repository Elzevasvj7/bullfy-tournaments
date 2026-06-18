import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CheckCircle2,
  CircleDashed,
  CloudUpload,
  Film,
  RefreshCw,
  Sparkles,
  XCircle,
  Clock,
  ExternalLink,
  Circle,
} from "lucide-react";

interface Props {
  roomId: string;
}

interface LiveRecordingRow {
  id: string;
  file_path: string;
  file_size: number | null;
  duration_seconds: number | null;
  created_at: string;
}

interface ClipRow {
  id: string;
  title: string | null;
  render_status: string | null;
  output_url: string | null;
  start_time: number | null;
  end_time: number | null;
  hook_score: number | null;
  created_at: string;
  updated_at: string;
}

type UploadState =
  | { status: "idle" }
  | { status: "recording"; startedAt: string }
  | { status: "uploading"; startedAt: string; durationSec?: number }
  | { status: "uploaded"; finishedAt: string; recordingId?: string }
  | { status: "failed"; finishedAt: string; error?: string };

const fmtTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
};
const fmtDur = (s?: number | null) => {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
};
const fmtSize = (b?: number | null) => {
  if (!b) return "—";
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

const RecordingStatusPanel = ({ roomId }: Props) => {
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [recordings, setRecordings] = useState<LiveRecordingRow[]>([]);
  const [clips, setClips] = useState<ClipRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: recs }, { data: cps }] = await Promise.all([
      supabase
        .from("live_recordings")
        .select("id, file_path, file_size, duration_seconds, created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false }),
      supabase
        .from("video_clips")
        .select("id, title, render_status, output_url, start_time, end_time, hook_score, created_at, updated_at")
        .eq("source_id", roomId)
        .order("created_at", { ascending: false }),
    ]);
    setRecordings((recs as LiveRecordingRow[]) || []);
    setClips((cps as ClipRow[]) || []);
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    fetchData();
    // Poll every 8s as a safety net (live_recordings is not in realtime publication)
    const interval = setInterval(fetchData, 8000);
    // Realtime for video_clips (it IS in publication)
    const channel = supabase
      .channel(`recording-status-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "video_clips", filter: `source_id=eq.${roomId}` },
        () => fetchData()
      )
      .subscribe();
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchData]);

  // Listen to recorder lifecycle events
  useEffect(() => {
    const onStarted = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setUploadState({ status: "recording", startedAt: detail.startedAt || new Date().toISOString() });
    };
    const onUploadStart = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setUploadState({
        status: "uploading",
        startedAt: detail.startedAt || new Date().toISOString(),
        durationSec: detail.durationSec,
      });
    };
    const onUploaded = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setUploadState({
        status: "uploaded",
        finishedAt: detail.finishedAt || new Date().toISOString(),
        recordingId: detail.recordingId,
      });
      fetchData();
    };
    const onFailed = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setUploadState({
        status: "failed",
        finishedAt: detail.finishedAt || new Date().toISOString(),
        error: detail.error,
      });
    };
    window.addEventListener("stream-recording-started", onStarted);
    window.addEventListener("stream-recording-upload-start", onUploadStart);
    window.addEventListener("stream-recording-uploaded", onUploaded);
    window.addEventListener("stream-recording-upload-failed", onFailed);
    return () => {
      window.removeEventListener("stream-recording-started", onStarted);
      window.removeEventListener("stream-recording-upload-start", onUploadStart);
      window.removeEventListener("stream-recording-uploaded", onUploaded);
      window.removeEventListener("stream-recording-upload-failed", onFailed);
    };
  }, [fetchData]);

  const renderUploadBanner = () => {
    switch (uploadState.status) {
      case "recording":
        return (
          <div className="flex items-center gap-2 text-xs text-white/90">
            <Circle className="w-3 h-3 fill-destructive text-destructive animate-pulse" />
            <span className="font-semibold">Grabando…</span>
            <span className="text-white/60 ml-auto">desde {fmtTime(uploadState.startedAt)}</span>
          </div>
        );
      case "uploading":
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-white/90">
              <CloudUpload className="w-3.5 h-3.5 text-primary animate-pulse" />
              <span className="font-semibold">Subiendo grabación…</span>
              <span className="text-white/60 ml-auto">inicio {fmtTime(uploadState.startedAt)}</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded bg-white/10">
              <div className="h-full w-1/2 animate-pulse rounded bg-primary" />
            </div>
            {uploadState.durationSec != null && (
              <p className="text-[10px] text-white/50">Duración grabada: {fmtDur(uploadState.durationSec)}</p>
            )}
          </div>
        );
      case "uploaded":
        return (
          <div className="flex items-center gap-2 text-xs text-white/90">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold">Grabación subida</span>
            <span className="text-white/60 ml-auto">{fmtTime(uploadState.finishedAt)}</span>
          </div>
        );
      case "failed":
        return (
          <div className="flex items-center gap-2 text-xs text-white/90">
            <XCircle className="w-3.5 h-3.5 text-destructive" />
            <span className="font-semibold">Error subiendo</span>
            <span className="text-white/60 ml-auto truncate max-w-[160px]" title={uploadState.error}>
              {uploadState.error || "ver consola"}
            </span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 text-xs text-white/60">
            <CircleDashed className="w-3.5 h-3.5" />
            <span>Sin grabación activa</span>
          </div>
        );
    }
  };

  const clipStatusBadge = (c: ClipRow) => {
    const status = (c.render_status || "").toLowerCase();
    if (c.output_url || ["completed", "done", "ready"].includes(status)) {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] gap-1">
          <CheckCircle2 className="w-2.5 h-2.5" /> Listo
        </Badge>
      );
    }
    if (["failed", "error"].includes(status)) {
      return (
        <Badge variant="destructive" className="text-[10px] gap-1">
          <XCircle className="w-2.5 h-2.5" /> Error
        </Badge>
      );
    }
    if (["rendering", "queued", "pending", "processing", "fetching", "saving"].includes(status)) {
      return (
        <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] gap-1">
          <CircleDashed className="w-2.5 h-2.5 animate-spin" /> {status}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] gap-1">
        <Clock className="w-2.5 h-2.5" /> {status || "—"}
      </Badge>
    );
  };

  const isClipGenerationPending = recordings.length > 0 && clips.length === 0 && uploadState.status !== "failed";

  return (
    <Card className="bg-white/5 border-white/10 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/80">
            Estado de grabación y clips
          </h3>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={fetchData}
          disabled={loading}
          className="h-6 w-6 p-0 text-white/60 hover:text-white hover:bg-white/10"
          title="Refrescar"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Live upload status */}
      <div className="rounded-md border border-white/10 bg-black/30 px-3 py-2">
        {renderUploadBanner()}
      </div>

      {/* Recordings list */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
          <Film className="w-3 h-3" /> Grabaciones de esta sala ({recordings.length})
        </div>
        {recordings.length === 0 ? (
          <p className="text-[10px] text-white/40 italic px-1">Aún no hay grabaciones subidas.</p>
        ) : (
          <ul className="space-y-1">
            {recordings.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-2 rounded bg-black/20 border border-white/5 px-2 py-1.5 text-[11px] text-white/80"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="font-mono text-[10px] text-white/60 shrink-0">{fmtTime(r.created_at)}</span>
                <span className="text-white/70">{fmtDur(r.duration_seconds)}</span>
                <span className="ml-auto text-white/50 text-[10px]">{fmtSize(r.file_size)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Clips list */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
            <Sparkles className="w-3 h-3" /> Auto-clips ({clips.length})
          </div>
          {clips.length > 0 && (
            <a
              href="/marketing?tab=video-studio"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-primary hover:underline flex items-center gap-1"
            >
              Video Studio <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
        {clips.length === 0 ? (
          isClipGenerationPending ? (
            <div className="rounded bg-primary/10 border border-primary/20 px-2 py-2 text-[11px] text-primary space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <CircleDashed className="w-3 h-3 animate-spin" /> Analizando grabación y generando clips…
              </div>
              <div className="h-1 w-full overflow-hidden rounded bg-primary/10">
                <div className="h-full w-2/3 animate-pulse rounded bg-primary" />
              </div>
              <p className="text-[10px] text-primary/80">Esto puede tardar unos minutos después de finalizar el stream.</p>
            </div>
          ) : (
            <p className="text-[10px] text-white/40 italic px-1">
              Los clips se generan automáticamente al finalizar el stream (si Auto-clips está activado).
            </p>
          )
        ) : (
          <ul className="space-y-1">
            {clips.map((c) => {
              const ready = !!c.output_url;
              return (
                <li
                  key={c.id}
                  className="rounded bg-black/20 border border-white/5 px-2 py-1.5 text-[11px] text-white/80 space-y-1"
                >
                  <div className="flex items-center gap-2">
                    {clipStatusBadge(c)}
                    <span className="truncate flex-1" title={c.title || ""}>
                      {c.title || "Clip sin título"}
                    </span>
                    {c.hook_score != null && (
                      <span className="text-[10px] text-amber-300/80 shrink-0">★ {c.hook_score}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-white/50">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{fmtTime(c.updated_at || c.created_at)}</span>
                    {c.start_time != null && c.end_time != null && (
                      <span>
                        · {fmtDur(Math.round(c.start_time))} → {fmtDur(Math.round(c.end_time))}
                      </span>
                    )}
                    {ready && (
                      <a
                        href={c.output_url!}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto text-primary hover:underline flex items-center gap-1"
                      >
                        Ver <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
};

export default RecordingStatusPanel;
