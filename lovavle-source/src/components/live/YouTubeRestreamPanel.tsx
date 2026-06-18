import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toastUtils";
import { supabase } from "@/integrations/supabase/client";
import { Youtube, Loader2, Unplug } from "lucide-react";

interface Props {
  roomName: string;
}

const YouTubeRestreamPanel = ({ roomName }: Props) => {
  const [streamKey, setStreamKey] = useState("");
  const [egressId, setEgressId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(false);

  const callEdgeFunction = useCallback(async (body: Record<string, unknown>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const jwt = sessionData?.session?.access_token;
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-restream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(body),
      }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error");
    return json;
  }, []);

  const handleStart = useCallback(async () => {
    if (!streamKey.trim()) {
      toast.error("Ingresa tu Stream Key de YouTube");
      return;
    }
    setLoading(true);
    try {
      const result = await callEdgeFunction({
        action: "start",
        roomName,
        streamKey: streamKey.trim(),
      });
      setEgressId(result.egressId);
      setActive(true);
      toast.success("¡Transmitiendo a YouTube! La señal tardará ~15-30s en aparecer.");
    } catch (err: any) {
      toast.error("Error al iniciar: " + err.message);
    }
    setLoading(false);
  }, [streamKey, roomName, callEdgeFunction]);

  const handleStop = useCallback(async () => {
    setLoading(true);
    try {
      await callEdgeFunction({
        action: "stop",
        roomName,
        egressId,
      });
      setActive(false);
      setEgressId(null);
      toast.success("Transmisión a YouTube detenida");
    } catch (err: any) {
      toast.error("Error al detener: " + err.message);
    }
    setLoading(false);
  }, [roomName, egressId, callEdgeFunction]);

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Youtube className="w-5 h-5 text-red-500" />
        <span className="font-semibold text-sm">YouTube Restream</span>
        {active && <Badge variant="destructive" className="text-[10px] animate-pulse">EN VIVO</Badge>}
      </div>

      {!active ? (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Stream Key</Label>
            <Input
              type="password"
              placeholder="xxxx-xxxx-xxxx-xxxx-xxxx"
              value={streamKey}
              onChange={(e) => setStreamKey(e.target.value)}
              className="text-xs h-8"
            />
            <p className="text-[10px] text-muted-foreground">
              Encuéntralo en YouTube Studio → Transmitir en vivo → Clave de stream
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleStart}
            disabled={loading || !streamKey.trim()}
            className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Youtube className="w-3.5 h-3.5" />}
            Iniciar Restream
          </Button>
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Transmitiendo a YouTube con todos los efectos visuales (tickers, CTAs, overlays).
          </p>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleStop}
            disabled={loading}
            className="w-full gap-2"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />}
            Detener Restream
          </Button>
        </div>
      )}
    </div>
  );
};

export default YouTubeRestreamPanel;
