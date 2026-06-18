import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import logoSrc from "@/assets/logo-bullfy.png";
import { isWhiteLabelPortal } from "@/hooks/usePortalBranding";

interface WaitingRoomViewerProps {
  roomId: string;
}

interface WaitingConfig {
  waiting_mode: string;
  waiting_template_id: string | null;
  waiting_bg_path: string | null;
  waiting_bg_type: string | null;
  waiting_title: string | null;
  waiting_subtitle: string | null;
  waiting_countdown_to: string | null;
}

interface WaitingTemplate {
  bg_path: string | null;
  bg_type: string;
  title: string;
  subtitle: string | null;
  show_countdown: boolean;
}

const CountdownTimer = ({ targetDate }: { targetDate: string }) => {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0, expired: false });

  useEffect(() => {
    const target = new Date(targetDate).getTime();
    const update = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, expired: true });
        return;
      }
      setTimeLeft({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        expired: false,
      });
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (timeLeft.expired) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-white" />
        <span className="text-white/80 text-sm">Iniciando en cualquier momento...</span>
      </div>
    );
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="flex items-center justify-center gap-3">
      {[
        { value: pad(timeLeft.hours), label: "HRS" },
        { value: pad(timeLeft.minutes), label: "MIN" },
        { value: pad(timeLeft.seconds), label: "SEG" },
      ].map((item, i) => (
        <div key={i} className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 min-w-[64px] text-center">
          <span className="text-3xl font-mono font-bold text-white">{item.value}</span>
          <p className="text-xs text-white/60 mt-1">{item.label}</p>
        </div>
      ))}
    </div>
  );
};

const WaitingRoomViewer = ({ roomId }: WaitingRoomViewerProps) => {
  const [config, setConfig] = useState<WaitingConfig | null>(null);
  const [template, setTemplate] = useState<WaitingTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  // Portales white-label (club-financiero) ocultan el logo de Bullfy.
  const [whiteLabel, setWhiteLabel] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: room } = await supabase
        .from("live_rooms")
        .select("waiting_mode, waiting_template_id, waiting_bg_path, waiting_bg_type, waiting_title, waiting_subtitle, waiting_countdown_to, partner_portals(nombre_portal)")
        .eq("id", roomId)
        .single();

      if (cancelled) return;
      if (room) {
        setConfig(room as WaitingConfig);
        setTemplate(null);
        setWhiteLabel(isWhiteLabelPortal((room as any).partner_portals?.nombre_portal));

        if (room.waiting_mode === "template") {
          // Use specific template if set, otherwise fall back to default template
          let tplQuery = supabase
            .from("live_waiting_templates")
            .select("bg_path, bg_type, title, subtitle, show_countdown");

          if (room.waiting_template_id) {
            tplQuery = tplQuery.eq("id", room.waiting_template_id);
          } else {
            tplQuery = tplQuery.eq("is_default", true);
          }

          const { data: tpl } = await tplQuery.limit(1).single();
          if (!cancelled && tpl) setTemplate(tpl as WaitingTemplate);
        }
      }
      if (!cancelled) setLoading(false);
    };
    load();

    // Realtime: si el host cambia la configuración de la sala de espera
    // (fondo, título, countdown, plantilla), refrescar en vivo — así el
    // espectador (y la preview del admin) ven el cambio sin recargar.
    const channel = supabase
      .channel(`waiting-config-${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_rooms", filter: `id=eq.${roomId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const resolved = useMemo(() => {
    if (!config) return null;
    if (config.waiting_mode === "template" && template) {
      return {
        bgPath: template.bg_path,
        bgType: template.bg_type,
        title: template.title,
        subtitle: template.subtitle,
        showCountdown: template.show_countdown,
        countdownTo: config.waiting_countdown_to,
      };
    }
    return {
      bgPath: config.waiting_bg_path,
      bgType: config.waiting_bg_type || "image",
      title: config.waiting_title || "Comenzamos pronto...",
      subtitle: config.waiting_subtitle,
      showCountdown: true,
      countdownTo: config.waiting_countdown_to,
    };
  }, [config, template]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Fallback if no config
  const title = resolved?.title || "Comenzamos pronto...";
  const subtitle = resolved?.subtitle;
  const bgPath = resolved?.bgPath;
  const bgType = resolved?.bgType || "image";
  const countdownTo = resolved?.countdownTo;
  const showCountdown = resolved?.showCountdown !== false;

  return (
    <div className="relative h-full w-full bg-black flex items-center justify-center overflow-hidden">
      {/* Background */}
      {bgPath && bgType === "image" && (
        <img src={bgPath} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {bgPath && bgType === "video" && (
        <video src={bgPath} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" />
      )}
      {!bgPath && (
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary)/0.3)] via-black to-[hsl(var(--primary)/0.1)]" />
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Content */}
      <div className="relative z-10 text-center space-y-6 px-8 max-w-xl">
        {/* El logo de Bullfy se oculta en portales white-label (su propia marca
            ya está en el fondo de la sala de espera). */}
        {!whiteLabel && <img src={logoSrc} alt="Bullfy" className="h-12 w-auto mx-auto" />}
        
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-white">{title}</h1>
          {subtitle && <p className="text-lg text-white/70">{subtitle}</p>}
        </div>

        {showCountdown && countdownTo && (
          <CountdownTimer targetDate={countdownTo} />
        )}

        {(!countdownTo || !showCountdown) && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-white/60 text-sm">El host iniciará la transmisión pronto</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WaitingRoomViewer;
