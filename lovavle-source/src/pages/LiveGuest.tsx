import { useState, useCallback, useEffect, useRef } from "react";
import { useViewerPresence } from "@/hooks/useViewerPresence";
import { useSearchParams } from "react-router-dom";
import { LiveKitRoom, useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import "@livekit/components-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/lib/toastUtils";
import { Eye, Loader2, Radio, AlertCircle, Lock, LogOut, DoorOpen } from "lucide-react";
import { PasswordInput } from "@/components/shared/PasswordInput";
import CoStreamInviteDialog from "@/components/live/CoStreamInviteDialog";
import MeetingViewerShell from "@/components/live/MeetingViewerShell";
import WaitingRoomViewer from "@/components/live/WaitingRoomViewer";
import WaitingForApproval from "@/components/live/WaitingForApproval";
import SafeLiveKitGate from "@/components/live/SafeLiveKitGate";
import PhoneInput, { validatePhone, getFullPhone } from "@/components/shared/PhoneInput";
import OTPVerificationStep from "@/components/shared/OTPVerificationStep";
import { supabase } from "@/integrations/supabase/client";
import { normalizeLiveRoomType } from "@/lib/liveRoomType";
import { useLiveKitReady } from "@/hooks/useLiveKitReady";
import { usePortalBranding, isWhiteLabelPortal, usePortalFavicon, hexToHSL } from "@/hooks/usePortalBranding";
import { getCustomDomainSlug } from "@/lib/portalRouting";
import { QRCodeSVG } from "qrcode.react";

/**
 * GuestContent — wrapper visual del stream para el flujo de invitado / link público / link privado.
 * Toda la lógica de auth, OTP, lead registration y session vive en el componente padre LiveGuest.
 * Aquí SOLO se renderiza el shell visual una vez ya hay token de LiveKit.
 * Reutiliza MeetingViewerShell para garantizar el mismo layout que viewers autenticados:
 * video full-screen en desktop con chat lateral derecho, encuestas funcionales y banners overlay.
 */
const GuestContent = ({
  roomId,
  roomTitle,
  isCoHost,
  onAcceptCoStream,
  onLeave,
  roomType,
  portalId,
  partnerUserId,
}: {
  roomId: string;
  roomTitle: string;
  isCoHost: boolean;
  onAcceptCoStream: () => void;
  onLeave: () => void;
  roomType: string;
  portalId?: string | null;
  partnerUserId?: string | null;
}) => {
  const normalizedRoomType = normalizeLiveRoomType(roomType) as
    | "meeting"
    | "webinar_pro"
    | "bullfy_family"
    | "broadcast";
  const lkRoom = useRoomContext();
  const isLkReady = useLiveKitReady(lkRoom);

  useEffect(() => {
    // Guard: never call lkRoom.on() until the Room is fully connected.
    // Otherwise the SDK's internal `.room` engine is null and crashes ("null is an object (evaluating 'ye.room')").
    if (!lkRoom || !isLkReady) return;
    const myIdentity = lkRoom.localParticipant?.identity;
    const handleData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === "stream-ended") {
          toast.info("La transmisión ha finalizado.");
          setTimeout(() => {
            onLeave();
          }, 1500);
        }
        // Co-host revocation: host removed publish permission for this guest
        if (msg.type === "costream-revoke" && msg.targetIdentity === myIdentity) {
          toast.info("El host ha revocado tu co-transmisión. Volviendo a modo espectador...");
          window.dispatchEvent(new CustomEvent("bullfy-guest-costream-revoke"));
        }
      } catch {}
    };
    lkRoom.on(RoomEvent.DataReceived, handleData);

    // Realtime broadcast fallback (in case data channel is missed)
    const channel = supabase.channel(`costream-signal-${roomId}`)
      .on("broadcast", { event: "costream-revoke" }, (payload: any) => {
        const msg = payload.payload;
        if (msg?.targetIdentity === myIdentity) {
          toast.info("El host ha revocado tu co-transmisión. Volviendo a modo espectador...");
          window.dispatchEvent(new CustomEvent("bullfy-guest-costream-revoke"));
        }
      })
      .subscribe();

    return () => {
      lkRoom.off(RoomEvent.DataReceived, handleData);
      supabase.removeChannel(channel);
    };
  }, [lkRoom, isLkReady, roomId]);

  return (
    <>
      <CoStreamInviteDialog onAcceptCoStream={onAcceptCoStream} />
      <MeetingViewerShell
        roomId={roomId}
        roomTitle={roomTitle}
        roomType={normalizedRoomType}
        isCoHost={isCoHost}
        chatEnabled={true}
        onLeave={onLeave}
        portalId={portalId}
        partnerUserId={partnerUserId}
      />
    </>
  );
};

const GUEST_SESSION_KEY = "bullfy-guest-session";
const GUEST_DRAFT_KEY = "bullfy-guest-draft";

interface GuestDraft {
  code: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestCountryCode: string;
  guestStep: string;
  timestamp: number;
}

