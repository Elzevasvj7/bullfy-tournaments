import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseViewerPresenceOptions {
  roomId: string;
  userName: string;
  correo?: string;
  telefono?: string;
  streamLeadId?: string;
  enabled: boolean;
}

/**
 * Tracks viewer presence in a live stream.
 * Creates a record on join, updates left_at + duration on leave/unload.
 */
export const useViewerPresence = ({
  roomId,
  userName,
  correo,
  telefono,
  streamLeadId,
  enabled,
}: UseViewerPresenceOptions) => {
  const presenceIdRef = useRef<string | null>(null);
  const joinedAtRef = useRef<Date | null>(null);

  useEffect(() => {
    if (!enabled || !roomId) return;

    const insertPresence = async () => {
      const now = new Date();
      joinedAtRef.current = now;

      const { data, error } = await supabase
        .from("live_viewer_presence")
        .insert({
          room_id: roomId,
          user_name: userName,
          correo: correo || null,
          telefono: telefono || null,
          stream_lead_id: streamLeadId || null,
          joined_at: now.toISOString(),
        })
        .select("id")
        .single();

      if (!error && data) {
        presenceIdRef.current = data.id;
      }
    };

    insertPresence();

    const updatePresence = () => {
      if (!presenceIdRef.current || !joinedAtRef.current) return;
      const durationSeconds = Math.round((Date.now() - joinedAtRef.current.getTime()) / 1000);

      // Use sendBeacon for reliability on page unload
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const body = JSON.stringify({
        left_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
      });

      // Try fetch with keepalive first, fallback to sendBeacon
      try {
        fetch(
          `${supabaseUrl}/rest/v1/live_viewer_presence?id=eq.${presenceIdRef.current}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
              Prefer: "return=minimal",
            },
            body,
            keepalive: true,
          }
        );
      } catch {
        // Fallback: sendBeacon doesn't support PATCH, so this is best-effort
        console.warn("Could not update presence on leave");
      }
    };

    const handleBeforeUnload = () => updatePresence();
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      updatePresence();
    };
  }, [enabled, roomId, userName, correo, telefono, streamLeadId]);
};
