import { useCallback, useEffect, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent, type LocalParticipant } from "livekit-client";
import { Calculator, Power, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toastUtils";

interface Props {
  localParticipant?: LocalParticipant | null;
}

type CalcMode = "off" | "self" | "mirror";

/**
 * Host-side toggle for the Risk Calculator overlay. Lives inside the CTA panel.
 * Two mutually exclusive modes broadcasted via LiveKit DataChannel:
 *  - "self":   each viewer ve la suya propia (con sus datos del Bridge)
 *  - "mirror": todos los viewers ven en read-only la calculadora del host
 */
const RiskCalculatorHostToggle = ({ localParticipant }: Props) => {
  const room = useRoomContext();
  const [mode, setModeState] = useState<CalcMode>("off");

  useEffect(() => {
    if (!room) return;
    const onData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg?.type === "risk-calc-set") {
          if (!msg.enabled) setModeState("off");
          else setModeState((msg.mode === "mirror" ? "mirror" : "self") as CalcMode);
        }
      } catch { return; }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => { room.off(RoomEvent.DataReceived, onData); };
  }, [room]);

  const broadcast = useCallback(async (next: CalcMode) => {
    try {
      const participant = localParticipant ?? room?.localParticipant;
      if (!participant) return;
      const payload = {
        type: "risk-calc-set",
        enabled: next !== "off",
        mode: next === "off" ? "self" : next,
      };
      window.dispatchEvent(new CustomEvent("bullfy-risk-calc-set", { detail: payload }));
      const data = new TextEncoder().encode(JSON.stringify(payload));
      await participant.publishData(data, { reliable: true });
    } catch (e: unknown) {
      console.warn("[RiskCalcToggle] broadcast failed:", e instanceof Error ? e.message : e);
    }
  }, [localParticipant, room]);

  const setMode = async (next: CalcMode) => {
    setModeState(next);
    await broadcast(next);
    if (next === "self") toast.info("Calculadora activada — cada viewer ve la suya");
    else if (next === "mirror") toast.info("Mostrando tu calculadora a los viewers (read-only)");
    else toast.info("Calculadora desactivada");
  };

  const labelBadge =
    mode === "self" ? "EN VIVO" : mode === "mirror" ? "ESPEJO" : "OFF";
  const badgeColor =
    mode === "self" ? "bg-emerald-600"
    : mode === "mirror" ? "bg-[#146EF5]"
    : "bg-muted text-muted-foreground";

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Calculator className="w-4 h-4 text-primary shrink-0" />
          <h4 className="text-sm font-semibold truncate">Calculadora de Riesgo</h4>
        </div>
        <Badge className={`text-[10px] h-5 px-1.5 ${badgeColor}`}>{labelBadge}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        <strong>Activar para viewers:</strong> cada viewer usa su propia cuenta MT5.{" "}
        <strong>Mostrar la mía:</strong> todos los viewers ven tu calculadora en vivo (solo lectura).
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant={mode === "self" ? "destructive" : "default"}
          className="gap-1 px-2 text-[11px] min-w-0"
          onClick={() => setMode(mode === "self" ? "off" : "self")}
        >
          <Power className="w-3 h-3 shrink-0" />
          <span className="truncate">{mode === "self" ? "Desactivar" : "Activar viewers"}</span>
        </Button>
        <Button
          size="sm"
          variant={mode === "mirror" ? "destructive" : "secondary"}
          className="gap-1 px-2 text-[11px] min-w-0"
          onClick={() => setMode(mode === "mirror" ? "off" : "mirror")}
        >
          <Eye className="w-3 h-3 shrink-0" />
          <span className="truncate">{mode === "mirror" ? "Detener espejo" : "Mostrar la mía"}</span>
        </Button>
      </div>
    </div>
  );
};

export default RiskCalculatorHostToggle;
