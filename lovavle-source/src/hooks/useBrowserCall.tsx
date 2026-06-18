import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toastUtils";
import { useQueryClient } from "@tanstack/react-query";

type BrowserCallState = "idle" | "connecting" | "ringing" | "in_progress" | "completed" | "failed";

interface BrowserCallApi {
  state: BrowserCallState;
  deviceReady: boolean;
  initDevice: () => Promise<void>;
  makeCall: (params: {
    leadPhone: string;
    leadId: string;
    callRecordId: string;
    welcomeMessage?: string;
  }) => void;
  hangup: () => void;
  destroy: () => void;
}

const BrowserCallContext = createContext<BrowserCallApi | null>(null);

export function BrowserCallProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const [state, setState] = useState<BrowserCallState>("idle");
  const [deviceReady, setDeviceReady] = useState(false);

  const initDevice = useCallback(async () => {
    if (deviceRef.current) return;
    if (initPromiseRef.current) return initPromiseRef.current;

    initPromiseRef.current = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("twilio-browser-token");
        if (error || data?.error) throw new Error(data?.error || error?.message);

        const device = new Device(data.token, {
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
          logLevel: 1,
        });

        device.on("registered", () => setDeviceReady(true));
        device.on("error", (err) => {
          console.error("Twilio Device error:", err);
          toast.error("Error de audio: " + err.message);
          setState("failed");
        });
        device.on("tokenWillExpire", async () => {
          const { data: refreshData } = await supabase.functions.invoke("twilio-browser-token");
          if (refreshData?.token) device.updateToken(refreshData.token);
        });

        await device.register();
        deviceRef.current = device;
      } catch (err: any) {
        console.error("Error initializing Twilio Device:", err);
        toast.error("Error al inicializar audio: " + (err.message || ""));
        initPromiseRef.current = null;
      }
    })();

    return initPromiseRef.current;
  }, []);

  const makeCall = useCallback(
    (params: { leadPhone: string; leadId: string; callRecordId: string; welcomeMessage?: string }) => {
      if (!deviceRef.current) {
        toast.error("Dispositivo no inicializado");
        return;
      }

      setState("connecting");

      const connectParams: Record<string, string> = {
        To: params.leadPhone,
        lead_id: params.leadId,
        call_record_id: params.callRecordId,
      };
      if (params.welcomeMessage) connectParams.welcome_message = params.welcomeMessage;

      deviceRef.current
        .connect({ params: connectParams })
        .then((activeCall) => {
          callRef.current = activeCall;
          activeCall.on("ringing", () => setState("ringing"));
          activeCall.on("accept", () => {
            setState("in_progress");
            qc.invalidateQueries({ queryKey: ["sales-agent-status"] });
          });
          activeCall.on("disconnect", () => {
            setState("completed");
            callRef.current = null;
            qc.invalidateQueries({ queryKey: ["lead-calls"] });
            qc.invalidateQueries({ queryKey: ["sales-agent-status"] });
          });
          activeCall.on("cancel", () => {
            setState("completed");
            callRef.current = null;
          });
          activeCall.on("error", (err) => {
            console.error("Call error:", err);
            setState("failed");
            callRef.current = null;
          });
        })
        .catch((err) => {
          console.error("Connect error:", err);
          setState("failed");
          toast.error("Error al conectar llamada");
        });
    },
    [qc]
  );

  const hangup = useCallback(() => {
    if (callRef.current) {
      callRef.current.disconnect();
      callRef.current = null;
    }
    setState("completed");
  }, []);

  const destroy = useCallback(() => {
    if (callRef.current) {
      callRef.current.disconnect();
      callRef.current = null;
    }
    if (deviceRef.current) {
      deviceRef.current.destroy();
      deviceRef.current = null;
    }
    initPromiseRef.current = null;
    setDeviceReady(false);
    setState("idle");
  }, []);

  useEffect(() => {
    return () => {
      if (callRef.current) callRef.current.disconnect();
      if (deviceRef.current) deviceRef.current.destroy();
    };
  }, []);

  return (
    <BrowserCallContext.Provider value={{ state, deviceReady, initDevice, makeCall, hangup, destroy }}>
      {children}
    </BrowserCallContext.Provider>
  );
}

export function useBrowserCall(): BrowserCallApi {
  const ctx = useContext(BrowserCallContext);
  if (!ctx) {
    throw new Error("useBrowserCall must be used within a BrowserCallProvider");
  }
  return ctx;
}
