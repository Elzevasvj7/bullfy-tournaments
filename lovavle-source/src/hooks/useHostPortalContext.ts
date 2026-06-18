import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves the portal context for an internal host:
 *  - portalId from live_rooms by roomId
 *  - the host's own partner_users.id (is_host = true) inside that portal,
 *    matched by the host's auth email
 *
 * Used by host shells to enable the in-stream "Operar ahora" overlay
 * (BUY/SELL buttons) for hosts who connected their MT5 account from
 * the partner portal admin section.
 */
export function useHostPortalContext(roomId?: string | null) {
  const [portalId, setPortalId] = useState<string | null>(null);
  const [partnerUserId, setPartnerUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) { setPortalId(null); setPartnerUserId(null); return; }
    let alive = true;

    (async () => {
      try {
        const { data: room } = await supabase
          .from("live_rooms")
          .select("portal_id")
          .eq("id", roomId)
          .maybeSingle();
        const pid = (room as any)?.portal_id ?? null;
        if (!alive) return;
        setPortalId(pid);
        if (!pid) { setPartnerUserId(null); return; }

        const { data: session } = await supabase.auth.getSession();
        const email = session?.session?.user?.email?.toLowerCase();
        if (!email) { setPartnerUserId(null); return; }

        const { data: pu } = await supabase
          .from("partner_users")
          .select("id")
          .eq("portal_id", pid)
          .eq("is_host", true)
          .ilike("email", email)
          .maybeSingle();
        if (!alive) return;
        setPartnerUserId((pu as any)?.id ?? null);
      } catch {
        if (!alive) return;
        setPortalId(null);
        setPartnerUserId(null);
      }
    })();

    return () => { alive = false; };
  }, [roomId]);

  return { portalId, partnerUserId };
}
