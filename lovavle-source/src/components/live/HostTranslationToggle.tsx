import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Languages, Loader2 } from "lucide-react";
import { useLiveFeatureAccess } from "@/hooks/useLiveFeatureAccess";

interface Props {
  roomId: string;
  hostId: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  isActive: boolean;
  isConnecting: boolean;
  error: string | null;
  lastPublishedAt: number | null;
  lastDetectedAt: number | null;
}

/**
 * Toggle for the HOST to enable live translation broadcast.
 * Visible only if the host has the `live_translation` feature permission.
 */
const HostTranslationToggle = ({
  enabled,
  onEnabledChange,
  isActive,
  isConnecting,
  error,
  lastPublishedAt,
  lastDetectedAt,
}: Props) => {
  const access = useLiveFeatureAccess("live_translation");

  if (access !== true) return null;

  const publishedRecently = lastPublishedAt && Date.now() - lastPublishedAt < 15000;
  const detectedRecently = lastDetectedAt && Date.now() - lastDetectedAt < 15000;

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          <Languages className="w-3.5 h-3.5 text-primary" />
          Traducción en vivo
        </h4>
        {isActive && publishedRecently && (
          <Badge variant="secondary" className="text-[10px] animate-pulse">Transmitiendo</Badge>
        )}
        {isActive && !publishedRecently && detectedRecently && (
          <Badge variant="secondary" className="text-[10px] animate-pulse">Procesando voz...</Badge>
        )}
        {isActive && !publishedRecently && !detectedRecently && (
          <Badge variant="outline" className="text-[10px]">Esperando voz...</Badge>
        )}
      </div>
      {error && <p className="text-[10px] text-destructive">{error}</p>}
      <Button
        size="sm"
        variant={enabled ? "ghost" : "outline"}
        className={`w-full text-xs gap-1.5 ${enabled ? "text-destructive" : ""}`}
        onClick={() => onEnabledChange(!enabled)}
        disabled={isConnecting}
      >
        {isConnecting ? (
          <><Loader2 className="w-3 h-3 animate-spin" /> Conectando...</>
        ) : enabled ? "Desactivar traducción" : "Activar para viewers"}
      </Button>
      <p className="text-[10px] text-muted-foreground">
        Requiere micrófono activo (transcripción IA escuchando). Los viewers podrán activar subtítulos en su idioma (ES, EN, PT, FR, DE, IT, RU).
      </p>
    </div>
  );
};

export default HostTranslationToggle;
