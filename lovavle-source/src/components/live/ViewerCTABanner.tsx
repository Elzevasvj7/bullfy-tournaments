import { useState, useEffect, useCallback } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { Button } from "@/components/ui/button";
import { useLiveKitReady } from "@/hooks/useLiveKitReady";
import { supabase } from "@/integrations/supabase/client";
import {
  ExternalLink, X, Sparkles, Download,
  FileText, FileImage, FileSpreadsheet, FileVideo, File as FileIcon,
} from "lucide-react";

interface CTAData {
  title: string;
  url: string;
  buttonText: string;
  imagePath?: string | null;
  imageOnly?: boolean;
  displayMode?: string;
  ctaKind?: string;
  fileId?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  description?: string;
}

const formatSize = (bytes?: number) => {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getFileIcon = (mime?: string) => {
  if (!mime) return FileIcon;
  if (mime.startsWith("image/")) return FileImage;
  if (mime.startsWith("video/")) return FileVideo;
  if (mime.includes("pdf")) return FileText;
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) return FileSpreadsheet;
  if (mime.includes("word") || mime.includes("document") || mime.includes("text")) return FileText;
  return FileIcon;
};

const ViewerCTABanner = () => {
  const room = useRoomContext();
  const isLkReady = useLiveKitReady(room);
  const [cta, setCta] = useState<CTAData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const applyCTAMsg = useCallback((msg: any) => {
    if (msg.type !== "cta") return;
    if (msg.action === "show") {
      setCta({
        title: msg.title,
        url: msg.url,
        buttonText: msg.buttonText,
        imagePath: msg.imagePath,
        imageOnly: msg.imageOnly,
        displayMode: msg.displayMode,
        ctaKind: msg.ctaKind,
        fileId: msg.fileId,
        fileUrl: msg.fileUrl,
        fileName: msg.fileName,
        fileSize: msg.fileSize,
        mimeType: msg.mimeType,
        description: msg.description,
      });
      setDismissed(false);
    } else if (msg.action === "hide") {
      setCta(null);
      setDismissed(false);
    }
  }, []);

  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        applyCTAMsg(JSON.parse(new TextDecoder().decode(payload)));
      } catch {}
    };
    const handleLocal = (e: Event) => {
      applyCTAMsg((e as CustomEvent).detail);
    };
    if (room && isLkReady) {
      room.on(RoomEvent.DataReceived, handleData);
    }
    window.addEventListener("bullfy-cta", handleLocal);
    return () => {
      if (room && isLkReady) {
        room.off(RoomEvent.DataReceived, handleData);
      }
      window.removeEventListener("bullfy-cta", handleLocal);
    };
  }, [room, isLkReady, applyCTAMsg]);

  if (!cta || dismissed) return null;

  const handleClick = () => {
    if (cta.url) window.open(cta.url, "_blank", "noopener,noreferrer");
  };

  // ===== File CTA — downloadable file with tracking =====
  if (cta.ctaKind === "file" && cta.fileUrl) {
    const Icon = getFileIcon(cta.mimeType);

    const handleDownload = async () => {
      // Track download (anonymous-friendly)
      try {
        const { data: session } = await supabase.auth.getSession();
        const viewerId = session?.session?.user?.id ?? null;
        const viewerEmail = session?.session?.user?.email ?? null;
        const roomId = (room as any)?.name || null;
        await supabase.from("cta_file_downloads").insert({
          cta_file_id: cta.fileId!,
          room_id: roomId,
          viewer_id: viewerId,
          viewer_email: viewerEmail,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        });
      } catch {
        // tracking is best-effort
      }

      // Force download via temporary anchor
      try {
        const res = await fetch(cta.fileUrl!);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = cta.fileName || "download";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      } catch {
        // Fallback: open in new tab
        window.open(cta.fileUrl!, "_blank", "noopener,noreferrer");
      }
    };

    return (
      <div className="shrink-0 z-30 animate-in slide-in-from-top duration-500">
        <div className="mx-2 mt-2 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(255,60,172,0.3)]">
          <div className="bg-gradient-to-r from-[#FF6B00] via-[#FF3CAC] to-[#146EF5] p-[2px] rounded-xl">
            <div className="bg-gradient-to-r from-[#1a0a2e]/85 via-[#16213e]/85 to-[#0a1628]/85 backdrop-blur-md rounded-xl px-4 py-3 flex items-center justify-between gap-3 relative">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF6B00] to-[#FF3CAC] flex items-center justify-center shadow-lg">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate drop-shadow-lg">{cta.title}</p>
                  {cta.description && (
                    <p className="text-xs text-white/80 line-clamp-2 mt-0.5">{cta.description}</p>
                  )}
                  <p className="text-[10px] text-white/60 mt-0.5 truncate">
                    {cta.fileName} {cta.fileSize ? `· ${formatSize(cta.fileSize)}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="shrink-0 gap-1.5 h-8 text-xs font-bold bg-gradient-to-r from-[#FF6B00] to-[#FF3CAC] hover:from-[#FF8533] hover:to-[#FF5CC5] text-white border-0 shadow-lg shadow-[#FF3CAC]/30 transition-all hover:scale-105"
                  onClick={handleDownload}
                >
                  <Download className="w-3.5 h-3.5" /> {cta.buttonText || "Descargar"}
                </Button>
              </div>
              <button
                onClick={() => setDismissed(true)}
                className="shrink-0 p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-white/70" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isVideo = cta.imagePath && /\.(mp4|webm)$/i.test(cta.imagePath);
  const isGifOrMedia = cta.imagePath && /\.(gif|mp4|webm)$/i.test(cta.imagePath);

  // Banner strip mode — horizontal ticker at top of screen
  if (cta.displayMode === "banner_strip" && cta.imagePath) {
    return (
      <div className="shrink-0 z-30 w-full">
        <div
          className={`w-full h-[44px] overflow-hidden bg-black ${cta.url ? "cursor-pointer" : ""}`}
          onClick={cta.url ? handleClick : undefined}
        >
          {isVideo ? (
            <video
              src={cta.imagePath}
              autoPlay loop muted playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={cta.imagePath}
              alt={cta.title}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <button onClick={() => setDismissed(true)}
          className="absolute top-0.5 right-1 bg-black/50 hover:bg-black/70 rounded-full p-0.5 transition-colors z-10">
          <X className="w-3 h-3 text-white" />
        </button>
      </div>
    );
  }

  // Image-only CTA — compact banner, not full-screen
  if (cta.imageOnly && cta.imagePath) {
    return (
      <div className="shrink-0 z-30 animate-in slide-in-from-top duration-500">
        <div className="bg-gradient-to-r from-[#FF6B00] via-[#FF3CAC] to-[#146EF5] p-[2px] m-2 rounded-xl shadow-[0_0_20px_rgba(255,60,172,0.3)]">
          <div className="bg-black/90 rounded-xl p-3 flex flex-col items-center gap-2 relative backdrop-blur-sm">
            <button onClick={() => setDismissed(true)}
              className="absolute top-1.5 right-1.5 bg-white/10 hover:bg-white/20 rounded-full p-1 transition-colors z-10">
              <X className="w-3.5 h-3.5 text-white" />
            </button>
            {isVideo ? (
              <video
                src={cta.imagePath!} autoPlay loop muted playsInline
                className={`rounded-lg max-h-[30vh] max-w-full object-contain ${cta.url ? "cursor-pointer hover:scale-[1.01] transition-transform" : ""}`}
                onClick={cta.url ? handleClick : undefined}
              />
            ) : (
              <img
                src={cta.imagePath!} alt={cta.title}
                className={`rounded-lg max-h-[30vh] max-w-full object-contain ${cta.url ? "cursor-pointer hover:scale-[1.01] transition-transform" : ""}`}
                onClick={cta.url ? handleClick : undefined}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Standard vibrant banner — inline, not absolute overlay
  return (
    <div className="shrink-0 z-30 animate-in slide-in-from-top duration-500">
      <div className="mx-2 mt-2 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(255,60,172,0.3)]">
        <div className="bg-gradient-to-r from-[#FF6B00] via-[#FF3CAC] to-[#146EF5] p-[2px] rounded-xl">
          <div className="bg-gradient-to-r from-[#1a0a2e] via-[#16213e] to-[#0a1628] rounded-xl px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#FF6B00] to-[#FF3CAC] flex items-center justify-center animate-pulse">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              {cta.imagePath && (
                <img src={cta.imagePath} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0 ring-2 ring-white/20" />
              )}
              <span className="text-sm font-bold text-white truncate drop-shadow-lg">{cta.title}</span>
              {cta.url && (
                <Button
                  size="sm"
                  className="shrink-0 gap-1.5 h-7 text-xs font-bold bg-gradient-to-r from-[#FF6B00] to-[#FF3CAC] hover:from-[#FF8533] hover:to-[#FF5CC5] text-white border-0 shadow-lg shadow-[#FF3CAC]/30 transition-all hover:scale-105"
                  onClick={handleClick}
                >
                  {cta.buttonText} <ExternalLink className="w-3 h-3" />
                </Button>
              )}
            </div>
            <button onClick={() => setDismissed(true)}
              className="shrink-0 p-1 rounded-full hover:bg-white/10 transition-colors">
              <X className="w-3.5 h-3.5 text-white/70" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewerCTABanner;
