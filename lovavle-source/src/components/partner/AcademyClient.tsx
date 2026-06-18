import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/lib/toastUtils";
import { usePortalBranding } from "@/hooks/usePortalBranding";
import { usePortalTiers } from "@/hooks/usePortalTiers";
import { generateCertificatePDF } from "@/services/generateCertificate";
import {
  BookOpen, Video, Lock, CheckCircle, PlayCircle, ArrowLeft, Award, Download, ChevronRight,
  Loader2, AlertCircle, Crown, Package, CreditCard, Coins
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MuxPlayer from "@mux/mux-player-react";
import { CARD_PAYMENT_ENABLED } from "@/lib/paymentConfig";

interface AcademyClientProps {
  portalId: string;
  userId: string;
  userName: string;
  // Bullfy eCommerce del portal. Si OFF, todo el contenido es gratis: no se muestran
  // precios ni interfaz de pago, y no se ofrecen membresías/paquetes.
  commerceEnabled?: boolean;
}

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail_path: string | null;
  price_usd: number;
  is_free: boolean;
  category_id: string | null;
  required_tiers: string[] | null;
}

interface Membership {
  id: string;
  title: string;
  description: string | null;
  price_usd: number;
  membership_tier: string | null;
  image_url: string | null;
}

interface Bundle {
  id: string;
  title: string;
  description: string | null;
  price_usd: number;
  product_id: string | null;
  course_ids: string[];
}


interface Category {
  id: string;
  name: string;
  display_order: number;
}

interface Module {
  id: string;
  course_id: string;
  title: string;
  display_order: number;
}

type MuxStatus = "preparing" | "ready" | "errored";

interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string;
  lesson_type: string;                   // 'video' | 'document'
  video_path: string | null;            // legacy: videos previos a Mux
  thumbnail_path: string | null;         // miniatura propia de la lección
  mux_status: MuxStatus | null;
  mux_playback_id: string | null;
  duration_seconds: number;
  display_order: number;
}

interface Attachment {
  id: string;
  lesson_id: string;
  file_name: string;
  file_type: string | null;
  size_bytes: number | null;
  is_primary: boolean;
  display_order: number;
}

interface Enrollment {
  course_id: string;
}

interface ProgressRecord {
  id?: string;
  lesson_id: string;
  completed: boolean;
  watch_time_seconds: number;
}

