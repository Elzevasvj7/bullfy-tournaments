import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Paperclip, Download, Loader2, Image as ImageIcon, Video } from "lucide-react";
import type { RequestAttachment } from "@/components/ib-externo/RequestAttachmentsUploader";

interface Props {
  attachments: RequestAttachment[];
}

const RequestAttachmentsViewer = ({ attachments }: Props) => {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!attachments?.length) { setLoading(false); return; }
      setLoading(true);
      const map: Record<string, string> = {};
      for (const a of attachments) {
        const { data } = await supabase.storage
          .from("ib-request-attachments")
          .createSignedUrl(a.path, 3600);
        if (data?.signedUrl) map[a.path] = data.signedUrl;
      }
      if (!cancelled) {
        setUrls(map);
        setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [attachments]);

  if (!attachments?.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
        <Paperclip className="w-3.5 h-3.5" /> Archivos de referencia ({attachments.length})
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando archivos...
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {attachments.map((a) => {
            const url = urls[a.path];
            const isVideo = a.type?.startsWith("video/");
            return (
              <div key={a.path} className="rounded-lg border border-border bg-secondary/20 p-2 space-y-1.5">
                {url ? (
                  isVideo ? (
                    <video src={url} controls className="w-full h-32 rounded object-cover bg-black" />
                  ) : (
                    <a href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt={a.name} className="w-full h-32 rounded object-cover" />
                    </a>
                  )
                ) : (
                  <div className="w-full h-32 rounded bg-secondary flex items-center justify-center">
                    {isVideo ? <Video className="w-6 h-6 text-muted-foreground" /> : <ImageIcon className="w-6 h-6 text-muted-foreground" />}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <p className="flex-1 text-[11px] text-foreground truncate">{a.name}</p>
                  {url && (
                    <Button asChild variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <a href={url} download={a.name} target="_blank" rel="noreferrer">
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RequestAttachmentsViewer;
