import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type LiveFeatureKey =
  | "meeting_mode"
  | "webinar_pro_controls"
  | "bullfy_family_mode"
  | "breakout_rooms"
  | "recording_egress"
  | "live_transcription"
  | "polls_in_meeting"
  | "whiteboard"
  | "live_translation";

export const LIVE_FEATURE_LABELS: Record<LiveFeatureKey, string> = {
  meeting_mode: "Modo Reunión (Zoom)",
  webinar_pro_controls: "Controles Webinar Pro",
  bullfy_family_mode: "Modo Bullfy Family",
  breakout_rooms: "Salas de Breakout",
  recording_egress: "Grabación en Servidor",
  live_transcription: "Transcripción en Vivo",
  polls_in_meeting: "Encuestas en Meeting",
  whiteboard: "Pizarra Compartida",
  live_translation: "Traducción en Vivo",
};

export const LIVE_FEATURE_DESCRIPTIONS: Record<LiveFeatureKey, string> = {
  meeting_mode: "Permite crear salas bidireccionales tipo Zoom con cámara y micrófono para todos.",
  webinar_pro_controls: "Mute all, kick, pin, lower hands para el host.",
  bullfy_family_mode: "Crear salas privadas Bullfy Family con invitación a miembros y link público.",
  breakout_rooms: "Salas paralelas dentro de una sesión principal.",
  recording_egress: "Grabación server-side de la sesión completa (LiveKit Egress).",
  live_transcription: "Transcripción automática en vivo con IA.",
  polls_in_meeting: "Crear y responder encuestas durante la sesión.",
  whiteboard: "Pizarra colaborativa compartida (Excalidraw).",
  live_translation: "Habilita traducción en vivo: subtítulos para viewers en streams y voz traducida en meetings.",
};

export const ALL_LIVE_FEATURES: LiveFeatureKey[] = [
  "meeting_mode",
  "webinar_pro_controls",
  "bullfy_family_mode",
  "breakout_rooms",
  "recording_egress",
  "live_transcription",
  "polls_in_meeting",
  "whiteboard",
  "live_translation",
];

/**
 * Hook to check if the current authenticated user has access to a specific live feature.
 * Returns null while loading, true/false after resolution.
 */
export function useLiveFeatureAccess(featureKey: LiveFeatureKey): boolean | null {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setHasAccess(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("has_live_feature_access", {
        _user_id: user.id,
        _feature_key: featureKey,
      });
      if (!active) return;
      if (error) {
        console.warn("[useLiveFeatureAccess] error:", error.message);
        setHasAccess(false);
      } else {
        setHasAccess(!!data);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id, featureKey]);

  return hasAccess;
}

/**
 * Hook to bulk-check multiple features at once. Returns a map.
 */
export function useLiveFeatureAccessBulk(featureKeys: LiveFeatureKey[]): Record<string, boolean> | null {
  const { user } = useAuth();
  const [accessMap, setAccessMap] = useState<Record<string, boolean> | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setAccessMap({});
      return;
    }
    const results = await Promise.all(
      featureKeys.map(async (key) => {
        const { data } = await supabase.rpc("has_live_feature_access", {
          _user_id: user.id,
          _feature_key: key,
        });
        return [key, !!data] as const;
      })
    );
    setAccessMap(Object.fromEntries(results));
  }, [user?.id, JSON.stringify(featureKeys)]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return accessMap;
}
