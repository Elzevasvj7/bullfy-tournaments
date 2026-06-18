import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Play, Pause, Scissors, RotateCcw } from "lucide-react";

interface Clip {
  id: string;
  title: string;
  start_time: number;
  end_time: number;
  suggested_caption: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clip: Clip | null;
  videoUrl: string;
  onSave: (updated: Clip) => void;
}

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${sec.toString().padStart(2, "0")}.${ms}`;
};

export default function ClipTimelineEditor({ open, onOpenChange, clip, videoUrl, onSave }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [original, setOriginal] = useState({ start: 0, end: 0 });

  useEffect(() => {
    if (!clip) return;
    setStart(clip.start_time);
    setEnd(clip.end_time);
    setTitle(clip.title);
    setCaption(clip.suggested_caption);
    setOriginal({ start: clip.start_time, end: clip.end_time });
  }, [clip]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => setDuration(v.duration);
    const onTime = () => {
      setCurrentTime(v.currentTime);
      // Auto-pause at end marker
      if (v.currentTime >= end) {
        v.pause();
        setPlaying(false);
      }
    };
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("timeupdate", onTime);
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("timeupdate", onTime);
    };
  }, [end]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
      setPlaying(false);
    } else {
      if (v.currentTime < start || v.currentTime >= end) v.currentTime = start;
      v.play();
      setPlaying(true);
    }
  };

  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, t));
  };

  const setStartHere = () => setStart(Math.min(currentTime, end - 1));
  const setEndHere = () => setEnd(Math.max(currentTime, start + 1));
  const reset = () => {
    setStart(original.start);
    setEnd(original.end);
  };

  const clipDuration = end - start;
  const startPct = duration > 0 ? (start / duration) * 100 : 0;
  const endPct = duration > 0 ? (end / duration) * 100 : 100;
  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSave = () => {
    if (!clip) return;
    if (clipDuration < 1 || clipDuration > 120) {
      return;
    }
    onSave({ ...clip, start_time: start, end_time: end, title, suggested_caption: caption });
    onOpenChange(false);
  };

  if (!clip) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editor de Clip</DialogTitle>
          <DialogDescription>
            Ajusta los puntos de inicio y fin, título y caption antes de generar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Video preview */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full"
              onClick={togglePlay}
              crossOrigin="anonymous"
            />
            <button
              onClick={togglePlay}
              className="absolute bottom-2 left-2 bg-black/70 hover:bg-black/90 text-white rounded-full p-2 transition"
            >
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
              {fmt(currentTime)} / {fmt(duration)}
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Línea de tiempo — arrastra el playhead, usa botones para marcar in/out
            </Label>
            <div className="relative h-12 bg-muted rounded-lg overflow-hidden">
              {/* Selected range */}
              <div
                className="absolute top-0 bottom-0 bg-primary/30 border-l-2 border-r-2 border-primary"
                style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
              />
              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                style={{ left: `${playheadPct}%` }}
              />
              {/* Click area */}
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={(e) => seek(parseFloat(e.target.value))}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>0:00</span>
              <span>{fmt(duration)}</span>
            </div>
          </div>

          {/* In/Out controls */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Inicio: {fmt(start)}</Label>
              <Slider
                value={[start]}
                min={0}
                max={Math.max(duration - 1, 1)}
                step={0.1}
                onValueChange={([v]) => {
                  setStart(Math.min(v, end - 1));
                  seek(v);
                }}
              />
              <Button size="sm" variant="outline" onClick={setStartHere} className="w-full gap-1">
                <Scissors className="w-3 h-3" /> Marcar inicio aquí
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Fin: {fmt(end)}</Label>
              <Slider
                value={[end]}
                min={Math.min(start + 1, duration)}
                max={duration || 1}
                step={0.1}
                onValueChange={([v]) => {
                  setEnd(Math.max(v, start + 1));
                  seek(v);
                }}
              />
              <Button size="sm" variant="outline" onClick={setEndHere} className="w-full gap-1">
                <Scissors className="w-3 h-3" /> Marcar fin aquí
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
            <span className="text-sm">
              Duración: <strong>{fmt(clipDuration)}</strong>
              {(clipDuration < 1 || clipDuration > 120) && (
                <span className="text-destructive ml-2">(debe estar entre 1s y 120s)</span>
              )}
            </span>
            <Button size="sm" variant="ghost" onClick={reset} className="gap-1">
              <RotateCcw className="w-3 h-3" /> Restaurar
            </Button>
          </div>

          {/* Metadata */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Título del clip</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Caption / texto del subtítulo</Label>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={clipDuration < 1 || clipDuration > 120}
            >
              Guardar cambios
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
