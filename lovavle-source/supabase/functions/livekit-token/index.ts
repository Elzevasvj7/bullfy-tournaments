import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Minimal JWT builder for LiveKit tokens (no external deps needed)
function base64url(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createLiveKitToken(
  apiKey: string,
  apiSecret: string,
  roomName: string,
  participantName: string,
  canPublish: boolean,
  ttlSeconds = 3600
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);

  const claims: Record<string, unknown> = {
    iss: apiKey,
    sub: participantName,
    nbf: now,
    exp: now + ttlSeconds,
    jti: participantName,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish,
      canSubscribe: true,
      canPublishData: true,
    },
  };

  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(claims)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(signingInput));
  const sigB64 = base64url(new Uint8Array(sig));

  return `${signingInput}.${sigB64}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { roomName, participantName, role, inviteCode, guestUpgrade, isPublicStream, isPortalUser, viewerEmail, viewerPortalId, joinRequestId, requesterSessionId } = await req.json();

    if (!roomName || !participantName) {
      return new Response(
        JSON.stringify({ error: "roomName and participantName are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default canPublish: only host. We'll upgrade later if room_type allows it.
    let canPublish = role === "host";

    // Egress compositor: no auth needed, subscribe-only
    if (role === "egress") {
      const apiKey = Deno.env.get("LIVEKIT_API_KEY")!;
      const apiSecret = Deno.env.get("LIVEKIT_API_SECRET")!;
      const livekitUrl = Deno.env.get("LIVEKIT_URL")!;
      const token = await createLiveKitToken(
        apiKey,
        apiSecret,
        roomName,
        "egress-compositor",
        false, // canPublish = false
        7200   // 2h TTL
      );
      return new Response(
        JSON.stringify({ token, url: livekitUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check authentication: either a valid JWT user, a valid invite code, or public stream
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    let isAuthenticated = false;

    // Public stream: verify room is marked as public
    if (isPublicStream && roomName) {
      const adminClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: roomData } = await adminClient
        .from("live_rooms")
        .select("is_public_stream")
        .eq("livekit_room_name", roomName)
        .eq("is_public_stream", true)
        .maybeSingle();

      if (roomData) {
        isAuthenticated = true;
      }
    }

    // Portal user: authenticated via partner portal session — verify room belongs to a portal
    if (!isAuthenticated && isPortalUser && roomName) {
      const adminClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: roomData } = await adminClient
        .from("live_rooms")
        .select("portal_id")
        .eq("livekit_room_name", roomName)
        .not("portal_id", "is", null)
        .maybeSingle();

      if (roomData?.portal_id) {
        isAuthenticated = true;
      }
    }

    // Knock-to-enter: approved join request OR allow_anyone_with_link
    if (!isAuthenticated && roomName) {
      const adminClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: roomRow } = await adminClient
        .from("live_rooms")
        .select("id, allow_anyone_with_link, room_type")
        .eq("livekit_room_name", roomName)
        .maybeSingle();

      if (roomRow) {
        // Path A: room allows anyone with the link
        if (roomRow.allow_anyone_with_link === true) {
          isAuthenticated = true;
        }
        // Path B: explicit approved join request
        else if (joinRequestId && requesterSessionId) {
          const { data: jr } = await adminClient
            .from("live_room_join_requests")
            .select("id, status, requester_session_id")
            .eq("id", joinRequestId)
            .eq("room_id", roomRow.id)
            .eq("requester_session_id", requesterSessionId)
            .eq("status", "approved")
            .maybeSingle();
          if (jr) isAuthenticated = true;
        }
      }
    }

    if (!isAuthenticated && authHeader?.startsWith("Bearer ")) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!error && user?.id) {
        isAuthenticated = true;
      }
    }

    // If not authenticated via JWT or public stream, check invite code
    if (!isAuthenticated && inviteCode) {
      const adminClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Guest upgrade (co-stream): verify the code is still valid
      if (guestUpgrade) {
        // First try: check if code was used by this participant (private codes)
        const { data: usedCode } = await adminClient
          .from("live_invite_codes")
          .select("id")
          .eq("code", inviteCode)
          .eq("used_by_name", participantName)
          .not("used_at", "is", null)
          .maybeSingle();

        if (usedCode) {
          isAuthenticated = true;
        } else {
          // Fallback: for public codes, just verify the code exists and is not expired
          const { data: publicCode } = await adminClient
            .from("live_invite_codes")
            .select("id, is_public")
            .eq("code", inviteCode)
            .eq("is_public", true)
            .gt("expires_at", new Date().toISOString())
            .maybeSingle();

          if (publicCode) {
            isAuthenticated = true;
          }
        }
      } else {
        const { data: codeData, error: codeError } = await adminClient
          .from("live_invite_codes")
          .select("id, room_id, used_at, expires_at, is_public")
          .eq("code", inviteCode)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();

        if (codeError || !codeData) {
          return new Response(
            JSON.stringify({ error: "Invalid or expired invite code" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Private codes: must not be used yet
        if (!codeData.is_public && codeData.used_at) {
          return new Response(
            JSON.stringify({ error: "This invite code has already been used" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Only mark as used for private codes
        if (!codeData.is_public) {
          await adminClient
            .from("live_invite_codes")
            .update({ used_at: new Date().toISOString(), used_by_name: participantName })
            .eq("id", codeData.id);
        }

        isAuthenticated = true;
      }
    }

    if (!isAuthenticated) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - login or provide invite code" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Room type check: meeting/webinar_pro grant publish to all authenticated participants ──
    const adminClientForRoom = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: roomMeta } = await adminClientForRoom
      .from("live_rooms")
      .select("id, room_type, host_id, required_tiers, portal_id")
      .eq("livekit_room_name", roomName)
      .maybeSingle();

    const roomType = roomMeta?.room_type || "broadcast";

    // For meeting / webinar_pro / bullfy_family: validate the HOST has feature access, then grant publish to all
    if (roomType !== "broadcast") {
      if (roomMeta?.host_id) {
        const featureKey =
          roomType === "webinar_pro" ? "webinar_pro_controls" :
          roomType === "bullfy_family" ? "bullfy_family_mode" :
          "meeting_mode";
        const { data: hostHasAccess } = await adminClientForRoom.rpc("has_live_feature_access", {
          _user_id: roomMeta.host_id,
          _feature_key: featureKey,
        });
        if (!hostHasAccess) {
          return new Response(
            JSON.stringify({ error: "El host no tiene permiso para usar este tipo de sala" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      canPublish = true;
    }

    // ── Bullfy Family access check (only for non-host viewers) ──
    if (roomType === "bullfy_family" && role !== "host" && roomMeta?.id) {
      // Allow if: (1) public stream, (2) used a public/private invite code,
      // (3) authenticated user is invited, (4) allow_anyone_with_link is enabled,
      // or (5) has an approved knock-to-enter join request
      const isPublicGuest = isPublicStream === true;
      const hasValidCode = !!inviteCode; // already validated above
      let isInvitedUser = false;

      // Knock-to-enter: approved join request OR room allows anyone with link
      let hasKnockAccess = false;
      const { data: roomAccess } = await adminClientForRoom
        .from("live_rooms")
        .select("allow_anyone_with_link")
        .eq("id", roomMeta.id)
        .maybeSingle();
      if (roomAccess?.allow_anyone_with_link === true) {
        hasKnockAccess = true;
      } else if (joinRequestId && requesterSessionId) {
        const { data: jr } = await adminClientForRoom
          .from("live_room_join_requests")
          .select("id")
          .eq("id", joinRequestId)
          .eq("room_id", roomMeta.id)
          .eq("requester_session_id", requesterSessionId)
          .eq("status", "approved")
          .maybeSingle();
        if (jr) hasKnockAccess = true;
      }

      if (authHeader?.startsWith("Bearer ")) {
        const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user: viewerUser } } = await supabaseUser.auth.getUser();
        if (viewerUser?.id) {
          // Host always allowed
          if (viewerUser.id === roomMeta.host_id) {
            isInvitedUser = true;
          } else {
            const { data: invite } = await adminClientForRoom
              .from("live_room_invitations")
              .select("id")
              .eq("room_id", roomMeta.id)
              .eq("invited_user_id", viewerUser.id)
              .maybeSingle();
            if (invite) isInvitedUser = true;
          }
        }
      }

      if (!isPublicGuest && !hasValidCode && !isInvitedUser && !hasKnockAccess) {
        return new Response(
          JSON.stringify({ error: "Sala Bullfy Family privada — necesitas invitación" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Tier-based access check (only for non-host viewers) ──
    if (role !== "host" && roomName) {
      if (roomMeta?.required_tiers && roomMeta.required_tiers.length > 0 && roomMeta.portal_id) {
        if (viewerEmail && viewerPortalId) {
          const { data: partnerUser } = await adminClientForRoom
            .from("partner_users")
            .select("tier")
            .eq("email", viewerEmail)
            .eq("portal_id", viewerPortalId)
            .eq("status", "approved")
            .maybeSingle();

          if (partnerUser && !roomMeta.required_tiers.includes(partnerUser.tier)) {
            const tierLabels: Record<string, string> = { general: "General", vip: "VIP", platino: "Platino" };
            const requiredNames = roomMeta.required_tiers.map((t: string) => tierLabels[t] || t).join(", ");
            return new Response(
              JSON.stringify({ error: `Acceso restringido. Este stream requiere nivel: ${requiredNames}` }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    const apiKey = Deno.env.get("LIVEKIT_API_KEY")!;
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET")!;
    const livekitUrl = Deno.env.get("LIVEKIT_URL")!;

    const token = await createLiveKitToken(
      apiKey,
      apiSecret,
      roomName,
      participantName,
      canPublish
    );

    return new Response(
      JSON.stringify({ token, url: livekitUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