function loadGuestDraft(): GuestDraft | null {
  try {
    const raw = sessionStorage.getItem(GUEST_DRAFT_KEY) ?? localStorage.getItem(GUEST_DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as GuestDraft;
    // Expire drafts after 1 hour
    if (Date.now() - draft.timestamp > 60 * 60 * 1000) {
      sessionStorage.removeItem(GUEST_DRAFT_KEY);
      localStorage.removeItem(GUEST_DRAFT_KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function clearGuestDraft() {
  try {
    sessionStorage.removeItem(GUEST_DRAFT_KEY);
    localStorage.removeItem(GUEST_DRAFT_KEY);
  } catch {}
}

interface GuestSession {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestCountryCode: string;
  code: string;
  roomId: string;
  roomTitle: string;
  roomLivekitName: string;
  streamLeadId: string | null;
  portalId: string | null;
  timestamp: number;
}

function loadGuestSession(): GuestSession | null {
  try {
    const raw = sessionStorage.getItem(GUEST_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as GuestSession;
    // Expire after 4 hours
    if (Date.now() - session.timestamp > 4 * 60 * 60 * 1000) {
      sessionStorage.removeItem(GUEST_SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function saveGuestSession(session: Omit<GuestSession, "timestamp">) {
  try {
    sessionStorage.setItem(GUEST_SESSION_KEY, JSON.stringify({ ...session, timestamp: Date.now() }));
  } catch {}
}

// Stable per-browser session id used for knock-to-enter
const SESSION_ID_KEY = "bullfy-guest-session-id";
function getOrCreateSessionId(): string {
  try {
    let s = localStorage.getItem(SESSION_ID_KEY);
    if (!s) {
      s = crypto.randomUUID();
      localStorage.setItem(SESSION_ID_KEY, s);
    }
    return s;
  } catch {
    return crypto.randomUUID();
  }
}

const LiveGuest = () => {
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get("code") || "";
  const roomFromUrl = searchParams.get("room") || "";
  const isPublicStream = searchParams.get("public") === "true";
  const isPortalUser = searchParams.get("portalUser") === "true";
  const isKnock = searchParams.get("knock") === "1";
  const nameFromUrl = searchParams.get("name") || "";
  const portalIdFromUrl = searchParams.get("portalId") || "";
  const partnerUserIdFromUrl = searchParams.get("partnerUserId") || "";
  const returnUrlFromParams = searchParams.get("returnUrl") || "";

  const savedSession = loadGuestSession();
  const savedDraft = loadGuestDraft();
  const requesterSessionId = getOrCreateSessionId();

  const [code, setCode] = useState(savedSession?.code || savedDraft?.code || codeFromUrl);
  const [guestName, setGuestName] = useState(savedSession?.guestName || savedDraft?.guestName || nameFromUrl || "");
  const [guestEmail, setGuestEmail] = useState(savedSession?.guestEmail || savedDraft?.guestEmail || "");
  const [guestPhone, setGuestPhone] = useState(savedSession?.guestPhone || savedDraft?.guestPhone || "");
  const [guestCountryCode, setGuestCountryCode] = useState(savedSession?.guestCountryCode || savedDraft?.guestCountryCode || "CO");
  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState("");
  const [roomId, setRoomId] = useState(savedSession?.roomId || roomFromUrl);
  const [roomTitle, setRoomTitle] = useState(savedSession?.roomTitle || "");
  const [roomLivekitName, setRoomLivekitName] = useState(savedSession?.roomLivekitName || "");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [isCoHost, setIsCoHost] = useState(false);
  const [streamLeadId, setStreamLeadId] = useState<string | null>(savedSession?.streamLeadId || null);
  const [roomStatus, setRoomStatus] = useState<string>("");
  const [roomType, setRoomType] = useState<string>("broadcast");
  // Portal dueño de la sala (para de-brandear Bullfy en portales white-label).
  const [roomPortalId, setRoomPortalId] = useState<string | null>(null);
  const [roomPortalSlug, setRoomPortalSlug] = useState<string | null>(null);
  const [roomPortalName, setRoomPortalName] = useState<string | null>(null);
  const [guestStep, setGuestStep] = useState<"form" | "verify_email" | "verify_sms" | "create_password" | "telegram_link" | "reconnect" | "public_name" | "knock_name" | "knock_waiting" | "knock_connecting">(() => {
    if (isKnock) return "knock_name";
    if (isPublicStream || isPortalUser) return "public_name";
    if (savedSession) return "reconnect";
    // Restore mid-flow form/verification step (only safe steps, never knock_waiting / knock_connecting)
    const safeSteps = ["form", "verify_email", "verify_sms", "create_password", "public_name"];
    if (savedDraft?.guestStep && safeSteps.includes(savedDraft.guestStep)) {
      return savedDraft.guestStep as any;
    }
    return "form";
  });
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [pendingRoomData, setPendingRoomData] = useState<any>(null);
  const [guestVerified, setGuestVerified] = useState(false);
  const [guestPassword, setGuestPassword] = useState("");
  const [guestPasswordConfirm, setGuestPasswordConfirm] = useState("");
  const [joinRequestId, setJoinRequestId] = useState<string | null>(null);
  // Telegram linking step (Fase 5B)
  const [telegramLink, setTelegramLink] = useState<{
    token: string;
    link: string;
    botUsername: string;
    required: boolean;
  } | null>(null);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [pendingConnectRoom, setPendingConnectRoom] = useState<any>(null);
  const knockConnectStartedRef = useRef(false);
  const autoConnectStartedRef = useRef(false);


  // Persist form draft on every change so a refresh / tab suspend doesn't wipe progress
  useEffect(() => {
    // Only persist while still in the registration flow (not connected to LiveKit)
    if (token) return;
    const draftSteps = ["form", "verify_email", "verify_sms", "create_password", "public_name", "knock_name"];
    if (!draftSteps.includes(guestStep)) return;
    try {
      const draft: GuestDraft = {
        code,
        guestName,
        guestEmail,
        guestPhone,
        guestCountryCode,
        guestStep,
        timestamp: Date.now(),
      };
      const payload = JSON.stringify(draft);
      sessionStorage.setItem(GUEST_DRAFT_KEY, payload);
      localStorage.setItem(GUEST_DRAFT_KEY, payload);
    } catch {}
  }, [code, guestName, guestEmail, guestPhone, guestCountryCode, guestStep, token]);

  // Track room status for waiting room display
  useEffect(() => {
    if (!roomId) return;
    // Fetch initial status
    const fetchStatus = async () => {
      const { data } = await supabase
        .from("live_rooms")
        .select("status, room_type, portal_id, partner_portals(nombre_portal, display_name)")
        .eq("id", roomId)
        .single();
      if (data) {
        setRoomStatus(data.status);
        setRoomType(normalizeLiveRoomType((data as any).room_type));
        setRoomPortalId((data as any).portal_id ?? null);
        setRoomPortalSlug((data as any).partner_portals?.nombre_portal ?? null);
        setRoomPortalName((data as any).partner_portals?.display_name ?? null);
      }
    };
    fetchStatus();

    const channel = supabase
      .channel(`guest-room-status-${roomId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "live_rooms",
        filter: `id=eq.${roomId}`,
      }, (payload: any) => {
        if (payload.new?.status) setRoomStatus(payload.new.status);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId]);
  const { branding: roomBranding } = usePortalBranding(roomPortalId || undefined);
  // White-label: por el portal de la sala O directamente por el dominio actual
  // (clubfinanciero.pro lo resuelve sincrónico desde el hostname → sin esperar
  // el fetch de la sala, evita el flash de "Bullfy Live").
  const whiteLabel = isWhiteLabelPortal(roomPortalSlug) || isWhiteLabelPortal(getCustomDomainSlug());

  // Favicon del portal en /live/guest (esta página no es un layout de portal,
  // así que el favicon hay que aplicarlo aquí). Gateado a white-label internamente.
  usePortalFavicon(roomPortalSlug || getCustomDomainSlug() || undefined, roomBranding.logo_url);

  // En /live/guest no se aplica el branding del portal, así que --primary queda
  // en el azul Bullfy por defecto (spinners, acentos). Para portales white-label
  // (club-financiero) fijamos el color de la marca solo en esta página; al salir
  // se restaura. No toca a otros IBs (gateado por whiteLabel).
  useEffect(() => {
    if (!whiteLabel || !roomBranding?.primary_color) return;
    const root = document.documentElement;
    root.style.setProperty("--primary", hexToHSL(roomBranding.primary_color));
    if (roomBranding.accent_color) root.style.setProperty("--accent", hexToHSL(roomBranding.accent_color));
    return () => {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--accent");
    };
  }, [whiteLabel, roomBranding.primary_color, roomBranding.accent_color]);

  const exitDestination = isPortalUser && returnUrlFromParams ? returnUrlFromParams : "https://www.bullfy.com";

  // Redirect when stream ends (detected via Realtime DB status change)
  useEffect(() => {
    if (roomStatus === "ended") {
      toast.info("La transmisión ha finalizado.");
      setTimeout(() => {
        window.location.href = exitDestination;
      }, 1500);
    }
  }, [roomStatus, exitDestination]);

  const handleExitStream = useCallback(() => {
    window.location.href = exitDestination;
  }, [exitDestination]);


  const fullPhone = getFullPhone(guestPhone, guestCountryCode);

  useViewerPresence({
    roomId,
    userName: guestName,
    correo: guestEmail,
    telefono: fullPhone,
    streamLeadId: streamLeadId || undefined,
    enabled: !!token,
  });

  const phoneValidation = validatePhone(guestPhone, guestCountryCode);
  const isFormValid = code.trim() && guestName.trim() && guestEmail.trim() && phoneValidation.valid;

  // Step 1: Validate invite code + send email OTP
  const handleStartVerification = useCallback(async () => {
    if (!isFormValid) {
      toast.error("Completa todos los campos correctamente");
      return;
    }
    setConnecting(true);
    setError("");

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Validate invite code first
      const roomRes = await fetch(`${supabaseUrl}/rest/v1/live_invite_codes?code=eq.${encodeURIComponent(code.trim())}&select=room_id,used_at,expires_at,is_public,live_rooms(id,title,livekit_room_name,status,portal_id)`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });
      const roomData = await roomRes.json();

      if (!roomData || roomData.length === 0) {
        setError("Código de invitación no encontrado");
        setConnecting(false);
        return;
      }

      const inviteRecord = roomData[0];
      if (!inviteRecord.is_public && inviteRecord.used_at) {
        setError("Este código ya fue utilizado");
        setConnecting(false);
        return;
      }
      if (new Date(inviteRecord.expires_at) < new Date()) {
        setError("Este código ha expirado");
        setConnecting(false);
        return;
      }

      const room = inviteRecord.live_rooms;
      if (!room) {
        setError("No se encontró la sala asociada");
        setConnecting(false);
        return;
      }

      // Store room data for after verification
      setPendingRoomData({ room, inviteRecord });

      // Send email OTP
      const { data, error: otpErr } = await supabase.functions.invoke("send-email-otp", {
        body: { email: guestEmail.trim(), purpose: "guest_email" },
      });

      if (otpErr || !data?.success) {
        toast.error(data?.error || "Error al enviar código por email");
      } else {
        toast.success("Código enviado a tu correo electrónico");
        setGuestStep("verify_email");
      }
    } catch (err: any) {
      setError(err.message || "Error al validar");
    }
    setConnecting(false);
  }, [code, guestName, guestEmail, guestPhone, guestCountryCode, isFormValid]);

  // Step 2: Verify email OTP → auto send SMS OTP
  const handleVerifyGuestEmail = useCallback(async (otpCode: string) => {
    setVerifyLoading(true);
    const { data, error: err } = await supabase.functions.invoke("verify-otp", {
      body: { email: guestEmail.trim(), code: otpCode, purpose: "guest_email" },
    });
    if (err || !data?.ok) {
      const errMsg = data?.error || (err instanceof Error ? err.message : null) || "Código inválido";
      toast.error(errMsg);
    } else {
      toast.success("Email verificado ✓ Enviando código a tu teléfono...");
      const { data: smsData } = await supabase.functions.invoke("send-sms-otp", {
        body: { email: guestEmail.trim(), phone: fullPhone, purpose: "guest_sms" },
      });
      if (smsData?.success) {
        setGuestStep("verify_sms");
        toast.success("Código enviado a tu teléfono");
      } else {
        toast.error(smsData?.error || "Error al enviar SMS");
      }
    }
    setVerifyLoading(false);
  }, [guestEmail, fullPhone]);

  // Fetch LiveKit token + connect to the room (final stage of guest flow)
  const connectToRoom = useCallback(async (room: any) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    // Fetch current room status
    const { data: currentRoom } = await supabase
      .from("live_rooms")
      .select("status")
      .eq("id", room.id)
      .single();

    const currentStatus = currentRoom?.status || room.status;
    setRoomStatus(currentStatus);

    if (currentStatus === "waiting") {
      setGuestStep("reconnect");
      toast.info("La sala de espera está activa. Te conectaremos cuando inicie el stream.");
      return;
    }

    // Room is live — get LiveKit token
    const res = await fetch(`${supabaseUrl}/functions/v1/livekit-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}`, apikey: anonKey },
      body: JSON.stringify({
        roomName: room.livekit_room_name,
        participantName: guestName.trim(),
        role: "viewer",
        inviteCode: code.trim(),
      }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener token");

    setToken(json.token);
    setLivekitUrl(json.url);
  }, [guestName, code]);

  // Shared logic: register lead + (optional) Telegram link + connect to stream
  const proceedAfterVerification = useCallback(async (password?: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const room = pendingRoomData.room;

      setRoomId(room.id);
      setRoomTitle(room.title);
      setRoomLivekitName(room.livekit_room_name);

      // Save guest as stream lead (with optional password)
      let leadId = streamLeadId;
      try {
        const leadBody: Record<string, unknown> = {
          nombre: guestName.trim(),
          correo: guestEmail.trim(),
          telefono: fullPhone,
          room_id: room.id,
          room_title: room.title,
          portal_id: room.portal_id || null,
          invite_code: code.trim(),
        };
        if (password && password.length >= 8) {
          leadBody.password = password;
        }
        const leadRes = await fetch(`${supabaseUrl}/functions/v1/register-stream-guest`, {
          method: "POST",
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(leadBody),
        });
        const leadData = await leadRes.json();
        if (leadRes.ok && leadData?.lead_id) {
          leadId = leadData.lead_id;
          setStreamLeadId(leadId);
        }
        if (leadData?.cross_portal_existing) {
          toast.warning(
            `Ya tienes una cuenta con este correo en "${leadData.cross_portal_existing.portal_name}". Tu acceso permanece allí: ${leadData.cross_portal_existing.portal_url}`,
            { duration: 12000 }
          );
        }
      } catch (leadErr) {
        console.error("No se pudo guardar el lead:", leadErr);
      }

      // Save session for re-entry
      saveGuestSession({
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
        guestPhone,
        guestCountryCode,
        code: code.trim(),
        roomId: room.id,
        roomTitle: room.title,
        roomLivekitName: room.livekit_room_name,
        streamLeadId: leadId,
        portalId: room.portal_id || null,
      });
      // Verification + lead saved → no need to keep the form draft
      clearGuestDraft();

      // Fase 5B: opcional paso de vinculación de Telegram
      try {
        const { data: tgData } = await supabase.functions.invoke("generate-telegram-link-token", {
          body: { lead_id: leadId, lead_email: guestEmail.trim(), lead_phone: fullPhone },
        });
        if (tgData?.ok && tgData?.enabled && tgData?.token) {
          setTelegramLink({
            token: tgData.token,
            link: tgData.link,
            botUsername: tgData.bot_username,
            required: !!tgData.required,
          });
          setTelegramLinked(false);
          setPendingConnectRoom(room);
          setGuestStep("telegram_link");
          return;
        }
      } catch (tgErr) {
        console.warn("Telegram link step skipped:", tgErr);
      }

      // Continue with normal LiveKit connect
      await connectToRoom(room);
    } catch (err: any) {
      setError(err.message || "Error al conectar");
      toast.error("Error: " + err.message);
    }
  }, [pendingRoomData, guestName, guestEmail, fullPhone, code, guestPhone, guestCountryCode, streamLeadId, connectToRoom]);


  // Step 3: Verify SMS OTP → show password step or connect
  const handleVerifyGuestSms = useCallback(async (otpCode: string) => {
    setVerifyLoading(true);
    const { data, error: err } = await supabase.functions.invoke("verify-otp", {
      body: { email: guestEmail.trim(), code: otpCode, purpose: "guest_sms" },
    });
    if (err || !data?.ok) {
      const errMsg = data?.error || (err instanceof Error ? err.message : null) || "Código inválido";
      toast.error(errMsg);
      setVerifyLoading(false);
      return;
    }

    toast.success("Teléfono verificado ✓");
    setGuestVerified(true);
    setGuestStep("reconnect");
    clearGuestDraft();

    // If stream is linked to a portal, ask for password
    const room = pendingRoomData?.room;
    if (room?.portal_id) {
      setGuestStep("create_password");
      setVerifyLoading(false);
      return;
    }

    // No portal — proceed directly
    await proceedAfterVerification();
    setVerifyLoading(false);
  }, [guestEmail, pendingRoomData, proceedAfterVerification]);

  // Step 4 (optional): Create password → connect
  const handlePasswordSubmit = useCallback(async () => {
    if (guestPassword.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (guestPassword !== guestPasswordConfirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setVerifyLoading(true);
    await proceedAfterVerification(guestPassword);
    setVerifyLoading(false);
  }, [guestPassword, guestPasswordConfirm, proceedAfterVerification]);

  // Skip password step
  const handleSkipPassword = useCallback(async () => {
    setVerifyLoading(true);
    await proceedAfterVerification();
    setVerifyLoading(false);
  }, [proceedAfterVerification]);

  // Fase 5B — Telegram linking step
  const handleTelegramContinue = useCallback(async () => {
    if (!pendingConnectRoom) return;
    setVerifyLoading(true);
    try {
      await connectToRoom(pendingConnectRoom);
    } catch (err: any) {
      setError(err.message || "Error al conectar");
      toast.error("Error: " + err.message);
    }
    setVerifyLoading(false);
  }, [pendingConnectRoom, connectToRoom]);

  // Poll check-telegram-link every 2s while in telegram_link step
  useEffect(() => {
    if (guestStep !== "telegram_link" || !telegramLink?.token || telegramLinked) return;
    let cancelled = false;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const poll = async () => {
      try {
        const r = await fetch(
          `${supabaseUrl}/functions/v1/check-telegram-link?token=${encodeURIComponent(telegramLink.token)}`,
          { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } }
        );
        const j = await r.json();
        if (!cancelled && j?.ok && j?.linked) {
          setTelegramLinked(true);
          toast.success("✅ Telegram vinculado. Conectando al stream...");
          setTimeout(() => { if (!cancelled) handleTelegramContinue(); }, 800);
        }
      } catch {}
    };
    const id = setInterval(poll, 2000);
    poll();
    return () => { cancelled = true; clearInterval(id); };
  }, [guestStep, telegramLink, telegramLinked, handleTelegramContinue]);


  const handleResendGuestEmail = useCallback(async () => {
    setResendLoading(true);
    const { data } = await supabase.functions.invoke("send-email-otp", {
      body: { email: guestEmail.trim(), purpose: "guest_email" },
    });
    if (data?.success) toast.success("Nuevo código enviado a tu correo");
    else toast.error(data?.error || "Error al reenviar");
    setResendLoading(false);
  }, [guestEmail]);

  const handleResendGuestSms = useCallback(async () => {
    setResendLoading(true);
    const { data } = await supabase.functions.invoke("send-sms-otp", {
      body: { email: guestEmail.trim(), phone: fullPhone, purpose: "guest_sms" },
    });
    if (data?.success) {
      if (data.fallback === "email") toast.success("Código enviado a tu email (SMS no disponible)");
      else toast.success("Nuevo código enviado a tu teléfono");
    } else toast.error(data?.error || "Error al reenviar");
    setResendLoading(false);
  }, [guestEmail, fullPhone]);

  const handleForceEmailFallbackGuest = useCallback(async () => {
    setResendLoading(true);
    const { data } = await supabase.functions.invoke("send-sms-otp", {
      body: { email: guestEmail.trim(), phone: fullPhone, purpose: "guest_sms", force_email_fallback: true },
    });
    if (data?.success) toast.success("Código enviado a tu correo electrónico");
    else toast.error(data?.error || "Error al enviar por email");
    setResendLoading(false);
  }, [guestEmail, fullPhone]);

  // Reconnect using saved session (skip form + OTP)
  const handleReconnect = useCallback(async () => {
    const session = loadGuestSession();
    if (!session) {
      setGuestStep("form");
      toast.error("Sesión expirada, por favor ingresa tus datos de nuevo");
      return;
    }
    setConnecting(true);
    setError("");

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Re-register as lead (increments stream_count)
      try {
        const leadRes = await fetch(`${supabaseUrl}/functions/v1/register-stream-guest`, {
          method: "POST",
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: session.guestName,
            correo: session.guestEmail,
            telefono: getFullPhone(session.guestPhone, session.guestCountryCode),
            room_id: session.roomId,
            room_title: session.roomTitle,
            portal_id: session.portalId || null,
            invite_code: session.code,
          }),
        });
        const leadData = await leadRes.json();
        if (leadRes.ok && leadData?.lead_id) {
          setStreamLeadId(leadData.lead_id);
        }
      } catch {}

      setRoomId(session.roomId);
      setRoomTitle(session.roomTitle);
      setRoomLivekitName(session.roomLivekitName);
      setGuestVerified(true);

      // Check current room status — if waiting, don't fetch LiveKit token yet
      const { data: currentRoom } = await supabase
        .from("live_rooms")
        .select("status")
        .eq("id", session.roomId)
        .single();

      const currentStatus = currentRoom?.status || "";
      setRoomStatus(currentStatus);

      if (currentStatus === "waiting") {
        toast.info("La sala de espera está activa. Te conectaremos cuando inicie el stream.");
        setConnecting(false);
        return;
      }

      // Get new LiveKit token
      const res = await fetch(`${supabaseUrl}/functions/v1/livekit-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}`, apikey: anonKey },
        body: JSON.stringify({
          roomName: session.roomLivekitName,
          participantName: session.guestName,
          role: "viewer",
          inviteCode: session.code,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al obtener token");

      setToken(json.token);
      setLivekitUrl(json.url);
    } catch (err: any) {
      setError(err.message || "Error al reconectar");
      toast.error("No se pudo reconectar: " + err.message);
      setGuestStep("form");
      sessionStorage.removeItem(GUEST_SESSION_KEY);
      clearGuestDraft();
    }
    setConnecting(false);
  }, []);

  const handleAcceptCoStream = useCallback(async () => {
    try {
      toast.info("Activando modo co-transmisor...");
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const bodyPayload: Record<string, unknown> = {
        roomName: roomLivekitName,
        participantName: guestName.trim(),
        role: "host",
      };

      if (isPortalUser) {
        bodyPayload.isPortalUser = true;
        bodyPayload.guestUpgrade = true;
      } else if (isPublicStream) {
        bodyPayload.isPublicStream = true;
      } else {
        bodyPayload.inviteCode = code.trim();
        bodyPayload.guestUpgrade = true;
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/livekit-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify(bodyPayload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al obtener token");
      setToken(json.token);
      setLivekitUrl(json.url);
      setIsCoHost(true);
      toast.success("¡Modo co-transmisor activado!");
    } catch (err: any) {
      toast.error("Error al activar co-transmisión: " + err.message);
    }
  }, [roomLivekitName, guestName, code, isPublicStream, isPortalUser]);

  // Public stream: connect directly without OTP, no lead registration
  const handlePublicJoin = useCallback(async () => {
    if (!guestName.trim()) {
      toast.error("Ingresa tu nombre para continuar");
      return;
    }
    if (!roomFromUrl) {
      setError("Enlace de stream público inválido");
      return;
    }
    setConnecting(true);
    setError("");

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Fetch room data
      const roomRes = await fetch(`${supabaseUrl}/rest/v1/live_rooms?id=eq.${encodeURIComponent(roomFromUrl)}&select=id,title,livekit_room_name,status,is_public_stream`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });
      const roomData = await roomRes.json();

      if (!roomData || roomData.length === 0 || (!roomData[0].is_public_stream && !isPortalUser)) {
        setError("Este stream no está disponible");
        setConnecting(false);
        return;
      }

      const room = roomData[0];
      setRoomId(room.id);
      setRoomTitle(room.title);
      setRoomLivekitName(room.livekit_room_name);
      setRoomStatus(room.status);
      setGuestVerified(true);

      // If room is still in waiting status, don't connect to LiveKit yet —
      // show the waiting room and connect when status changes to 'live'
      if (room.status === "waiting") {
        setConnecting(false);
        return;
      }

      // Room is live — get LiveKit token
      await connectPublicStream(room.livekit_room_name);
    } catch (err: any) {
      setError(err.message || "Error al conectar");
      toast.error("Error: " + err.message);
    }
    setConnecting(false);
  }, [guestName, roomFromUrl]);

  // Helper to connect to a public stream (get LiveKit token)
  const connectPublicStream = useCallback(async (livekitRoomName?: string) => {
    const roomNameToUse = livekitRoomName || roomLivekitName;
    if (!roomNameToUse) return;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const tokenBody: Record<string, unknown> = {
      roomName: roomNameToUse,
      participantName: guestName.trim(),
      role: "viewer",
      isPublicStream: !isPortalUser,
      isPortalUser: isPortalUser || undefined,
    };

    const res = await fetch(`${supabaseUrl}/functions/v1/livekit-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}`, apikey: anonKey },
      body: JSON.stringify(tokenBody),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener token");

    setToken(json.token);
    setLivekitUrl(json.url);
    autoConnectStartedRef.current = false;
  }, [guestName, roomLivekitName, isPortalUser]);

  // ── KNOCK-TO-ENTER FLOW ──
  // Step 1: Submit name → fetch room → check allow_anyone_with_link → either knock or auto-enter
  const handleKnockSubmit = useCallback(async () => {
    if (!guestName.trim()) {
      toast.error("Ingresa tu nombre");
      return;
    }
    if (!roomFromUrl) {
      setError("Link inválido");
      return;
    }
    setConnecting(true);
    setError("");
    try {
      const { data: room, error: roomErr } = await supabase
        .from("live_rooms")
        .select("id, title, livekit_room_name, status, room_type, allow_anyone_with_link")
        .eq("id", roomFromUrl)
        .maybeSingle();
      if (roomErr || !room) {
        setError("Sala no encontrada");
        setConnecting(false);
        return;
      }
      setRoomId(room.id);
      setRoomTitle(room.title);
      setRoomLivekitName(room.livekit_room_name);
      setRoomStatus(room.status);
      setRoomType((room as any).room_type || "broadcast");
      setGuestVerified(true);

      // Path A: anyone with link allowed → connect directly
      if ((room as any).allow_anyone_with_link === true) {
        if (room.status === "waiting") {
          setConnecting(false);
          return;
        }
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(`${supabaseUrl}/functions/v1/livekit-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}`, apikey: anonKey },
          body: JSON.stringify({
            roomName: room.livekit_room_name,
            participantName: guestName.trim(),
            role: "viewer",
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Error al obtener token");
        setToken(json.token);
        setLivekitUrl(json.url);
        setConnecting(false);
        return;
      }

      // Path B: knock — create join request
      const { data: jr, error: jrErr } = await supabase
        .from("live_room_join_requests" as any)
        .insert({
          room_id: room.id,
          requester_name: guestName.trim(),
          requester_session_id: requesterSessionId,
        } as any)
        .select("id")
        .single();
      if (jrErr || !jr) throw new Error(jrErr?.message || "No se pudo enviar la solicitud");
      setJoinRequestId((jr as any).id);
      setGuestStep("knock_waiting");
    } catch (err: any) {
      setError(err.message || "Error");
      toast.error(err.message);
    }
    setConnecting(false);
  }, [guestName, roomFromUrl, requesterSessionId]);

  // Step 2: Approved → fetch LiveKit token using joinRequestId
  const handleKnockApproved = useCallback(async () => {
    if (knockConnectStartedRef.current || token) return;
    knockConnectStartedRef.current = true;
    setConnecting(true);
    setGuestStep("knock_connecting");
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/livekit-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}`, apikey: anonKey },
        body: JSON.stringify({
          roomName: roomLivekitName,
          participantName: guestName.trim(),
          role: "viewer",
          joinRequestId,
          requesterSessionId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al obtener token");
      setToken(json.token);
      setLivekitUrl(json.url);
      toast.success("¡Aprobado! Entrando a la sala…");
    } catch (err: any) {
      knockConnectStartedRef.current = false;
      setGuestStep("knock_waiting");
      setError(err.message || "Error");
      toast.error(err.message);
    } finally {
      setConnecting(false);
    }
  }, [roomLivekitName, guestName, joinRequestId, requesterSessionId, token]);

  const handleKnockRejected = useCallback(() => {
    // WaitingForApproval shows its own rejected state with exit button
  }, []);

  // Auto-connect public stream viewers when room transitions from waiting to live
  useEffect(() => {
    if ((isPublicStream || isPortalUser) && roomStatus === "live" && !token && roomLivekitName && guestName.trim()) {
      connectPublicStream().catch((err) => {
        setError(err.message || "Error al conectar");
        toast.error("Error: " + err.message);
      });
    }
  }, [isPublicStream, isPortalUser, roomStatus, token, roomLivekitName, guestName, connectPublicStream]);

  // Co-host revocation: when host removes our publish permission, re-fetch a viewer-role token.
  // This forces a clean reconnect as a normal viewer (no camera/mic).
  useEffect(() => {
    const handler = async () => {
      if (!roomLivekitName || !guestName.trim()) return;
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const tokenBody: Record<string, unknown> = {
          roomName: roomLivekitName,
          participantName: guestName.trim(),
          role: "viewer",
        };
        if (isPublicStream) tokenBody.isPublicStream = true;
        else if (isPortalUser) tokenBody.isPortalUser = true;
        else if (code.trim()) tokenBody.inviteCode = code.trim();

        const res = await fetch(`${supabaseUrl}/functions/v1/livekit-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}`, apikey: anonKey },
          body: JSON.stringify(tokenBody),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Error al obtener token");
        setIsCoHost(false);
        setToken(json.token);
        setLivekitUrl(json.url);
      } catch (err: any) {
        toast.error("No se pudo volver a modo espectador: " + (err?.message || ""));
      }
    };
    window.addEventListener("bullfy-guest-costream-revoke", handler);
    return () => window.removeEventListener("bullfy-guest-costream-revoke", handler);
  }, [roomLivekitName, guestName, isPublicStream, isPortalUser, code]);

  // Auto-join for portal users on mount
  useEffect(() => {
    if (isPortalUser && nameFromUrl && roomFromUrl && !token) {
      handlePublicJoin();
    }
  }, []);

  // Auto-connect invite code viewers when room transitions from waiting to live
  useEffect(() => {
    if (!isPublicStream && roomStatus === "live" && !token && roomLivekitName && guestName.trim() && code.trim() && guestVerified && !autoConnectStartedRef.current) {
      autoConnectStartedRef.current = true;
      setGuestStep("reconnect");
      const connect = async () => {
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          const res = await fetch(`${supabaseUrl}/functions/v1/livekit-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}`, apikey: anonKey },
            body: JSON.stringify({
              roomName: roomLivekitName,
              participantName: guestName.trim(),
              role: "viewer",
              inviteCode: code.trim(),
            }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Error al obtener token");
          setToken(json.token);
          setLivekitUrl(json.url);
        } catch (err: any) {
          autoConnectStartedRef.current = false;
          setError(err.message || "Error al conectar");
          toast.error("Error: " + err.message);
        }
      };
      connect();
    }
  }, [isPublicStream, roomStatus, token, roomLivekitName, guestName, code, guestVerified]);

  useEffect(() => {
    if (!joinRequestId || !guestVerified || token) return;
    if (roomStatus === "live" && (guestStep === "public_name" || guestStep === "knock_connecting")) {
      setGuestStep("knock_connecting");
    }
  }, [joinRequestId, guestVerified, token, roomStatus, guestStep]);

  useEffect(() => {
    if (guestStep !== "knock_connecting" || token || roomStatus === "waiting") return;
    handleKnockApproved();
  }, [guestStep, token, roomStatus, handleKnockApproved]);

  // Knock-to-enter: render waiting-for-approval screen
  if (guestStep === "knock_waiting" && joinRequestId && !token) {
    return (
      <WaitingForApproval
        requestId={joinRequestId}
        guestName={guestName}
        roomTitle={roomTitle || "la sala"}
        onApproved={async () => {
          setGuestVerified(true);
          setGuestStep(roomStatus === "waiting" ? "public_name" : "knock_connecting");
        }}
        onRejected={() => {}}
        onExit={handleExitStream}
      />
    );
  }

  // Show waiting room if room is in "waiting" status (before host goes live)
  if (roomId && roomStatus === "waiting" && guestVerified) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            {whiteLabel ? (
              roomBranding.logo_url
                ? <img src={roomBranding.logo_url} alt={roomPortalName || ""} className="h-7 w-auto object-contain" />
                : <h1 className="text-lg font-bold text-foreground">{roomPortalName || roomTitle}</h1>
            ) : (
              <h1 className="text-lg font-bold text-foreground">Bullfy Live</h1>
            )}
            <Badge className="animate-pulse text-xs bg-amber-600">SALA DE ESPERA</Badge>
            <span className="text-sm text-muted-foreground">{roomTitle}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Invitado: {guestName}</span>
            <Button variant="ghost" size="sm" onClick={handleExitStream} className="gap-1 text-destructive hover:text-destructive">
              <LogOut className="w-3 h-3" /> Salir
            </Button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <WaitingRoomViewer roomId={roomId} />
        </div>
      </div>
    );
  }

  if (token && livekitUrl) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="flex-1 min-h-0">
          <LiveKitRoom
            key={isCoHost ? "cohost" : "viewer"}
            serverUrl={livekitUrl}
            token={token}
            connect
          >
            <SafeLiveKitGate>
              <GuestContent
                roomId={roomId}
                roomTitle={roomTitle}
                isCoHost={isCoHost}
                onAcceptCoStream={handleAcceptCoStream}
                onLeave={handleExitStream}
                roomType={roomType}
                portalId={isPortalUser ? portalIdFromUrl : null}
                partnerUserId={isPortalUser ? partnerUserIdFromUrl : null}
              />
            </SafeLiveKitGate>
          </LiveKitRoom>
        </div>
      </div>
    );
  }


  // Usuarios de portal auto-ingresan (el nombre viene en la URL): no mostramos
  // la tarjeta "Bullfy Live" de ingreso de nombre —que además parpadea con marca
  // Bullfy en portales white-label—. Solo un loader neutro mientras se resuelve
  // el estado de la sala (→ sala de espera o stream).
  if (isPortalUser && !token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {whiteLabel ? (
              // Fondo claro para que el logo (incluso si es del mismo color del
              // tema) se vea. Mientras carga, spinner neutro (no el ícono Bullfy).
              <div className="rounded-2xl bg-white/95 p-3 flex items-center justify-center min-h-[64px] min-w-[64px]">
                {roomBranding.logo_url
                  ? <img src={roomBranding.logo_url} alt={roomPortalName || ""} className="h-12 object-contain" />
                  : <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />}
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Radio className="w-8 h-8 text-primary" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl font-bold">
            {whiteLabel ? (roomPortalName || roomTitle || "Transmisión en vivo") : "Bullfy Live"}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {guestStep === "reconnect"
              ? "¿Listo para volver al stream?"
              : guestStep === "knock_connecting"
              ? "Tu acceso fue aprobado"
              : guestStep === "public_name"
              ? "Ingresa tu nombre para unirte al stream"
              : guestStep === "form"
              ? "Completa tus datos para unirte al stream en vivo"
              : "Verificación de identidad"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {guestStep === "reconnect" && savedSession && (
            <>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">Bienvenido de vuelta, {savedSession.guestName}</p>
                <p className="text-xs text-muted-foreground">{savedSession.guestEmail}</p>
                <p className="text-xs text-muted-foreground">Stream: {savedSession.roomTitle}</p>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
              <Button
                onClick={handleReconnect}
                disabled={connecting}
                className="w-full"
                size="lg"
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Reconectando...
                  </>
                ) : (
                  "📺 Volver al Stream"
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  sessionStorage.removeItem(GUEST_SESSION_KEY);
                  clearGuestDraft();
                  setGuestStep("form");
                  setGuestName("");
                  setGuestEmail("");
                  setGuestPhone("");
                }}
                className="w-full text-xs"
                size="sm"
              >
                Ingresar con otros datos
              </Button>
            </>
          )}

          {guestStep === "verify_email" && (
            <OTPVerificationStep
              type="email"
              destination={guestEmail.trim()}
              currentStep={1}
              totalSteps={2}
              loading={verifyLoading}
              onVerify={handleVerifyGuestEmail}
              onResend={handleResendGuestEmail}
              onBack={() => setGuestStep("form")}
              resendLoading={resendLoading}
              primaryColor="hsl(var(--primary))"
            />
          )}

          {guestStep === "verify_sms" && (
            <OTPVerificationStep
              type="sms"
              destination={fullPhone}
              currentStep={2}
              totalSteps={2}
              loading={verifyLoading}
              onVerify={handleVerifyGuestSms}
              onResend={handleResendGuestSms}
              onBack={() => setGuestStep("verify_email")}
              resendLoading={resendLoading}
              primaryColor="hsl(var(--primary))"
              onForceEmailFallback={handleForceEmailFallbackGuest}
            />
          )}

          {guestStep === "knock_connecting" && (
            <div className="rounded-lg border border-border bg-muted/40 p-6 text-center space-y-3">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">Aprobado. Entrando a la sala...</p>
              <p className="text-xs text-muted-foreground">Estamos conectándote, esto tarda solo unos segundos.</p>
            </div>
          )}

          {guestStep === "create_password" && (
            <>
              <div className="bg-green-500/10 rounded-lg p-4 text-center space-y-2">
                <Lock className="w-8 h-8 mx-auto text-green-500" />
                <p className="text-sm font-medium text-foreground">¡Verificación exitosa!</p>
                <p className="text-xs text-muted-foreground">
                  Crea una contraseña para acceder al portal en el futuro
                </p>
              </div>
              <div>
                <Label>Contraseña *</Label>
                <PasswordInput
                  value={guestPassword}
                  onChange={(e) => setGuestPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  minLength={8}
                />
              </div>
              <div>
                <Label>Confirmar contraseña *</Label>
                <PasswordInput
                  value={guestPasswordConfirm}
                  onChange={(e) => setGuestPasswordConfirm(e.target.value)}
                  placeholder="Repite tu contraseña"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
              <Button
                onClick={handlePasswordSubmit}
                disabled={verifyLoading || guestPassword.length < 8 || guestPassword !== guestPasswordConfirm}
                className="w-full"
                size="lg"
              >
                {verifyLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Conectando...
                  </>
                ) : (
                  "🔐 Crear contraseña y ver stream"
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={handleSkipPassword}
                disabled={verifyLoading}
                className="w-full text-xs"
                size="sm"
              >
                Omitir por ahora
              </Button>
            </>
          )}

          {guestStep === "telegram_link" && telegramLink && (
            <>
              <div className="bg-[#229ED9]/10 rounded-lg p-4 text-center space-y-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-[#229ED9] flex items-center justify-center text-white text-2xl">
                  ✈
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {telegramLink.required ? "Vincula tu Telegram para continuar" : "Vincula tu Telegram (opcional)"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Escanea el QR o pulsa el botón. Te abriremos Telegram para confirmar.
                </p>
              </div>

              <div className="flex flex-col items-center gap-3 p-4 bg-card rounded-lg border border-border">
                <div className="p-3 bg-white rounded-md">
                  <QRCodeSVG value={telegramLink.link} size={180} level="M" includeMargin={false} />
                </div>
                <a
                  href={telegramLink.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full h-10 rounded-md bg-[#229ED9] text-white font-medium hover:bg-[#1b89bb] transition-colors"
                >
                  Abrir Telegram @{telegramLink.botUsername}
                </a>
                <p className="text-[10px] text-muted-foreground text-center">
                  Una vez vinculado, te llevaremos al stream automáticamente.
                </p>
              </div>

              {telegramLinked ? (
                <div className="flex items-center justify-center gap-2 text-emerald-500 text-sm font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Telegram vinculado · conectando...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Esperando vinculación...
                </div>
              )}

              {!telegramLink.required && !telegramLinked && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleTelegramContinue}
                  disabled={verifyLoading}
                  className="w-full text-xs"
                >
                  Continuar sin Telegram
                </Button>
              )}
            </>
          )}



          {guestStep === "knock_name" && (
            <>
              <div className="bg-primary/5 rounded-lg p-4 text-center space-y-1">
                <Badge className="bg-primary/20 text-primary border-primary/30 gap-1">
                  <DoorOpen className="w-3 h-3" /> Sala Privada
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  Ingresa tu nombre. Si la sala lo requiere, el host deberá aprobar tu entrada.
                </p>
              </div>
              <div>
                <Label>Tu nombre</Label>
                <Input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  disabled={connecting}
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
              <Button onClick={handleKnockSubmit} disabled={connecting || !guestName.trim()} className="w-full" size="lg">
                {connecting ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Solicitando acceso...</>
                ) : (
                  <><DoorOpen className="w-4 h-4 mr-2" />Solicitar entrada</>
                )}
              </Button>
            </>
          )}

          {guestStep === "public_name" && (
            <>
              <div className="bg-primary/5 rounded-lg p-4 text-center space-y-1">
                <Badge className="bg-primary/20 text-primary border-primary/30">Stream Público</Badge>
                <p className="text-xs text-muted-foreground mt-2">No requiere registro ni verificación</p>
              </div>
              <div>
                <Label>Tu nombre (opcional)</Label>
                <Input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Ej: Invitado"
                  disabled={connecting}
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
              <Button
                onClick={() => {
                  if (!guestName.trim()) setGuestName("Invitado-" + Math.random().toString(36).slice(2, 6));
                  handlePublicJoin();
                }}
                disabled={connecting}
                className="w-full"
                size="lg"
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Conectando...
                  </>
                ) : (
                  "📺 Ver Stream"
                )}
              </Button>
            </>
          )}

          {guestStep === "form" && (
            <>
              <div>
                <Label>Nombre completo *</Label>
                <Input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  disabled={connecting}
                />
              </div>
              <div>
                <Label>Correo electrónico *</Label>
                <Input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="Ej: juan@correo.com"
                  disabled={connecting}
                />
              </div>

              <PhoneInput
                value={guestPhone}
                countryCode={guestCountryCode}
                onPhoneChange={setGuestPhone}
                onCountryChange={setGuestCountryCode}
                disabled={connecting}
              />

              <div>
                <Label>Código de Invitación *</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Ej: A1B2C3D4"
                  className="font-mono tracking-widest text-center text-lg"
                  disabled={connecting}
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
              <Button
                onClick={handleStartVerification}
                disabled={connecting || !isFormValid}
                className="w-full"
                size="lg"
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Validando...
                  </>
                ) : (
                  "📺 Unirme al Stream"
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Verificaremos tu email y teléfono antes de conectarte
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveGuest;
