import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Download, Trash2, Film, Clock, HardDrive } from "lucide-react";

interface Recording {
  id: string;
  room_id: string;
  file_path: string;
  file_size: number;
  duration_seconds: number;
  recorded_by: string;
  created_at: string;
  room_title?: string;
  academy_lesson_id?: string | null;
}

const RecordingsManager = ({ roomId, portalId }: { roomId?: string; portalId?: string }) => {
  const { isAdmin, isGlobalAdmin } = useAuth();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const canDelete = isAdmin || isGlobalAdmin;

  useEffect(() => {
    loadRecordings();
  }, [roomId, portalId]);

  const loadRecordings = async () => {
    // !inner: solo grabaciones cuya sala matchee el filtro de portal (evita
    // que un IB vea grabaciones de otros portales). roomId tiene prioridad
    // (vista de una sola sala). Sin portalId (admin interno de Bullfy) → salas
    // sin portal (portal_id NULL).
    let query = supabase
      .from("live_recordings")
      .select("*, live_rooms!inner(title, portal_id)")
      .order("created_at", { ascending: false });
    if (roomId) {
      query = query.eq("room_id", roomId);
    } else if (portalId) {
      query = query.eq("live_rooms.portal_id", portalId);
    } else {
      query = query.is("live_rooms.portal_id", null);
    }
    const { data } = await query;
    if (data) {
      setRecordings(data.map((r: any) => ({
        ...r,
        room_title: r.live_rooms?.title,
      })));
    }
    setLoading(false);
  };

  const handleDownload = async (rec: Recording) => {
    // R2-stored recordings (file_path is a full URL) need server-side presigning.
    const isRemote = rec.file_path?.startsWith("http");
    if (isRemote) {
      const { data, error } = await supabase.functions.invoke("recording-download-url", {
        body: { recording_id: rec.id },
      });
      if (error || !data?.ok || !data?.url) {
        toast.error(data?.error || "Error al generar enlace de descarga");
        return;
      }
      window.open(data.url, "_blank");
      return;
    }
    const { data, error } = await supabase.storage
      .from("live-recordings")
      .createSignedUrl(rec.file_path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Error al generar enlace de descarga");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (rec: Recording) => {
    // Delete from storage
    await supabase.storage.from("live-recordings").remove([rec.file_path]);
    // Delete record
    await supabase.from("live_recordings").delete().eq("id", rec.id);
    setRecordings(prev => prev.filter(r => r.id !== rec.id));
    toast.success("Grabación eliminada");
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (loading) return null;
  if (recordings.length === 0) return (
    <p className="text-xs text-muted-foreground text-center py-3">Sin grabaciones</p>
  );

  return (
    <div className="space-y-2">
      {recordings.map(rec => (
        <div key={rec.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Film className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate flex items-center gap-2">
              {rec.room_title || "Stream"}
              {rec.academy_lesson_id && (
                <Badge variant="secondary" className="text-[10px] gap-1 h-5">
                  📚 Academy
                </Badge>
              )}
            </p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> {formatDuration(rec.duration_seconds)}
              </span>
              <span className="flex items-center gap-1">
                <HardDrive className="w-3 h-3" /> {formatSize(rec.file_size)}
              </span>
              <span>{rec.recorded_by}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {new Date(rec.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleDownload(rec)}>
              <Download className="w-4 h-4" />
            </Button>
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar grabación?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. Se eliminará el archivo y el registro.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(rec)}>Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default RecordingsManager;
