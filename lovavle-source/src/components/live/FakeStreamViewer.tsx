import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Heart, ExternalLink, MessageSquare } from "lucide-react";
import { toast } from "@/lib/toastUtils";
import PhoneInput, { validatePhone, getFullPhone } from "@/components/shared/PhoneInput";
import OTPVerificationStep from "@/components/shared/OTPVerificationStep";

interface ChatMsg {
  time: number;
  name: string;
  text: string;
}

const FakeStreamViewer = () => {
  const { slug } = useParams<{ slug: string }>();
  const [stream, setStream] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewerCount, setViewerCount] = useState(0);
  const [likes, setLikes] = useState(0);
  const [visibleMessages, setVisibleMessages] = useState<ChatMsg[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const viewerTimerRef = useRef<ReturnType<typeof setInterval>>();

  // Lead capture + verification state
  const [gateStep, setGateStep] = useState<"form" | "verify_email" | "verify_sms" | "done">("form");
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadCountryCode, setLeadCountryCode] = useState("CO");
  const [submitting, setSubmitting] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const fullPhone = getFullPhone(leadPhone, leadCountryCode);
  const phoneValidation = validatePhone(leadPhone, leadCountryCode);
  const isFormValid = leadName.trim() && leadEmail.trim() && phoneValidation.valid;

  useEffect(() => {
    loadStream();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (viewerTimerRef.current) clearInterval(viewerTimerRef.current);
    };
  }, [slug]);

  const loadStream = async () => {
    if (!slug) { setError("Link inválido"); setLoading(false); return; }
    const { data, error: err } = await supabase
      .from("live_fake_streams")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (err || !data) { setError("Este stream no está disponible"); setLoading(false); return; }
    setStream(data);

    const bucket = data.video_source === "upload" ? "fake-stream-videos" : "live-recordings";
    const { data: urlData } = await supabase.storage.from(bucket).createSignedUrl(data.video_path, 7200);
    if (urlData?.signedUrl) setVideoUrl(urlData.signedUrl);

    const min = data.fake_viewer_min || 80;
    const max = data.fake_viewer_max || 105;
    setViewerCount(Math.floor(Math.random() * (max - min + 1)) + min);
    setLoading(false);
  };

  // Step 1: Submit form → send email OTP
  const handleFormSubmit = useCallback(async () => {
    if (!isFormValid) {
      toast.error("Completa todos los campos correctamente");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: otpErr } = await supabase.functions.invoke("send-email-otp", {
        body: { email: leadEmail.trim(), purpose: "fake_live_email" },
      });
      if (otpErr || !data?.success) {
        toast.error(data?.error || "Error al enviar código por email");
      } else {
        toast.success("Código enviado a tu correo electrónico");
        setGateStep("verify_email");
      }
    } catch (e: any) {
      toast.error(e.message || "Error al enviar código");
    }
    setSubmitting(false);
  }, [isFormValid, leadEmail]);

  // Step 2: Verify email OTP → auto send SMS OTP
  const handleVerifyEmail = useCallback(async (otpCode: string) => {
    setVerifyLoading(true);
    const { data, error: err } = await supabase.functions.invoke("verify-otp", {
      body: { email: leadEmail.trim(), code: otpCode, purpose: "fake_live_email" },
    });
    if (err || !data?.ok) {
      const errMsg = data?.error || (err instanceof Error ? err.message : null) || "Código inválido";
      toast.error(errMsg);
    } else {
      toast.success("Email verificado ✓ Enviando código a tu teléfono...");
      const { data: smsData } = await supabase.functions.invoke("send-sms-otp", {
        body: { email: leadEmail.trim(), phone: fullPhone, purpose: "fake_live_sms" },
      });
      if (smsData?.success) {
        setGateStep("verify_sms");
        toast.success("Código enviado a tu teléfono");
      } else {
        toast.error(smsData?.error || "Error al enviar SMS");
      }
    }
    setVerifyLoading(false);
  }, [leadEmail, fullPhone]);

  // Step 3: Verify SMS OTP → save lead → show stream
  const handleVerifySms = useCallback(async (otpCode: string) => {
    setVerifyLoading(true);
    const { data, error: err } = await supabase.functions.invoke("verify-otp", {
      body: { email: leadEmail.trim(), code: otpCode, purpose: "fake_live_sms" },
    });
    if (err || !data?.ok) {
      const errMsg = data?.error || (err instanceof Error ? err.message : null) || "Código inválido";
      toast.error(errMsg);
      setVerifyLoading(false);
      return;
    }

    // Both verified — save lead
    try {
      const { data: defaultStage } = await supabase
        .from("lead_pipeline_stages")
        .select("id")
        .eq("is_default", true)
        .single();

      const { error: insertErr } = await supabase.from("stream_leads").insert({
        nombre: leadName.trim(),
        correo: leadEmail.trim(),
        telefono: fullPhone,
        source: "fake_live",
        partner_portal_id: stream?.portal_id || null,
        pipeline_stage_id: defaultStage?.id || null,
        notes: `Falso en vivo: "${stream?.title}" (slug: ${slug}) | Creado por: ${stream?.created_by || "N/A"}`,
      });
      if (insertErr) throw insertErr;
      toast.success("¡Verificación completa! Entrando al stream...");
      setGateStep("done");
    } catch (e: any) {
      toast.error("Error al registrarte: " + (e.message || "Intenta de nuevo"));
    }
    setVerifyLoading(false);
  }, [leadEmail, fullPhone, leadName, stream, slug]);

  // Resend handlers
  const handleResendEmail = useCallback(async () => {
    setResendLoading(true);
    const { data } = await supabase.functions.invoke("send-email-otp", {
      body: { email: leadEmail.trim(), purpose: "fake_live_email" },
    });
    if (data?.success) toast.success("Nuevo código enviado a tu correo");
    else toast.error(data?.error || "Error al reenviar");
    setResendLoading(false);
  }, [leadEmail]);

  const handleResendSms = useCallback(async () => {
    setResendLoading(true);
    const { data } = await supabase.functions.invoke("send-sms-otp", {
      body: { email: leadEmail.trim(), phone: fullPhone, purpose: "fake_live_sms" },
    });
    if (data?.success) {
      if (data.fallback === "email") toast.success("Código enviado a tu email (SMS no disponible)");
      else toast.success("Nuevo código enviado a tu teléfono");
    } else toast.error(data?.error || "Error al reenviar");
    setResendLoading(false);
  }, [leadEmail, fullPhone]);

  const handleForceEmailFallback = useCallback(async () => {
    setResendLoading(true);
    const { data } = await supabase.functions.invoke("send-sms-otp", {
      body: { email: leadEmail.trim(), phone: fullPhone, purpose: "fake_live_sms", force_email_fallback: true },
    });
    if (data?.success) toast.success("Código enviado a tu correo electrónico");
    else toast.error(data?.error || "Error al enviar por email");
    setResendLoading(false);
  }, [leadEmail, fullPhone]);

  // Fluctuate viewer count
  useEffect(() => {
    if (!stream || gateStep !== "done") return;
    const min = stream.fake_viewer_min || 80;
    const max = stream.fake_viewer_max || 105;
    viewerTimerRef.current = setInterval(() => {
      setViewerCount(prev => {
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.min(max, Math.max(min, prev + delta));
      });
    }, 3000);
    return () => { if (viewerTimerRef.current) clearInterval(viewerTimerRef.current); };
  }, [stream, gateStep]);

  // Progressive chat messages
  useEffect(() => {
    if (!stream || !videoRef.current || gateStep !== "done") return;
    const messages: ChatMsg[] = Array.isArray(stream.chat_messages) ? stream.chat_messages : [];
    if (messages.length === 0) return;

    timerRef.current = setInterval(() => {
      const currentTime = videoRef.current?.currentTime || 0;
      const toShow = messages.filter(m => m.time <= currentTime);
      setVisibleMessages(toShow);
    }, 500);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stream, videoUrl, gateStep]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [visibleMessages]);

  const handleLike = () => setLikes(prev => prev + 1);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !stream) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <p className="text-xl font-bold">{error || "Stream no disponible"}</p>
          <p className="text-sm text-gray-400">Este enlace ya no está activo</p>
        </div>
      </div>
    );
  }

  // Lead capture gate with OTP verification
  if (gateStep !== "done") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-md w-full space-y-6">
          <div className="text-center space-y-2">
            <Badge className="bg-red-600 text-white border-0 animate-pulse gap-1 mb-2">
              <span className="w-2 h-2 bg-white rounded-full" /> EN VIVO
            </Badge>
            <h1 className="text-white text-2xl font-bold">{stream.title}</h1>
            <p className="text-gray-400 text-sm">
              {gateStep === "form"
                ? "Regístrate para ver el stream en vivo"
                : "Verificación de identidad"}
            </p>
          </div>

          {gateStep === "verify_email" && (
            <OTPVerificationStep
              type="email"
              destination={leadEmail.trim()}
              currentStep={1}
              totalSteps={2}
              loading={verifyLoading}
              onVerify={handleVerifyEmail}
              onResend={handleResendEmail}
              onBack={() => setGateStep("form")}
              resendLoading={resendLoading}
              primaryColor="#dc2626"
            />
          )}

          {gateStep === "verify_sms" && (
            <OTPVerificationStep
              type="sms"
              destination={fullPhone}
              currentStep={2}
              totalSteps={2}
              loading={verifyLoading}
              onVerify={handleVerifySms}
              onResend={handleResendSms}
              onBack={() => setGateStep("verify_email")}
              resendLoading={resendLoading}
              primaryColor="#dc2626"
              onForceEmailFallback={handleForceEmailFallback}
            />
          )}

          {gateStep === "form" && (
            <>
              <div className="space-y-3">
                <Input
                  placeholder="Tu nombre *"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white"
                  disabled={submitting}
                />
                <Input
                  placeholder="Tu correo *"
                  type="email"
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white"
                  disabled={submitting}
                />
                <div className="[&_label]:text-gray-300 [&_input]:bg-gray-800 [&_input]:border-gray-600 [&_input]:text-white [&_button]:bg-gray-800 [&_button]:border-gray-600 [&_button]:text-white">
                  <PhoneInput
                    value={leadPhone}
                    countryCode={leadCountryCode}
                    onPhoneChange={setLeadPhone}
                    onCountryChange={setLeadCountryCode}
                    disabled={submitting}
                  />
                </div>
              </div>
              <Button
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3"
                onClick={handleFormSubmit}
                disabled={submitting || !isFormValid}
              >
                {submitting ? "Enviando código..." : "Entrar al Stream"}
              </Button>
            </>
          )}

          <p className="text-gray-600 text-[10px] text-center">
            {viewerCount} personas viendo ahora
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col lg:flex-row">
      <div className="flex-1 relative flex flex-col">
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge className="bg-red-600 text-white border-0 animate-pulse gap-1">
                <span className="w-2 h-2 bg-white rounded-full" /> EN VIVO
              </Badge>
              <h1 className="text-white font-bold text-lg">{stream.title}</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white text-sm flex items-center gap-1">
                <Users className="w-4 h-4" /> {viewerCount}
              </span>
              <button onClick={handleLike} className="text-white hover:text-red-400 transition-colors flex items-center gap-1">
                <Heart className={`w-5 h-5 ${likes > 0 ? "fill-red-500 text-red-500" : ""}`} />
                {likes > 0 && <span className="text-sm">{likes}</span>}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
              style={{ pointerEvents: "none" }}
              loop
            />
          ) : (
            <p className="text-gray-500">Cargando video...</p>
          )}
        </div>

        {stream.cta_url && (
          <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 to-transparent p-6">
            <div className="flex items-center justify-center">
              <Button
                size="lg"
                className="gap-2 bg-green-600 hover:bg-green-700 text-white font-bold text-lg px-8 py-6 rounded-full shadow-lg shadow-green-600/30 animate-pulse"
                onClick={() => window.open(stream.cta_url, "_blank")}
              >
                <ExternalLink className="w-5 h-5" />
                {stream.cta_text || "Únete ahora"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="w-full lg:w-80 bg-gray-950 border-l border-gray-800 flex flex-col h-64 lg:h-screen">
        <div className="p-3 border-b border-gray-800 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-400" />
          <span className="text-white text-sm font-semibold">Chat en Vivo</span>
          <Badge variant="secondary" className="text-[10px]">{visibleMessages.length}</Badge>
        </div>
        <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-2">
          {visibleMessages.map((msg, idx) => (
            <div key={idx} className="text-sm">
              <span className="font-semibold text-blue-400">{msg.name}: </span>
              <span className="text-gray-300">{msg.text}</span>
            </div>
          ))}
          {visibleMessages.length === 0 && (
            <p className="text-gray-600 text-xs text-center mt-4">El chat comenzará pronto...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FakeStreamViewer;