interface Certificate {
  id: string;
  course_id: string;
  certificate_code: string;
  issued_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const AcademyClient = ({ portalId, userId, userName, commerceEnabled = false }: AcademyClientProps) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const { branding } = usePortalBranding(portalId);
  const { labelFor } = usePortalTiers(portalId);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);

  // Estado del JWT de Mux para playback signed. Se pide al EF
  // academy-mux-signed-token cada vez que el usuario abre una lección
  // que tiene mux_playback_id. Para lecciones legacy (solo video_path),
  // no se pide token y se renderiza el <video> nativo como fallback.
  const [playbackToken, setPlaybackToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Adjuntos de la lección activa (documentos / recursos descargables).
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(null);

  // Tier del usuario + membresías/paquetes a la venta.
  const [userTier, setUserTier] = useState<string>("general");
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  // Compra: producto seleccionado + estado de checkout.
  const [purchaseTarget, setPurchaseTarget] = useState<{ productId: string; title: string; price: number } | null>(null);
  // Producto vendible sincronizado de cada curso de pago (course_id → product_id/precio).
  const [courseProducts, setCourseProducts] = useState<Record<string, { productId: string; price: number }>>({});
  const [purchasing, setPurchasing] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [portalId, userId]);

  // Cargar adjuntos cuando se abre una lección.
  useEffect(() => {
    if (!activeLesson?.id) { setAttachments([]); return; }
    let cancelled = false;
    supabase
      .from("academy_lesson_attachments")
      .select("*")
      .eq("lesson_id", activeLesson.id)
      .order("display_order", { ascending: true })
      .then(({ data }) => { if (!cancelled) setAttachments((data as Attachment[]) || []); });
    return () => { cancelled = true; };
  }, [activeLesson?.id]);

  // Pide un signed URL a la EF (valida inscripción/tier) y abre el archivo.
  const openAttachment = async (att: Attachment) => {
    setOpeningAttachmentId(att.id);
    try {
      const { data, error } = await supabase.functions.invoke("academy-file-url", {
        body: { attachment_id: att.id, partner_user_id: userId },
      });
      if (error || !data?.ok || !data?.url) {
        toast.error(data?.error || "No se pudo abrir el archivo");
        return;
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningAttachmentId(null);
    }
  };

  const primaryDoc = attachments.find(a => a.is_primary) || null;
  const extraAttachments = attachments.filter(a => !a.is_primary);

  // Fetch del signed JWT cuando se abre una lección con video de Mux.
  // IMPORTANTE: este useEffect debe estar antes de cualquier early-return
  // para no violar las rules of hooks de React.
  useEffect(() => {
    if (!activeLesson?.mux_playback_id) {
      setPlaybackToken(null);
      setTokenError(null);
      setTokenLoading(false);
      return;
    }
    let cancelled = false;
    setTokenLoading(true);
    setTokenError(null);
    (async () => {
      const { data, error } = await supabase.functions.invoke(
        "academy-mux-signed-token",
        { body: { lesson_id: activeLesson.id, partner_user_id: userId } },
      );
      if (cancelled) return;
      if (error || !data?.ok || !data?.token) {
        setTokenError(data?.error || error?.message || "No se pudo cargar el video");
        setTokenLoading(false);
        return;
      }
      setPlaybackToken(data.token);
      setTokenLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeLesson?.id, activeLesson?.mux_playback_id, userId]);

  const fetchAll = async () => {
    const [coursesRes, enrollRes, progressRes, certsRes, catsRes, userRes, memRes, bundleRes, bcRes, courseProdRes] = await Promise.all([
      supabase.from("academy_courses").select("*").eq("portal_id", portalId).eq("status", "published").order("display_order"),
      supabase.from("academy_enrollments").select("course_id").eq("partner_user_id", userId),
      supabase.from("academy_progress").select("id, lesson_id, completed, watch_time_seconds").eq("partner_user_id", userId),
      supabase.from("academy_certificates").select("*").eq("partner_user_id", userId),
      supabase.from("academy_categories").select("id, name, display_order").eq("portal_id", portalId).order("display_order"),
      supabase.from("partner_users").select("tier").eq("id", userId).maybeSingle(),
      supabase.from("portal_products").select("id, title, description, price_usd, membership_tier, image_url")
        .eq("portal_id", portalId).eq("product_type", "membership").eq("status", "active"),
      supabase.from("academy_bundles").select("id, title, description, price_usd, product_id")
        .eq("portal_id", portalId).eq("status", "published"),
      supabase.from("academy_bundle_courses").select("bundle_id, course_id"),
      supabase.from("portal_products").select("id, reference_id, price_usd")
        .eq("portal_id", portalId).eq("product_type", "course").eq("status", "active"),
    ]);
    const courseData = (coursesRes.data || []) as Course[];
    setCourses(courseData);
    // Mapa course_id → producto vendible (para el botón de compra de curso).
    const cpMap: Record<string, { productId: string; price: number }> = {};
    ((courseProdRes.data as any[]) || []).forEach((p: any) => {
      if (p.reference_id) cpMap[p.reference_id] = { productId: p.id, price: Number(p.price_usd) || 0 };
    });
    setCourseProducts(cpMap);
    setEnrollments((enrollRes.data || []) as Enrollment[]);
    setProgress((progressRes.data || []) as ProgressRecord[]);
    setCertificates((certsRes.data || []) as Certificate[]);
    setCategories((catsRes.data || []) as Category[]);
    if ((userRes.data as any)?.tier) setUserTier((userRes.data as any).tier);
    setMemberships((memRes.data as Membership[]) || []);
    const bcMap = new Map<string, string[]>();
    ((bcRes.data as any[]) || []).forEach(r => {
      const arr = bcMap.get(r.bundle_id) || []; arr.push(r.course_id); bcMap.set(r.bundle_id, arr);
    });
    setBundles(((bundleRes.data as any[]) || []).map(b => ({ ...b, course_ids: bcMap.get(b.id) || [] })));

    if (courseData.length > 0) {
      const courseIds = courseData.map(c => c.id);
      const { data: mods } = await supabase.from("academy_modules").select("*").in("course_id", courseIds).order("display_order");
      const moduleData = (mods || []) as Module[];
      setModules(moduleData);
      if (moduleData.length > 0) {
        const { data: les } = await supabase.from("academy_lessons").select("*").in("module_id", moduleData.map(m => m.id)).order("display_order");
        setLessons((les || []) as Lesson[]);
      }
    }
  };

  const hasAccess = (courseId: string) => {
    // Sin eCommerce, todo el contenido del portal es gratis (sujeto al nivel).
    if (!commerceEnabled) return true;
    const course = courses.find(c => c.id === courseId);
    if (course?.is_free) return true;
    return enrollments.some(e => e.course_id === courseId);
  };

  // Gate por nivel de membresía: si el curso restringe tiers, el del usuario debe estar.
  const hasTierAccess = (course: Course) => {
    if (!course.required_tiers || course.required_tiers.length === 0) return true;
    return course.required_tiers.includes(userTier);
  };

  // Compra de membresía / paquete: agrega al carrito y abre el checkout.
  const pollPayment = async (orderId: string) => {
    setVerifying(true);
    for (let i = 0; i < 50; i++) {
      try {
        const { data } = await supabase.functions.invoke("portal-commerce", {
          body: { action: "verify_payment", order_id: orderId },
        });
        if (data?.ok && data.status === "paid") {
          setVerifying(false);
          toast.success("¡Pago confirmado! Ya tienes acceso.");
          fetchAll();
          return;
        }
      } catch (e) { /* ignore */ }
      await new Promise(r => setTimeout(r, 3000));
    }
    setVerifying(false);
    toast.info("Tu pago puede tardar unos minutos en confirmarse.");
    fetchAll();
  };

  // Retorno desde la pasarela (?payment=success): busca la última orden cripto
  // pendiente del usuario y la confirma por polling (el backend ya otorgó el acceso).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "success") return;
    window.history.replaceState({}, "", window.location.pathname);
    (async () => {
      const { data } = await supabase
        .from("portal_orders")
        .select("id")
        .eq("partner_user_id", userId)
        .in("payment_gateway", ["coinsbuy", "nowpayments", "stripe_gateway"])
        .eq("payment_status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.id) pollPayment(data.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const doCheckout = async (gateway: string) => {
    if (!purchaseTarget) return;
    setPurchasing(true);
    try {
      // Asegura el producto en el carrito y dispara el checkout (mismo motor que la Tienda).
      await supabase.functions.invoke("portal-commerce", {
        body: { action: "add_to_cart", partner_user_id: userId, product_id: purchaseTarget.productId },
      });
      const redirectUrl = `${window.location.origin}${window.location.pathname}?payment=success`;
      const { data, error } = await supabase.functions.invoke("portal-commerce", {
        body: { action: "checkout", partner_user_id: userId, portal_id: portalId, payment_gateway: gateway, redirect_url: redirectUrl },
      });
      if (error) throw error;
      if (data?.ok) {
        setPurchaseTarget(null);
        if (data.payment_url) {
          // Misma pestaña: window.open(_blank) tras el await lo bloquea el navegador.
          // Al volver, ?payment=success confirma el acceso.
          toast.success("Redirigiendo a la pasarela de pago...");
          window.location.href = data.payment_url;
          return;
        }
        if (gateway === "crypto") {
          // Cripto sin payment_url = el depósito falló.
          toast.error(data.gateway_result?.error || "No se pudo iniciar el pago. Inténtalo de nuevo.");
        } else {
          toast.success("Orden creada.");
          fetchAll();
        }
      } else {
        toast.error(data?.error || "Error en el checkout");
      }
    } catch (e: any) {
      toast.error("Error en el checkout: " + (e.message || e));
    } finally {
      setPurchasing(false);
    }
  };

  const isLessonCompleted = (lessonId: string) => progress.some(p => p.lesson_id === lessonId && p.completed);

  const isLessonUnlocked = (lesson: Lesson) => {
    const mod = modules.find(m => m.id === lesson.module_id);
    if (!mod) return false;
    const course = courses.find(c => c.id === mod.course_id);
    if (!course || !hasAccess(course.id)) return false;

    // Get all lessons in course sorted by module order then lesson order
    const courseMods = modules.filter(m => m.course_id === mod.course_id).sort((a, b) => a.display_order - b.display_order);
    const allLessons: Lesson[] = [];
    courseMods.forEach(m => {
      const modLessons = lessons.filter(l => l.module_id === m.id).sort((a, b) => a.display_order - b.display_order);
      allLessons.push(...modLessons);
    });

    const idx = allLessons.findIndex(l => l.id === lesson.id);
    if (idx === 0) return true;
    // Previous lesson must be completed
    return isLessonCompleted(allLessons[idx - 1].id);
  };

  const getCourseProgress = (courseId: string) => {
    const courseMods = modules.filter(m => m.course_id === courseId);
    const courseLessons = lessons.filter(l => courseMods.some(m => m.id === l.module_id));
    if (courseLessons.length === 0) return 0;
    const completed = courseLessons.filter(l => isLessonCompleted(l.id)).length;
    return Math.round((completed / courseLessons.length) * 100);
  };

  const markCompleted = async (lessonId: string) => {
    const existing = progress.find(p => p.lesson_id === lessonId);
    if (existing?.completed) return;

    if (existing) {
      await supabase.from("academy_progress").update({ completed: true, completed_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("academy_progress").insert({
        lesson_id: lessonId, partner_user_id: userId, completed: true, completed_at: new Date().toISOString(), watch_time_seconds: 0,
      });
    }
    toast.success("¡Lección completada!");

    // Check if course is now 100%
    const mod = modules.find(m => lessons.find(l => l.id === lessonId)?.module_id === m.id);
    if (mod) {
      const course = courses.find(c => c.id === mod.course_id);
      if (course) {
        const courseMods = modules.filter(m => m.course_id === course.id);
        const courseLessons = lessons.filter(l => courseMods.some(m => m.id === l.module_id));
        const completedCount = courseLessons.filter(l => l.id === lessonId || isLessonCompleted(l.id)).length;
        if (completedCount === courseLessons.length) {
          // Issue certificate
          const existingCert = certificates.find(c => c.course_id === course.id);
          if (!existingCert) {
            await supabase.from("academy_certificates").insert({
              course_id: course.id, partner_user_id: userId,
            });
            toast.success("🎉 ¡Curso completado! Tu certificado está listo.");
          }
        }
      }
    }
    fetchAll();
  };

  const getThumbUrl = (path: string | null, width = 600) => {
    if (!path) return null;
    return `${SUPABASE_URL}/storage/v1/render/image/public/academy-thumbnails/${path}?width=${width}&quality=75&resize=cover`;
  };

  const getVideoUrl = (path: string | null) => {
    if (!path) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/academy-videos/${path}`;
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Diálogo de elección de pasarela — compartido por la vista de detalle y la de lista
  // (debe montarse en ambas, porque son returns distintos; antes solo estaba en la lista).
  const purchaseDialog = (
    <Dialog open={!!purchaseTarget} onOpenChange={() => { if (!purchasing) setPurchaseTarget(null); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Completar compra</DialogTitle>
        </DialogHeader>
        {purchaseTarget && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="font-medium text-foreground">{purchaseTarget.title}</p>
              <p className="text-sm text-muted-foreground">${purchaseTarget.price} USD</p>
            </div>
            <p className="text-sm text-muted-foreground">Elige el método de pago:</p>
            <div className="grid grid-cols-1 gap-2">
              <Button disabled={purchasing} className="gap-2" onClick={() => doCheckout("crypto")}>
                {purchasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
                Pagar con cripto
              </Button>
              {CARD_PAYMENT_ENABLED && (
                <Button disabled={purchasing} variant="outline" className="gap-2" onClick={() => doCheckout("stripe_gateway")}>
                  {purchasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  Pagar con tarjeta
                </Button>
              )}
            </div>
            {verifying && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Confirmando el pago…
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  // ===== ACTIVE LESSON VIEW =====
  if (activeLesson && selectedCourse) {
    const videoUrl = getVideoUrl(activeLesson.video_path);
    const completed = isLessonCompleted(activeLesson.id);

    // Find next lesson
    const courseMods = modules.filter(m => m.course_id === selectedCourse.id).sort((a, b) => a.display_order - b.display_order);
    const allLessons: Lesson[] = [];
    courseMods.forEach(m => {
      allLessons.push(...lessons.filter(l => l.module_id === m.id).sort((a, b) => a.display_order - b.display_order));
    });
    const idx = allLessons.findIndex(l => l.id === activeLesson.id);
    const nextLesson = idx < allLessons.length - 1 ? allLessons[idx + 1] : null;

    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setActiveLesson(null)} className="gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Volver al curso
        </Button>

        {(activeLesson.lesson_type || "video") === "document" ? (
          <div className="rounded-xl border border-border bg-card p-6">
            {primaryDoc ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{primaryDoc.file_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Documento de la lección</p>
                </div>
                <Button
                  className="gap-2"
                  disabled={openingAttachmentId === primaryDoc.id}
                  onClick={() => { openAttachment(primaryDoc); if (!completed) markCompleted(activeLesson.id); }}
                >
                  {openingAttachmentId === primaryDoc.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Download className="w-4 h-4" />}
                  Abrir / descargar documento
                </Button>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm">
                El documento de esta lección aún no está disponible.
              </div>
            )}
          </div>
        ) : (
        <div className="bg-black rounded-xl overflow-hidden aspect-video">
          {/*
            Tres caminos de reproducción:
              1) Mux: lesson.mux_playback_id + status=ready → MuxPlayer con
                 signed JWT. HLS adaptativo, CDN global, analytics.
              2) Legacy: solo video_path → <video> nativo (los 23 videos
                 pre-migración hasta que PR Mux #4 los migre).
              3) Sin video: ícono placeholder.
          */}
          {activeLesson.mux_status === "ready" && activeLesson.mux_playback_id ? (
            tokenLoading ? (
              <div className="w-full h-full flex items-center justify-center text-white/70 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Preparando video…</span>
              </div>
            ) : tokenError ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-red-400 gap-2 px-4 text-center">
                <AlertCircle className="w-8 h-8" />
                <span className="text-sm">{tokenError}</span>
              </div>
            ) : playbackToken ? (
              <MuxPlayer
                playbackId={activeLesson.mux_playback_id}
                tokens={{ playback: playbackToken }}
                metadata={{
                  video_id: activeLesson.id,
                  video_title: activeLesson.title,
                  viewer_user_id: userId,
                }}
                envKey={import.meta.env.VITE_MUX_ENV_KEY}
                accentColor={branding.primary_color || "#00E5FF"}
                /* Poster: miniatura propia de la lección si existe; sino
                   cae a la portada del curso (consistencia visual). */
                poster={
                  getThumbUrl(activeLesson.thumbnail_path)
                    || getThumbUrl(selectedCourse.thumbnail_path)
                    || undefined
                }
                autoPlay
                playsInline
                /* minResolution=1080p: forzamos el piso en 1080p para que
                   el video arranque directo en alta calidad cuando el source
                   lo permite (las renditions de Mux con video_quality=plus
                   incluyen 1080p si el master tiene esa resolución o mayor).
                   Si el source es menor a 1080p, Mux Player cae a la mayor
                   rendition disponible (típicamente 720p). En redes muy lentas
                   puede haber más buffering inicial; aceptamos ese tradeoff
                   porque el contenido educativo necesita verse nítido. */
                minResolution="1080p"
                style={{ width: "100%", height: "100%" }}
                onEnded={() => !completed && markCompleted(activeLesson.id)}
              />
            ) : null
          ) : activeLesson.mux_status === "preparing" ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-white/70 gap-2">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-sm">Mux está procesando el video (1-5 min)</span>
              <span className="text-xs text-white/40">Refrescá la página en un momento</span>
            </div>
          ) : activeLesson.mux_status === "errored" ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-red-400 gap-2 px-4 text-center">
              <AlertCircle className="w-8 h-8" />
              <span className="text-sm">No se pudo procesar este video</span>
              <span className="text-xs text-white/40">Contacta al administrador del portal</span>
            </div>
          ) : videoUrl ? (
            // Legacy fallback: lecciones pre-migración con video_path en Storage.
            <video
              src={videoUrl}
              controls
              autoPlay
              playsInline
              preload="metadata"
              poster={
                getThumbUrl(activeLesson.thumbnail_path)
                  || getThumbUrl(selectedCourse.thumbnail_path)
                  || undefined
              }
              className="w-full h-full"
              onEnded={() => !completed && markCompleted(activeLesson.id)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/50">
              <Video className="w-12 h-12" />
            </div>
          )}
        </div>
        )}

        {/* Recursos descargables (adjuntos extra de la lección) */}
        {extraAttachments.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recursos descargables</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {extraAttachments.map(att => (
                <button
                  key={att.id}
                  onClick={() => openAttachment(att)}
                  disabled={openingAttachmentId === att.id}
                  className="w-full flex items-center gap-3 rounded-md border border-border px-3 py-2 text-left hover:bg-muted transition-colors disabled:opacity-60"
                >
                  {openingAttachmentId === att.id
                    ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                    : <Download className="w-4 h-4 text-primary shrink-0" />}
                  <span className="flex-1 min-w-0 text-sm truncate">{att.file_name}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-display font-bold text-foreground">{activeLesson.title}</h3>
            {activeLesson.description && <p className="text-sm text-muted-foreground mt-1">{activeLesson.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            {completed ? (
              <Badge className="bg-green-500/10 text-green-600 gap-1"><CheckCircle className="w-3 h-3" /> Completada</Badge>
            ) : (
              <Button size="sm" onClick={() => markCompleted(activeLesson.id)}>Marcar completada</Button>
            )}
            {nextLesson && completed && (
              <Button size="sm" variant="outline" onClick={() => setActiveLesson(nextLesson)} className="gap-1">
                Siguiente <ChevronRight className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===== COURSE DETAIL VIEW =====
  if (selectedCourse) {
    const courseMods = modules.filter(m => m.course_id === selectedCourse.id).sort((a, b) => a.display_order - b.display_order);
    const pct = getCourseProgress(selectedCourse.id);
    const cert = certificates.find(c => c.course_id === selectedCourse.id);
    const access = hasAccess(selectedCourse.id);
    const tierOk = hasTierAccess(selectedCourse);

    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedCourse(null)} className="gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a cursos
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{selectedCourse.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{selectedCourse.description}</p>
              </div>
              {cert && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-yellow-500/10 text-yellow-600 gap-1">
                    <Award className="w-3.5 h-3.5" /> Certificado
                  </Badge>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => generateCertificatePDF({
                    userName, courseTitle: selectedCourse.title, certificateCode: cert.certificate_code,
                    issuedAt: cert.issued_at, portalName: "",
                    branding: { primary_color: branding.primary_color, accent_color: branding.accent_color, logo_url: branding.logo_url, display_name_override: branding.display_name_override },
                  })}>
                    <Download className="w-3 h-3" /> Descargar
                  </Button>
                </div>
              )}
            </div>
            {access && (
              <div className="flex items-center gap-3 mt-3">
                <Progress value={pct} className="h-2 flex-1" />
                <span className="text-sm font-medium">{pct}%</span>
              </div>
            )}
          </CardHeader>
        </Card>

        {!tierOk && (
          <Card className="border-yellow-500/30">
            <CardContent className="py-8 text-center">
              <Crown className="w-10 h-10 mx-auto text-yellow-500 mb-3" />
              <h3 className="font-display font-bold text-foreground mb-1">Contenido exclusivo de membresía</h3>
              <p className="text-sm text-muted-foreground">
                Este curso es exclusivo para el nivel {selectedCourse.required_tiers!.map(t => labelFor(t)).join(" / ")}.
                Tu nivel actual es {labelFor(userTier)}.
              </p>
              {commerceEnabled && (
                <p className="text-xs text-muted-foreground mt-2">Adquiere la membresía correspondiente más abajo en la sección "Membresías y paquetes".</p>
              )}
            </CardContent>
          </Card>
        )}

        {tierOk && !access && (
          <Card className="border-yellow-500/30">
            <CardContent className="py-8 text-center">
              <Lock className="w-10 h-10 mx-auto text-yellow-500 mb-3" />
              <h3 className="font-display font-bold text-foreground mb-1">Curso Premium</h3>
              <p className="text-sm text-muted-foreground">Este curso requiere compra. Precio: ${selectedCourse.price_usd} USD</p>
              {commerceEnabled && courseProducts[selectedCourse.id] ? (
                <Button
                  className="mt-3 gap-2"
                  onClick={() => setPurchaseTarget({
                    productId: courseProducts[selectedCourse.id].productId,
                    title: selectedCourse.title,
                    price: selectedCourse.price_usd,
                  })}
                >
                  <Coins className="w-4 h-4" /> Comprar e inscribirme · ${selectedCourse.price_usd} USD
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground mt-2">Contacta al administrador para acceder</p>
              )}
            </CardContent>
          </Card>
        )}

        {access && tierOk && courseMods.map(mod => {
          const modLessons = lessons.filter(l => l.module_id === mod.id).sort((a, b) => a.display_order - b.display_order);
          return (
            <Card key={mod.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{mod.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {modLessons.map(lesson => {
                  const completed = isLessonCompleted(lesson.id);
                  const unlocked = isLessonUnlocked(lesson);
                  return (
                    <button
                      key={lesson.id}
                      disabled={!unlocked}
                      onClick={() => unlocked && setActiveLesson(lesson)}
                      className={`w-full flex items-start gap-4 p-4 rounded-lg text-left transition-colors ${
                        unlocked
                          ? "hover:bg-muted cursor-pointer"
                          : "opacity-50 cursor-not-allowed"
                      } ${completed ? "bg-green-500/5" : ""}`}
                    >
                      {/* Miniatura de la lección (con fallback al ícono de
                          estado si el admin no subió imagen). */}
                      {lesson.thumbnail_path ? (
                        <div className="relative shrink-0">
                          <img
                            src={getThumbUrl(lesson.thumbnail_path)!}
                            alt=""
                            className="w-72 h-44 object-cover rounded-md"
                            loading="lazy"
                          />
                          {/* Indicador de estado superpuesto sobre la miniatura. */}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-md">
                            {completed
                              ? <CheckCircle className="w-12 h-12 text-green-400 drop-shadow-lg" />
                              : !unlocked
                                ? <Lock className="w-12 h-12 text-white drop-shadow-lg" />
                                : lesson.lesson_type === "document"
                                  ? <BookOpen className="w-12 h-12 text-white drop-shadow-lg" />
                                  : <PlayCircle className="w-12 h-12 text-white drop-shadow-lg" />}
                          </div>
                        </div>
                      ) : (
                        <div className="w-72 h-44 bg-muted rounded-md shrink-0 flex items-center justify-center">
                          {completed
                            ? <CheckCircle className="w-12 h-12 text-green-500" />
                            : !unlocked
                              ? <Lock className="w-12 h-12 text-muted-foreground" />
                              : lesson.lesson_type === "document"
                                ? <BookOpen className="w-12 h-12 text-primary" />
                                : <PlayCircle className="w-12 h-12 text-primary" />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold">{lesson.title}</p>
                        {lesson.description && (
                          <p className="text-sm text-muted-foreground line-clamp-3 mt-1">
                            {lesson.description}
                          </p>
                        )}
                        {lesson.duration_seconds > 0 && (
                          <p className="text-xs text-muted-foreground mt-2">{formatDuration(lesson.duration_seconds)}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      {purchaseDialog}
      </div>
    );
  }

  // ===== COURSE CATALOG =====
  const visibleCategories = categories.filter(cat => courses.some(c => c.category_id === cat.id));
  const hasUncategorized = courses.some(c => !c.category_id || !categories.some(cat => cat.id === c.category_id));
  const filteredCourses = activeCategory === "all"
    ? courses
    : activeCategory === "__none__"
      ? courses.filter(c => !c.category_id || !categories.some(cat => cat.id === c.category_id))
      : courses.filter(c => c.category_id === activeCategory);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Academy</h2>
        <p className="text-sm text-muted-foreground mt-1">Cursos y contenido educativo disponibles</p>
      </div>

      {/* Category filter chips */}
      {(visibleCategories.length > 0 || hasUncategorized) && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              activeCategory === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            Todos ({courses.length})
          </button>
          {visibleCategories.map(cat => {
            const count = courses.filter(c => c.category_id === cat.id).length;
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
          {hasUncategorized && (
            <button
              onClick={() => setActiveCategory("__none__")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                activeCategory === "__none__"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              General
            </button>
          )}
        </div>
      )}

      {filteredCourses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.map(course => {
            const access = hasAccess(course.id);
            const tierOk = hasTierAccess(course);
            const pct = access ? getCourseProgress(course.id) : 0;
            const cert = certificates.find(c => c.course_id === course.id);
            const thumb = getThumbUrl(course.thumbnail_path);

            return (
              <Card
                key={course.id}
                className={`overflow-hidden cursor-pointer hover:shadow-lg transition-shadow ${!tierOk ? "opacity-75" : ""}`}
                onClick={() => setSelectedCourse(course)}
              >
                <div className="aspect-video bg-muted relative">
                  {thumb ? (
                    <img src={thumb} alt={course.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-10 h-10 text-muted-foreground/30" />
                    </div>
                  )}
                  {!tierOk && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="gap-1"><Lock className="w-3 h-3" /> {course.required_tiers!.map(t => labelFor(t)).join(" / ")}</Badge>
                    </div>
                  )}
                  {tierOk && !access && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="gap-1"><Lock className="w-3 h-3" /> ${course.price_usd}</Badge>
                    </div>
                  )}
                  {tierOk && (course.is_free || !commerceEnabled) && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-green-500 text-white">Gratis</Badge>
                    </div>
                  )}
                  {cert && (
                    <div className="absolute top-2 left-2">
                      <Badge className="bg-yellow-500 text-white gap-1"><Award className="w-3 h-3" /> Completado</Badge>
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-display font-bold text-foreground">{course.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{course.description}</p>
                  {access && pct > 0 && (
                    <div className="flex items-center gap-2 mt-3">
                      <Progress value={pct} className="h-1.5 flex-1" />
                      <span className="text-xs font-medium">{pct}%</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No hay cursos disponibles aún</p>
            <p className="text-sm text-muted-foreground mt-1">Vuelve más tarde para ver contenido educativo</p>
          </CardContent>
        </Card>
      )}

      {/* Membresías y paquetes a la venta — solo con eCommerce activo. */}
      {commerceEnabled && (memberships.length > 0 || bundles.length > 0) && (
        <section className="space-y-3 pt-4">
          <div>
            <h3 className="text-lg font-display font-bold text-foreground">Membresías y paquetes</h3>
            <p className="text-sm text-muted-foreground">Desbloquea más contenido con una membresía o un paquete de cursos.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {memberships.map(m => {
              const owned = m.membership_tier === userTier;
              return (
                <Card key={`mem-${m.id}`} className="overflow-hidden">
                  {m.image_url && (
                    <div className="w-full h-32 overflow-hidden bg-muted">
                      <img src={m.image_url} alt={m.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-yellow-500" />
                      <Badge variant="outline" className="text-xs">Membresía {labelFor(m.membership_tier)}</Badge>
                    </div>
                    <h4 className="font-semibold text-foreground">{m.title}</h4>
                    {m.description && <p className="text-xs text-muted-foreground line-clamp-2">{m.description}</p>}
                    <p className="text-sm font-medium text-foreground">${m.price_usd} USD</p>
                    {owned ? (
                      <Badge className="bg-green-600 gap-1"><CheckCircle className="w-3 h-3" /> Ya tienes este nivel</Badge>
                    ) : (
                      <Button size="sm" className="w-full gap-1.5" onClick={() => setPurchaseTarget({ productId: m.id, title: m.title, price: m.price_usd })}>
                        Adquirir · ${m.price_usd} USD
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {bundles.map(b => (
              <Card key={`bundle-${b.id}`} className="overflow-hidden">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />
                    <Badge variant="outline" className="text-xs">Paquete · {b.course_ids.length} curso(s)</Badge>
                  </div>
                  <h4 className="font-semibold text-foreground">{b.title}</h4>
                  {b.description && <p className="text-xs text-muted-foreground line-clamp-2">{b.description}</p>}
                  <p className="text-sm font-medium text-foreground">${b.price_usd} USD</p>
                  {b.product_id ? (
                    <Button size="sm" className="w-full gap-1.5" onClick={() => setPurchaseTarget({ productId: b.product_id!, title: b.title, price: b.price_usd })}>
                      Comprar · ${b.price_usd} USD
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">No disponible para compra</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Diálogo de compra (elección de pasarela) */}
      {purchaseDialog}
    </div>
  );
};

export default AcademyClient;
