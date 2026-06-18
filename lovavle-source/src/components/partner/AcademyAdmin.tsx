import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/toastUtils";
import {
  Plus, Trash2, Edit, Upload, GripVertical, BookOpen, Video,
  Users, BarChart3, ChevronDown, ChevronRight, Award, UserPlus,
  Eye, Lock, Unlock, FolderTree, Pencil, Loader2, AlertCircle, CheckCircle2,
  PlayCircle, Sparkles, Crown, Network
} from "lucide-react";
import ProductCommissionLevelsDialog from "./ProductCommissionLevelsDialog";
import { usePortalBranding, dimHex } from "@/hooks/usePortalBranding";
import { usePortalTiers } from "@/hooks/usePortalTiers";
import { usePortalBrand, brandText } from "@/lib/portalBrand";
import * as UpChunk from "@mux/upchunk";
import MuxPlayer from "@mux/mux-player-react";
import AcademyMonetization from "@/components/partner/AcademyMonetization";

interface AcademyAdminProps {
  portalId: string;
  // Bullfy eCommerce del portal. Si está OFF, el IB no puede poner precios ni
  // monetizar: los cursos se publican gratis y se ocultan precio + membresías.
  commerceEnabled?: boolean;
}

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail_path: string | null;
  display_order: number;
  status: string;
  price_usd: number;
  is_free: boolean;
  created_at: string;
  category_id: string | null;
  required_tiers: string[] | null;
}


interface Category {
  id: string;
  portal_id: string;
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
  video_path: string | null;            // legacy: videos previos a la migración Mux
  thumbnail_path: string | null;         // miniatura de la lección (storage academy-thumbnails)
  mux_status: MuxStatus | null;          // estado del asset en Mux
  mux_playback_id: string | null;        // ID público de playback (signed)
  mux_error_message: string | null;
  duration_seconds: number;
  display_order: number;
}

interface Attachment {
  id: string;
  lesson_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  size_bytes: number | null;
  is_primary: boolean;
  display_order: number;
}

interface PartnerUser {
  id: string;
  nombre: string;
  email: string;
  tier: string;
}

interface Enrollment {
  id: string;
  course_id: string;
  partner_user_id: string;
  granted_by: string;
  enrolled_at: string;
}

interface ProgressRecord {
  lesson_id: string;
  partner_user_id: string;
  completed: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const AcademyAdmin = ({ portalId, commerceEnabled = false }: AcademyAdminProps) => {
  const { branding } = usePortalBranding(portalId);
  const { tiers } = usePortalTiers(portalId);
  const { isWhiteLabel } = usePortalBrand();
  const activeTiers = tiers.filter(t => t.active);
  const btnBg = dimHex(branding.primary_color, 0.7);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [users, setUsers] = useState<PartnerUser[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);

  // Categories management
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [editCategory, setEditCategory] = useState<Partial<Category>>({});
  const [showCategoriesPanel, setShowCategoriesPanel] = useState(false);

  // Dialogs
  const [courseDialog, setCourseDialog] = useState(false);
  const [moduleDialog, setModuleDialog] = useState(false);
  const [lessonDialog, setLessonDialog] = useState(false);
  const [enrollDialog, setEnrollDialog] = useState(false);

  // Form state
  const [editCourse, setEditCourse] = useState<Partial<Course> & { portal_id?: string }>({});
  const [overrideTarget, setOverrideTarget] = useState<{ productId: string; title: string; price: number } | null>(null);
  const [editModule, setEditModule] = useState<Partial<Module>>({});
  const [editLesson, setEditLesson] = useState<Partial<Lesson>>({});
  const [enrollCourseId, setEnrollCourseId] = useState("");
  const [enrollUserId, setEnrollUserId] = useState("");

  // Expanded
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  // Upload
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [uploadingLessonThumb, setUploadingLessonThumb] = useState(false);

  // Adjuntos / documentos de la lección en edición
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  // ID de la lección actualmente migrando (para deshabilitar el botón y
  // mostrar spinner solo en esa fila).
  const [migratingLessonId, setMigratingLessonId] = useState<string | null>(null);

  // Preview admin: previsualizar lección con MuxPlayer antes de publicar el
  // curso. Usa academy-mux-signed-token con preview=true (auth admin, no
  // partner_user). Token TTL 1h; se refetcha si el admin reabre el preview.
  const [previewLesson, setPreviewLesson] = useState<Lesson | null>(null);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, [portalId]);

  // Polling: cuando hay alguna lección en estado 'preparing' (Mux todavía
  // transcodeando), reconsultamos cada 5 segundos los campos que cambian
  // por el webhook (mux_status, mux_playback_id, duration). Apenas todas
  // pasan a 'ready' o 'errored', el polling se apaga solo. Sin esto el
  // admin tenía que F5 manual para ver el estado actualizado.
  useEffect(() => {
    const preparingIds = lessons.filter(l => l.mux_status === "preparing").map(l => l.id);
    if (preparingIds.length === 0) return;

    const interval = window.setInterval(async () => {
      const { data: updated } = await supabase
        .from("academy_lessons")
        .select("id, mux_status, mux_playback_id, mux_duration_seconds, mux_error_message, duration_seconds")
        .in("id", preparingIds);
      if (!updated || updated.length === 0) return;

      setLessons(prev => prev.map(l => {
        const fresh = updated.find((u: any) => u.id === l.id);
        if (!fresh) return l;
        // Solo crear nuevo objeto si algo cambió (evita re-renders inútiles).
        if (fresh.mux_status === l.mux_status && fresh.mux_playback_id === l.mux_playback_id) {
          return l;
        }
        return { ...l, ...fresh };
      }));

      // Si el editLesson abierto es uno de los que actualizamos, propagar
      // los nuevos campos al state del dialog también.
      setEditLesson(prev => {
        if (!prev.id) return prev;
        const fresh = updated.find((u: any) => u.id === prev.id);
        if (!fresh || fresh.mux_status === prev.mux_status) return prev;
        return { ...prev, ...fresh };
      });
    }, 5000);

    return () => window.clearInterval(interval);
  }, [lessons]);

  // Preview admin: cuando setPreviewLesson(L) se llama, pedimos el signed
  // JWT a la EF academy-mux-signed-token con `preview: true`. El EF
  // valida que el caller sea admin del portal (no requiere partner_user_id).
  useEffect(() => {
    if (!previewLesson?.mux_playback_id) {
      setPreviewToken(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewToken(null);
    (async () => {
      const { data, error } = await supabase.functions.invoke(
        "academy-mux-signed-token",
        { body: { lesson_id: previewLesson.id, preview: true } },
      );
      if (cancelled) return;
      if (error || !data?.ok || !data?.token) {
        setPreviewError(data?.error || error?.message || "No se pudo cargar la previsualización");
        setPreviewLoading(false);
        return;
      }
      setPreviewToken(data.token);
      setPreviewLoading(false);
    })();
    return () => { cancelled = true; };
  }, [previewLesson?.id, previewLesson?.mux_playback_id]);

  const fetchAll = async () => {
    const [coursesRes, usersRes, enrollRes, progressRes, catsRes] = await Promise.all([
      supabase.from("academy_courses").select("*").eq("portal_id", portalId).order("display_order"),
      supabase.from("partner_users").select("id, nombre, email, tier").eq("portal_id", portalId).eq("status", "approved"),
      supabase.from("academy_enrollments").select("*"),
      supabase.from("academy_progress").select("lesson_id, partner_user_id, completed"),
      supabase.from("academy_categories").select("*").eq("portal_id", portalId).order("display_order"),
    ]);
    const courseData = (coursesRes.data || []) as Course[];
    setCourses(courseData);
    setUsers((usersRes.data || []) as PartnerUser[]);
    setEnrollments((enrollRes.data || []) as Enrollment[]);
    setProgress((progressRes.data || []) as ProgressRecord[]);
    setCategories((catsRes.data || []) as Category[]);

    if (courseData.length > 0) {
      const courseIds = courseData.map(c => c.id);
      const { data: mods } = await supabase.from("academy_modules").select("*").in("course_id", courseIds).order("display_order");
      const moduleData = (mods || []) as Module[];
      setModules(moduleData);

      if (moduleData.length > 0) {
        const modIds = moduleData.map(m => m.id);
        const { data: les } = await supabase.from("academy_lessons").select("*").in("module_id", modIds).order("display_order");
        setLessons((les || []) as Lesson[]);
      }
    }
  };

  // --- COURSE CRUD ---
  const openCourseDialog = (course?: Course) => {
    setEditCourse(course ? { ...course } : { title: "", description: "", status: "draft", price_usd: 0, is_free: false, portal_id: portalId });
    setCourseDialog(true);
  };

  const saveCourse = async () => {
    if (!editCourse.title) return toast.error("Título requerido");
    if (editCourse.id) {
      const { error } = await supabase.from("academy_courses").update({
        title: editCourse.title, description: editCourse.description, status: editCourse.status,
        price_usd: editCourse.price_usd, is_free: editCourse.is_free, thumbnail_path: editCourse.thumbnail_path,
        category_id: editCourse.category_id || null,
        required_tiers: editCourse.required_tiers && editCourse.required_tiers.length > 0 ? editCourse.required_tiers : null,
      }).eq("id", editCourse.id);
      if (error) return toast.error(error.message);
      toast.success("Curso actualizado");
    } else {
      const { error } = await supabase.from("academy_courses").insert({
        portal_id: portalId, title: editCourse.title!, description: editCourse.description || "",
        status: editCourse.status || "draft", price_usd: editCourse.price_usd || 0, is_free: editCourse.is_free || false,
        display_order: courses.length, category_id: editCourse.category_id || null,
        required_tiers: editCourse.required_tiers && editCourse.required_tiers.length > 0 ? editCourse.required_tiers : null,
      });
      if (error) return toast.error(error.message);
      toast.success("Curso creado");
    }
    setCourseDialog(false);
    fetchAll();
  };

  // --- CATEGORY CRUD ---
  const openCategoryDialog = (category?: Category) => {
    setEditCategory(category ? { ...category } : { name: "", display_order: categories.length });
    setCategoryDialog(true);
  };

  const saveCategory = async () => {
    if (!editCategory.name?.trim()) return toast.error("Nombre requerido");
    if (editCategory.id) {
      const { error } = await supabase.from("academy_categories").update({
        name: editCategory.name.trim(), display_order: editCategory.display_order ?? 0,
      }).eq("id", editCategory.id);
      if (error) return toast.error(error.message);
      toast.success("Categoría actualizada");
    } else {
      const { error } = await supabase.from("academy_categories").insert({
        portal_id: portalId, name: editCategory.name.trim(), display_order: editCategory.display_order ?? categories.length,
      });
      if (error) return toast.error(error.message);
      toast.success("Categoría creada");
    }
    setCategoryDialog(false);
    fetchAll();
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("¿Eliminar esta categoría? Los cursos asociados pasarán a 'General'.")) return;
    const { error } = await supabase.from("academy_categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Categoría eliminada");
    fetchAll();
  };

  const deleteCourse = async (id: string) => {
    if (!confirm("¿Eliminar este curso y todo su contenido?")) return;
    await supabase.from("academy_courses").delete().eq("id", id);
    toast.success("Curso eliminado");
    fetchAll();
  };

  const toggleCourseStatus = async (course: Course) => {
    const newStatus = course.status === "published" ? "draft" : "published";
    await supabase.from("academy_courses").update({ status: newStatus }).eq("id", course.id);
    toast.success(newStatus === "published" ? "Curso publicado" : "Curso despublicado");
    fetchAll();
  };

  // --- MODULE CRUD ---
  const openModuleDialog = (courseId: string, mod?: Module) => {
    setEditModule(mod ? { ...mod } : { course_id: courseId, title: "" });
    setModuleDialog(true);
  };

  const saveModule = async () => {
    if (!editModule.title) return toast.error("Título requerido");
    if (editModule.id) {
      const { error } = await supabase.from("academy_modules").update({ title: editModule.title }).eq("id", editModule.id);
      if (error) return toast.error(error.message);
      toast.success("Módulo actualizado");
    } else {
      const modsInCourse = modules.filter(m => m.course_id === editModule.course_id);
      const { error } = await supabase.from("academy_modules").insert({
        course_id: editModule.course_id!, title: editModule.title!, display_order: modsInCourse.length,
      });
      if (error) return toast.error(error.message);
      toast.success("Módulo creado");
    }
    setModuleDialog(false);
    fetchAll();
  };

  const deleteModule = async (id: string) => {
    if (!confirm("¿Eliminar este módulo y sus lecciones?")) return;
    await supabase.from("academy_modules").delete().eq("id", id);
    toast.success("Módulo eliminado");
    fetchAll();
  };

  // --- LESSON CRUD ---
  const openLessonDialog = (moduleId: string, lesson?: Lesson) => {
    setEditLesson(lesson ? { ...lesson } : { module_id: moduleId, title: "", description: "", lesson_type: "video" });
    setAttachments([]);
    if (lesson?.id) fetchAttachments(lesson.id);
    setLessonDialog(true);
  };

  const fetchAttachments = async (lessonId: string) => {
    const { data } = await supabase
      .from("academy_lesson_attachments")
      .select("*")
      .eq("lesson_id", lessonId)
      .order("display_order", { ascending: true });
    setAttachments((data as Attachment[]) || []);
  };

  const saveLesson = async () => {
    if (!editLesson.title) return toast.error("Título requerido");
    if (editLesson.id) {
      await supabase.from("academy_lessons").update({
        title: editLesson.title, description: editLesson.description, video_path: editLesson.video_path,
        thumbnail_path: editLesson.thumbnail_path ?? null,
        lesson_type: editLesson.lesson_type || "video",
        duration_seconds: editLesson.duration_seconds,
      }).eq("id", editLesson.id);
      toast.success("Lección actualizada");
    } else {
      const lessonsInMod = lessons.filter(l => l.module_id === editLesson.module_id);
      await supabase.from("academy_lessons").insert({
        module_id: editLesson.module_id!, title: editLesson.title!, description: editLesson.description || "",
        lesson_type: editLesson.lesson_type || "video",
        video_path: editLesson.video_path || null,
        thumbnail_path: editLesson.thumbnail_path || null,
        duration_seconds: editLesson.duration_seconds || 0,
        display_order: lessonsInMod.length,
      });
      toast.success("Lección creada");
    }
    setLessonDialog(false);
    fetchAll();
  };

  // --- ATTACHMENTS ---
  // Sube un archivo al bucket privado academy-attachments y registra la fila.
  // Requiere que la lección ya exista (tenga id) para asociarla.
  const handleAttachmentUpload = async (file: File) => {
    if (!editLesson.id) {
      toast.error("Guarda la lección primero para agregar archivos");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("El archivo no puede superar los 50MB");
      return;
    }
    setUploadingAttachment(true);
    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `lessons/${editLesson.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("academy-attachments")
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (upErr) throw upErr;

      // El primer archivo de una lección 'document' queda como principal.
      const isPrimary =
        (editLesson.lesson_type || "video") === "document" &&
        !attachments.some(a => a.is_primary);

      const { error: insErr } = await supabase.from("academy_lesson_attachments").insert({
        lesson_id: editLesson.id,
        file_name: file.name,
        file_path: path,
        file_type: file.type || null,
        size_bytes: file.size,
        is_primary: isPrimary,
        display_order: attachments.length,
      });
      if (insErr) throw insErr;

      toast.success("Archivo agregado");
      fetchAttachments(editLesson.id);
    } catch (e: any) {
      toast.error("Error al subir el archivo: " + e.message);
    } finally {
      setUploadingAttachment(false);
    }
  };

  const deleteAttachment = async (att: Attachment) => {
    if (!confirm(`¿Eliminar "${att.file_name}"?`)) return;
    await supabase.storage.from("academy-attachments").remove([att.file_path]);
    await supabase.from("academy_lesson_attachments").delete().eq("id", att.id);
    toast.success("Archivo eliminado");
    if (editLesson.id) fetchAttachments(editLesson.id);
  };

  // Abre un adjunto en preview (admin) vía signed URL.
  const previewAttachment = async (att: Attachment) => {
    const { data, error } = await supabase.functions.invoke("academy-file-url", {
      body: { attachment_id: att.id, preview: true },
    });
    if (error || !data?.ok || !data?.url) {
      toast.error(data?.error || "No se pudo abrir el archivo");
      return;
    }
    window.open(data.url, "_blank", "noopener,noreferrer");
  };

  const formatBytes = (n: number | null) => {
    if (!n) return "";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  };

  const deleteLesson = async (id: string) => {
    if (!confirm("¿Eliminar esta lección?")) return;
    await supabase.from("academy_lessons").delete().eq("id", id);
    toast.success("Lección eliminada");
    fetchAll();
  };

  // --- VIDEO UPLOAD (Mux) ---
  // El flujo es:
  //   1. Si la lección es nueva, hay que insertarla primero (necesitamos
  //      lesson_id para que el EF guarde mux_upload_id). Requiere título.
  //   2. Llamamos al EF academy-mux-create-upload → devuelve una URL temporal
  //      de Mux para hacer PUT directo.
  //   3. UpChunk sube el archivo en chunks (con retry automático y progress).
  //   4. Cuando termina el upload, Mux transcodea por su cuenta (1-5 min).
  //      El webhook actualiza mux_status='ready' + mux_playback_id en background.
  //      El admin puede cerrar el dialog tranquilo, la UI mostrará "Procesando".
  const handleVideoUpload = async (file: File) => {
    setUploadingVideo(true);
    setUploadProgress(0);

    try {
      // 1) Asegurar que la lección existe en DB.
      let lessonId = editLesson.id;
      if (!lessonId) {
        if (!editLesson.title?.trim()) {
          toast.error("Ponle un título a la lección antes de subir el video");
          setUploadingVideo(false);
          return;
        }
        const lessonsInMod = lessons.filter(l => l.module_id === editLesson.module_id);
        const { data: created, error: insErr } = await supabase
          .from("academy_lessons")
          .insert({
            module_id: editLesson.module_id!,
            title: editLesson.title!,
            description: editLesson.description || "",
            display_order: lessonsInMod.length,
          })
          .select("id")
          .single();
        if (insErr || !created) {
          toast.error("Error creando la lección: " + (insErr?.message || ""));
          setUploadingVideo(false);
          return;
        }
        lessonId = created.id;
        setEditLesson(prev => ({ ...prev, id: lessonId }));
      }

      // 2) Pedir upload URL al EF.
      // getSession() garantiza un access_token de usuario fresco (refresca si
      // está vencido). Sin esto, functions.invoke a veces envía la anon key y el
      // EF responde "No autenticado" (auth.getUser sin usuario).
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Tu sesión expiró. Recarga la página e inicia sesión de nuevo.");
        setUploadingVideo(false);
        return;
      }
      const { data: muxData, error: muxErr } = await supabase.functions.invoke(
        "academy-mux-create-upload",
        {
          body: { lesson_id: lessonId },
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );
      if (muxErr || !muxData?.ok || !muxData?.upload_url) {
        toast.error(muxData?.error || muxErr?.message || "Error preparando la subida del video");
        setUploadingVideo(false);
        return;
      }

      // 3) Upload con UpChunk (chunks de 5MB, retry automático).
      const upload = UpChunk.createUpload({
        endpoint: muxData.upload_url,
        file,
        chunkSize: 5120, // 5MB
      });

      upload.on("error", (event: any) => {
        console.error("UpChunk error", event.detail);
        toast.error("Error subiendo video: " + (event.detail?.message || "desconocido"));
        setUploadingVideo(false);
        setUploadProgress(0);
      });

      upload.on("progress", (event: any) => {
        setUploadProgress(Math.round(event.detail));
      });

      upload.on("success", () => {
        toast.success("Video subido. Se está procesando (puede tardar de 1 a 5 minutos).");
        setEditLesson(prev => ({ ...prev, mux_status: "preparing" as MuxStatus }));
        setUploadingVideo(false);
        setUploadProgress(0);
        // Refrescamos para que la UI muestre el estado actualizado.
        fetchAll();
      });
    } catch (e) {
      console.error("handleVideoUpload error", e);
      toast.error("Error inesperado subiendo video");
      setUploadingVideo(false);
      setUploadProgress(0);
    }
  };

  // --- LEGACY MIGRATION (lección con video_path en Supabase Storage → Mux) ---
  // Llama a la EF academy-mux-migrate-legacy. La EF le pasa a Mux la signed URL
  // del bucket y Mux pullea + transcodea por su cuenta. El webhook ya existente
  // (video.asset.ready) cierra el flujo persistiendo playback_id y duration.
  const handleMigrateLegacy = async (lesson: Lesson) => {
    if (!confirm(`¿Migrar "${lesson.title}" al sistema nuevo? Mux procesará el video en background (1-5 min).`)) return;
    setMigratingLessonId(lesson.id);
    try {
      const { data, error } = await supabase.functions.invoke(
        "academy-mux-migrate-legacy",
        { body: { lesson_id: lesson.id } },
      );
      if (error || !data?.ok) {
        toast.error(data?.error || error?.message || "Error al migrar la lección");
        return;
      }
      toast.success("Migración iniciada. El video estará listo en 1-5 minutos.");
      // Marcar localmente como preparing — el polling existente lo actualizará
      // a ready cuando llegue el webhook.
      setLessons(prev => prev.map(l =>
        l.id === lesson.id
          ? { ...l, mux_asset_id: data.mux_asset_id, mux_status: "preparing" as MuxStatus }
          : l,
      ));
    } catch (e) {
      console.error("handleMigrateLegacy error", e);
      toast.error("Error inesperado al migrar");
    } finally {
      setMigratingLessonId(null);
    }
  };

  // --- THUMBNAIL UPLOAD (curso) ---
  const handleThumbnailUpload = async (file: File) => {
    setUploadingThumb(true);
    const path = `${portalId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("academy-thumbnails").upload(path, file);
    if (error) { toast.error("Error subiendo imagen"); setUploadingThumb(false); return; }
    setEditCourse(prev => ({ ...prev, thumbnail_path: path }));
    toast.success("Imagen subida");
    setUploadingThumb(false);
  };

  // --- THUMBNAIL UPLOAD (lección) ---
  // Reusa el mismo bucket academy-thumbnails — las policies de storage ya
  // permiten al portal owner subir ahí. La distinción curso/lección es solo
  // por la columna en la que se guarda el path (academy_courses.thumbnail_path
  // vs academy_lessons.thumbnail_path).
  const handleLessonThumbnailUpload = async (file: File) => {
    setUploadingLessonThumb(true);
    const path = `${portalId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("academy-thumbnails").upload(path, file);
    if (error) { toast.error("Error subiendo miniatura"); setUploadingLessonThumb(false); return; }
    setEditLesson(prev => ({ ...prev, thumbnail_path: path }));

    // Si la lección ya está persistida (caso edición o auto-save tras
    // upload de video), persistimos el thumbnail_path en DB inmediatamente
    // para que aparezca en la lista sin esperar al save final.
    if (editLesson.id) {
      await supabase.from("academy_lessons").update({ thumbnail_path: path }).eq("id", editLesson.id);
    }

    toast.success("Miniatura subida");
    setUploadingLessonThumb(false);
  };

  // --- ENROLLMENTS ---
  const openEnrollDialog = (courseId: string) => {
    setEnrollCourseId(courseId);
    setEnrollUserId("");
    setEnrollDialog(true);
  };

  const saveEnrollment = async () => {
    if (!enrollUserId) return toast.error("Selecciona un usuario");
    const exists = enrollments.find(e => e.course_id === enrollCourseId && e.partner_user_id === enrollUserId);
    if (exists) return toast.error("El usuario ya está inscrito");
    const { error } = await supabase.from("academy_enrollments").insert({
      course_id: enrollCourseId, partner_user_id: enrollUserId, granted_by: "admin_manual",
    });
    if (error) return toast.error(error.message);
    toast.success("Usuario inscrito");
    setEnrollDialog(false);
    fetchAll();
  };

  const removeEnrollment = async (id: string) => {
    await supabase.from("academy_enrollments").delete().eq("id", id);
    toast.success("Inscripción eliminada");
    fetchAll();
  };

  // --- STATS ---
  const getCourseProgress = (courseId: string) => {
    const courseMods = modules.filter(m => m.course_id === courseId);
    const courseLessons = lessons.filter(l => courseMods.some(m => m.id === l.module_id));
    const courseEnrolls = enrollments.filter(e => e.course_id === courseId);
    if (courseLessons.length === 0 || courseEnrolls.length === 0) return 0;
    const totalPossible = courseLessons.length * courseEnrolls.length;
    const completed = progress.filter(p => p.completed && courseLessons.some(l => l.id === p.lesson_id) && courseEnrolls.some(e => e.partner_user_id === p.partner_user_id)).length;
    return Math.round((completed / totalPossible) * 100);
  };

  const getUserCourseProgress = (userId: string, courseId: string) => {
    const courseMods = modules.filter(m => m.course_id === courseId);
    const courseLessons = lessons.filter(l => courseMods.some(m => m.id === l.module_id));
    if (courseLessons.length === 0) return 0;
    const completed = progress.filter(p => p.completed && p.partner_user_id === userId && courseLessons.some(l => l.id === p.lesson_id)).length;
    return Math.round((completed / courseLessons.length) * 100);
  };

  const getThumbUrl = (path: string | null) => {
    if (!path) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/academy-thumbnails/${path}`;
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Badge de estado del video para mostrar en la lista de lecciones.
  // Hay 4 estados visibles:
  //   - ready    → no mostramos badge (el video está OK, ícono de Video basta).
  //   - preparing → "Procesando" con spinner (Mux está transcodeando).
  //   - errored  → "Error" en rojo, hover muestra el mensaje.
  //   - legacy   → "Legacy" gris si tiene video_path pero no Mux (de los 23
  //                videos viejos pre-migración, PR Mux #4 los migra).
  //   - sin video → "Sin video" outline si no tiene ni video_path ni mux.
  const renderLessonVideoBadge = (lesson: Lesson) => {
    if (lesson.mux_status === "ready") return null;
    if (lesson.mux_status === "preparing") {
      return (
        <Badge variant="secondary" className="text-[10px] gap-1">
          <Loader2 className="w-2.5 h-2.5 animate-spin" /> Procesando
        </Badge>
      );
    }
    if (lesson.mux_status === "errored") {
      return (
        <Badge variant="destructive" className="text-[10px] gap-1" title={lesson.mux_error_message || ""}>
          <AlertCircle className="w-2.5 h-2.5" /> Error
        </Badge>
      );
    }
    if (lesson.video_path) {
      return <Badge variant="outline" className="text-[10px]">Legacy</Badge>;
    }
    return <Badge variant="outline" className="text-[10px]">Sin video</Badge>;
  };

  return (
    <Tabs defaultValue="courses" className="space-y-4">
      <TabsList>
        <TabsTrigger value="courses" className="gap-1"><BookOpen className="w-3.5 h-3.5" /> Cursos</TabsTrigger>
        {commerceEnabled && (
          <TabsTrigger value="monetization" className="gap-1"><Crown className="w-3.5 h-3.5" /> Membresías y Paquetes</TabsTrigger>
        )}
        <TabsTrigger value="enrollments" className="gap-1"><Users className="w-3.5 h-3.5" /> Inscripciones</TabsTrigger>
        <TabsTrigger value="stats" className="gap-1"><BarChart3 className="w-3.5 h-3.5" /> Estadísticas</TabsTrigger>
      </TabsList>

      {commerceEnabled && (
        <TabsContent value="monetization" className="space-y-4">
          <AcademyMonetization portalId={portalId} />
        </TabsContent>
      )}

      {/* ===== COURSES TAB ===== */}
      <TabsContent value="courses" className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-muted-foreground">{courses.length} curso(s) · {categories.length} categoría(s)</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCategoriesPanel(p => !p)} className="gap-1">
              <FolderTree className="w-4 h-4" /> Categorías
            </Button>
            <Button onClick={() => openCourseDialog()} className="gap-1" style={{ backgroundColor: btnBg }}>
              <Plus className="w-4 h-4" /> Nuevo Curso
            </Button>
          </div>
        </div>

        {/* Categories management panel */}
        {showCategoriesPanel && (
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FolderTree className="w-4 h-4" /> Gestionar Categorías
              </CardTitle>
              <Button size="sm" onClick={() => openCategoryDialog()} className="gap-1" style={{ backgroundColor: btnBg }}>
                <Plus className="w-3 h-3" /> Nueva
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sin categorías. Crea categorías como "Trading", "Marketing", "Análisis Técnico", etc.
                </p>
              ) : categories.map(cat => {
                const count = courses.filter(c => c.category_id === cat.id).length;
                return (
                  <div key={cat.id} className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <FolderTree className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{cat.name}</span>
                      <Badge variant="secondary" className="text-xs">{count} curso(s)</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openCategoryDialog(cat)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteCategory(cat.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Courses grouped by category */}
        {(() => {
          const groups: { id: string | null; name: string; items: Course[] }[] = [
            ...categories.map(cat => ({ id: cat.id, name: cat.name, items: courses.filter(c => c.category_id === cat.id) })),
            { id: null, name: "General (sin categoría)", items: courses.filter(c => !c.category_id || !categories.some(cat => cat.id === c.category_id)) },
          ].filter(g => g.items.length > 0);

          if (courses.length === 0) {
            return (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>No hay cursos aún. Crea tu primer curso.</p>
              </CardContent></Card>
            );
          }

          return groups.map(group => (
            <div key={group.id ?? "uncategorized"} className="space-y-2">
              <div className="flex items-center gap-2 pt-2">
                <FolderTree className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-display font-bold text-sm text-foreground">{group.name}</h3>
                <Badge variant="outline" className="text-xs">{group.items.length}</Badge>
              </div>
              {group.items.map(course => (
                <Card key={course.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpandedCourse(expandedCourse === course.id ? null : course.id)}>
                        {expandedCourse === course.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        {course.thumbnail_path && (
                          <img src={getThumbUrl(course.thumbnail_path)!} alt="" className="w-60 h-36 object-cover rounded-md shrink-0" />
                        )}
                        <div>
                          <CardTitle className="text-base">{course.title}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {course.is_free ? "Gratuito" : `$${course.price_usd} USD`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={course.status === "published" ? "default" : "secondary"}>
                          {course.status === "published" ? "Publicado" : "Borrador"}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => toggleCourseStatus(course)}>
                          {course.status === "published" ? <Eye className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openCourseDialog(course)}><Edit className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => openEnrollDialog(course.id)}><UserPlus className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteCourse(course.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  </CardHeader>

                  {expandedCourse === course.id && (
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">Módulos</p>
                        <Button variant="outline" size="sm" onClick={() => openModuleDialog(course.id)} className="gap-1">
                          <Plus className="w-3 h-3" /> Módulo
                        </Button>
                      </div>

                      {modules.filter(m => m.course_id === course.id).map(mod => (
                        <div key={mod.id} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpandedModule(expandedModule === mod.id ? null : mod.id)}>
                              {expandedModule === mod.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              <span className="font-medium text-sm">{mod.title}</span>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openModuleDialog(course.id, mod)}><Edit className="w-3 h-3" /></Button>
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteModule(mod.id)}><Trash2 className="w-3 h-3" /></Button>
                            </div>
                          </div>

                          {expandedModule === mod.id && (
                            <div className="pl-6 space-y-2">
                              {lessons.filter(l => l.module_id === mod.id).map(lesson => (
                                <div key={lesson.id} className="flex items-start justify-between gap-2 py-2 px-2 bg-muted/50 rounded text-sm">
                                  <div className="flex items-start gap-3 flex-1 min-w-0">
                                    {/* Miniatura. Si no hay, placeholder con ícono Video. */}
                                    {lesson.thumbnail_path ? (
                                      <img
                                        src={getThumbUrl(lesson.thumbnail_path)!}
                                        alt=""
                                        className="w-48 h-28 object-cover rounded-md shrink-0"
                                      />
                                    ) : (
                                      <div className="w-48 h-28 bg-muted rounded-md shrink-0 flex items-center justify-center">
                                        <Video className="w-8 h-8 text-muted-foreground" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium">{lesson.title}</span>
                                        {lesson.duration_seconds > 0 && (
                                          <span className="text-xs text-muted-foreground">({formatDuration(lesson.duration_seconds)})</span>
                                        )}
                                        {renderLessonVideoBadge(lesson)}
                                      </div>
                                      {lesson.description && (
                                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                          {lesson.description}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    {/* Migrar a Mux: lecciones legacy con video_path en Storage
                                        pero sin entrada en Mux (mux_status null o errored). */}
                                    {lesson.video_path && (!lesson.mux_status || lesson.mux_status === "errored") && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        title="Migrar al sistema nuevo (mejora la velocidad de reproducción)"
                                        disabled={migratingLessonId === lesson.id}
                                        onClick={() => handleMigrateLegacy(lesson)}
                                      >
                                        {migratingLessonId === lesson.id
                                          ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                                          : <Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                                      </Button>
                                    )}
                                    {/* Preview solo disponible para lecciones con video en estado ready */}
                                    {lesson.mux_status === "ready" && lesson.mux_playback_id && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        title="Previsualizar video"
                                        onClick={() => setPreviewLesson(lesson)}
                                      >
                                        <PlayCircle className="w-3.5 h-3.5 text-primary" />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="sm" onClick={() => openLessonDialog(mod.id, lesson)}><Edit className="w-3 h-3" /></Button>
                                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteLesson(lesson.id)}><Trash2 className="w-3 h-3" /></Button>
                                  </div>
                                </div>
                              ))}
                              <Button variant="ghost" size="sm" onClick={() => openLessonDialog(mod.id)} className="gap-1 text-xs">
                                <Plus className="w-3 h-3" /> Lección
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          ));
        })()}
      </TabsContent>

      {/* ===== ENROLLMENTS TAB ===== */}
      <TabsContent value="enrollments" className="space-y-4">
        {courses.map(course => {
          const courseEnrolls = enrollments.filter(e => e.course_id === course.id);
          return (
            <Card key={course.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{course.title}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{courseEnrolls.length} inscrito(s)</Badge>
                    <Button size="sm" onClick={() => openEnrollDialog(course.id)} className="gap-1">
                      <UserPlus className="w-3 h-3" /> Inscribir
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {courseEnrolls.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Nivel</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Progreso</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {courseEnrolls.map(e => {
                        const u = users.find(u => u.id === e.partner_user_id);
                        const pct = getUserCourseProgress(e.partner_user_id, course.id);
                        return (
                          <TableRow key={e.id}>
                            <TableCell className="font-medium">{u?.nombre || "—"}</TableCell>
                            <TableCell><Badge variant="outline">{u?.tier || "general"}</Badge></TableCell>
                            <TableCell className="text-xs">{e.granted_by === "admin_manual" ? "Manual" : "Crypto"}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={pct} className="h-2 w-20" />
                                <span className="text-xs">{pct}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeEnrollment(e.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin inscripciones</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </TabsContent>

      {/* ===== STATS TAB ===== */}
      <TabsContent value="stats" className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{courses.filter(c => c.status === "published").length}</p>
                <p className="text-sm text-muted-foreground">Cursos Publicados</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{new Set(enrollments.map(e => e.partner_user_id)).size}</p>
                <p className="text-sm text-muted-foreground">Estudiantes Activos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Award className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{lessons.length}</p>
                <p className="text-sm text-muted-foreground">Total Lecciones</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {courses.filter(c => c.status === "published").map(course => {
          const pct = getCourseProgress(course.id);
          const courseEnrolls = enrollments.filter(e => e.course_id === course.id);
          return (
            <Card key={course.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{course.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Progreso general:</span>
                  <Progress value={pct} className="h-2 flex-1" />
                  <span className="text-sm font-medium">{pct}%</span>
                </div>
                {courseEnrolls.map(e => {
                  const u = users.find(u => u.id === e.partner_user_id);
                  const userPct = getUserCourseProgress(e.partner_user_id, course.id);
                  return (
                    <div key={e.id} className="flex items-center gap-3 text-sm">
                      <span className="w-32 truncate">{u?.nombre || "—"}</span>
                      <Progress value={userPct} className="h-1.5 flex-1" />
                      <span className="w-10 text-right">{userPct}%</span>
                      {userPct === 100 && <Award className="w-4 h-4 text-yellow-500" />}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </TabsContent>

      {/* ===== DIALOGS ===== */}

      {/* Course Dialog */}
      <Dialog open={courseDialog} onOpenChange={setCourseDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editCourse.id ? "Editar Curso" : "Nuevo Curso"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input value={editCourse.title || ""} onChange={e => setEditCourse(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={editCourse.description || ""} onChange={e => setEditCourse(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div>
              <Label>Categoría</Label>
              <Select
                value={editCourse.category_id || "__none__"}
                onValueChange={v => setEditCourse(p => ({ ...p, category_id: v === "__none__" ? null : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Sin categoría (General)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">General (sin categoría)</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categories.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Crea categorías desde el botón "Categorías" en la lista de cursos.
                </p>
              )}
            </div>
            {commerceEnabled ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Precio USD</Label>
                  <Input type="number" value={editCourse.price_usd || 0} onChange={e => setEditCourse(p => ({ ...p, price_usd: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={editCourse.is_free || false} onCheckedChange={v => setEditCourse(p => ({ ...p, is_free: v }))} />
                  <Label>Gratuito</Label>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground rounded-md border border-border bg-muted/40 p-2">
                Este portal no tiene {brandText(isWhiteLabel, "Bullfy eCommerce")} activo, así que tus cursos se publican <strong>gratis</strong> para tus usuarios. Para cobrar, pide activar el eCommerce.
              </p>
            )}
            <div>
              <Label>Acceso por nivel de membresía</Label>
              <p className="text-xs text-muted-foreground mb-1.5">Sin selección = visible para todos los niveles. Si eliges niveles, solo esos usuarios podrán acceder.</p>
              <div className="flex gap-2 flex-wrap">
                {activeTiers.map(t => {
                  const selected = (editCourse.required_tiers || []).includes(t.slug);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setEditCourse(p => {
                        const cur = p.required_tiers || [];
                        return { ...p, required_tiers: selected ? cur.filter(x => x !== t.slug) : [...cur, t.slug] };
                      })}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                        selected ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Portada</Label>
              <div className="flex items-center gap-2 mt-1">
                {editCourse.thumbnail_path && (
                  <img src={getThumbUrl(editCourse.thumbnail_path)!} alt="" className="w-16 h-10 object-cover rounded" />
                )}
                <Button variant="outline" size="sm" disabled={uploadingThumb} onClick={() => document.getElementById("thumb-input")?.click()} className="gap-1">
                  <Upload className="w-3 h-3" /> {uploadingThumb ? "Subiendo..." : (editCourse.thumbnail_path ? "Reemplazar imagen" : "Subir imagen")}
                </Button>
                <input id="thumb-input" type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleThumbnailUpload(e.target.files[0])} />
              </div>
              {/* Sin portada el curso aparece en el catálogo con un placeholder
                  (ícono de libro). Recomendamos subir una imagen 16:9 para que
                  la card se vea bien. */}
              {!editCourse.thumbnail_path && (
                <p className="text-[11px] text-amber-500 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  Sin portada el curso se muestra con un ícono genérico. Se recomienda subir una imagen 16:9.
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            {commerceEnabled && editCourse.id && !editCourse.is_free && (Number(editCourse.price_usd) || 0) > 0 && (
              <Button
                variant="outline"
                className="gap-1.5 mr-auto"
                title="Distribución de red personalizada para este curso (dentro del pool)"
                onClick={async () => {
                  const { data } = await supabase
                    .from("portal_products")
                    .select("id")
                    .eq("portal_id", portalId)
                    .eq("product_type", "course")
                    .eq("reference_id", editCourse.id!)
                    .eq("status", "active")
                    .maybeSingle();
                  if (!(data as any)?.id) {
                    toast.error("Guarda el curso como de pago primero (se crea su producto vendible).");
                    return;
                  }
                  setOverrideTarget({ productId: (data as any).id, title: editCourse.title || "Curso", price: Number(editCourse.price_usd) || 0 });
                }}
              >
                <Network className="w-4 h-4" /> Distribución de red
              </Button>
            )}
            <Button variant="outline" onClick={() => setCourseDialog(false)}>Cancelar</Button>
            <Button onClick={saveCourse} style={{ backgroundColor: btnBg }}>{editCourse.id ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override de distribución de red por producto (curso) */}
      {overrideTarget && (
        <ProductCommissionLevelsDialog
          open={!!overrideTarget}
          onOpenChange={(v) => { if (!v) setOverrideTarget(null); }}
          productId={overrideTarget.productId}
          portalId={portalId}
          productTitle={overrideTarget.title}
          productPrice={overrideTarget.price}
        />
      )}

      {/* Module Dialog */}
      <Dialog open={moduleDialog} onOpenChange={setModuleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editModule.id ? "Editar Módulo" : "Nuevo Módulo"}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Título del Módulo</Label>
            <Input value={editModule.title || ""} onChange={e => setEditModule(p => ({ ...p, title: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModuleDialog(false)}>Cancelar</Button>
            <Button onClick={saveModule} style={{ backgroundColor: btnBg }}>{editModule.id ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson Dialog */}
      <Dialog open={lessonDialog} onOpenChange={setLessonDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editLesson.id ? "Editar Lección" : "Nueva Lección"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input value={editLesson.title || ""} onChange={e => setEditLesson(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={editLesson.description || ""} onChange={e => setEditLesson(p => ({ ...p, description: e.target.value }))} />
            </div>

            {/* Tipo de lección: video o documento */}
            <div>
              <Label>Tipo de lección</Label>
              <div className="flex gap-2 mt-1">
                {([
                  { key: "video", label: "Video", Icon: Video },
                  { key: "document", label: "Documento", Icon: BookOpen },
                ] as const).map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEditLesson(p => ({ ...p, lesson_type: key }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                      (editLesson.lesson_type || "video") === key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
              {(editLesson.lesson_type || "video") === "document" && (
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  El contenido principal será un documento. Súbelo en "Archivos" más abajo (el primero queda como documento principal).
                </p>
              )}
            </div>
            <div>
              <Label>Miniatura</Label>
              <div className="flex items-center gap-2 mt-1">
                {editLesson.thumbnail_path && (
                  <img src={getThumbUrl(editLesson.thumbnail_path)!} alt="" className="w-16 h-10 object-cover rounded" />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploadingLessonThumb}
                  onClick={() => document.getElementById("lesson-thumb-input")?.click()}
                  className="gap-1"
                >
                  <Upload className="w-3 h-3" />
                  {uploadingLessonThumb
                    ? "Subiendo..."
                    : (editLesson.thumbnail_path ? "Reemplazar miniatura" : "Subir miniatura")}
                </Button>
                <input
                  id="lesson-thumb-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleLessonThumbnailUpload(e.target.files[0])}
                />
              </div>
              {!editLesson.thumbnail_path && (
                <p className="text-[11px] text-amber-500 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  Sin miniatura, esta lección se lista solo con su título. Se recomienda subir una imagen 16:9.
                </p>
              )}
            </div>
            {(editLesson.lesson_type || "video") === "video" && (
            <div>
              <Label>Video</Label>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {/* Estado actual del video */}
                {editLesson.mux_status === "ready" && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500" /> Video listo
                  </Badge>
                )}
                {editLesson.mux_status === "preparing" && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Procesando video
                  </Badge>
                )}
                {editLesson.mux_status === "errored" && (
                  <Badge variant="destructive" className="text-xs gap-1" title={editLesson.mux_error_message || ""}>
                    <AlertCircle className="w-3 h-3" /> Error
                  </Badge>
                )}
                {!editLesson.mux_status && editLesson.video_path && (
                  <Badge variant="outline" className="text-xs">Video legacy</Badge>
                )}

                {/* Botón deshabilitado mientras se sube. También mientras
                    el video está en estado 'preparing' para evitar que el
                    admin reemplace antes de terminar el procesamiento (el
                    nuevo upload pisaría el asset id y rompería el webhook). */}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploadingVideo || editLesson.mux_status === "preparing"}
                  onClick={() => document.getElementById("video-input")?.click()}
                  className="gap-1"
                >
                  <Upload className="w-3 h-3" />
                  {uploadingVideo
                    ? `Subiendo ${uploadProgress}%`
                    : editLesson.mux_status === "preparing"
                      ? "Procesando…"
                      : editLesson.mux_status === "ready" || editLesson.video_path
                        ? "Reemplazar video"
                        : "Subir video"}
                </Button>
                <input
                  id="video-input"
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleVideoUpload(e.target.files[0])}
                />
              </div>
              {uploadingVideo && (
                <div className="mt-2">
                  <Progress value={uploadProgress} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Subiendo el video. Por favor no cierre esta pestaña hasta que termine la carga
                    (de lo contrario el proceso se interrumpe).
                  </p>
                </div>
              )}
              {editLesson.mux_status === "preparing" && !uploadingVideo && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Estamos optimizando el video para que sus alumnos lo reproduzcan rápido y con
                  la mejor calidad. Esto puede tardar de 1 a 5 minutos. Por favor no cierre esta
                  pestaña; el estado se actualizará automáticamente cuando termine.
                </p>
              )}
              {editLesson.mux_status === "errored" && editLesson.mux_error_message && (
                <p className="text-[10px] text-destructive mt-1">
                  No se pudo procesar el video: {editLesson.mux_error_message}
                </p>
              )}
            </div>
            )}
            {editLesson.duration_seconds && editLesson.duration_seconds > 0 && (editLesson.lesson_type || "video") === "video" && (
              <p className="text-xs text-muted-foreground">Duración: {formatDuration(editLesson.duration_seconds)}</p>
            )}

            {/* Archivos / recursos adjuntos */}
            <div>
              <Label className="flex items-center gap-1.5">
                {(editLesson.lesson_type || "video") === "document" ? "Documento(s)" : "Archivos / recursos (opcional)"}
              </Label>
              {!editLesson.id ? (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Guarda la lección primero para poder adjuntar archivos.
                </p>
              ) : (
                <div className="mt-1 space-y-2">
                  {attachments.length > 0 && (
                    <div className="space-y-1.5">
                      {attachments.map(att => (
                        <div key={att.id} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{att.file_name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {att.is_primary ? "Documento principal · " : ""}{formatBytes(att.size_bytes)}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => previewAttachment(att)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteAttachment(att)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploadingAttachment}
                    onClick={() => document.getElementById("attachment-input")?.click()}
                    className="gap-1"
                  >
                    {uploadingAttachment ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {uploadingAttachment ? "Subiendo..." : "Agregar archivo"}
                  </Button>
                  <input
                    id="attachment-input"
                    type="file"
                    className="hidden"
                    onChange={e => { if (e.target.files?.[0]) handleAttachmentUpload(e.target.files[0]); (e.target as HTMLInputElement).value = ""; }}
                  />
                  <p className="text-[10px] text-muted-foreground">PDF, Word, Excel, ZIP, etc. · Máx 50MB por archivo</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={uploadingVideo} onClick={() => setLessonDialog(false)}>
              Cancelar
            </Button>
            {/* Guardar bloqueado mientras se sube el video Y mientras se procesa.
                Solo habilitado cuando no hay un upload/procesamiento en curso —
                eso significa: o la lección no tiene video aún, o el video ya
                está listo. */}
            <Button
              onClick={saveLesson}
              disabled={uploadingVideo || editLesson.mux_status === "preparing"}
              style={{ backgroundColor: btnBg }}
            >
              {editLesson.id ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enroll Dialog */}
      <Dialog open={enrollDialog} onOpenChange={setEnrollDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inscribir Usuario</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Usuario</Label>
            <Select value={enrollUserId} onValueChange={setEnrollUserId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar usuario" /></SelectTrigger>
              <SelectContent>
                {users.filter(u => !enrollments.some(e => e.course_id === enrollCourseId && e.partner_user_id === u.id)).map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.nombre} ({u.email})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollDialog(false)}>Cancelar</Button>
            <Button onClick={saveEnrollment}>Inscribir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editCategory.id ? "Editar Categoría" : "Nueva Categoría"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input
                value={editCategory.name || ""}
                onChange={e => setEditCategory(p => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Trading, Marketing, Análisis Técnico"
              />
            </div>
            <div>
              <Label>Orden</Label>
              <Input
                type="number"
                value={editCategory.display_order ?? 0}
                onChange={e => setEditCategory(p => ({ ...p, display_order: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialog(false)}>Cancelar</Button>
            <Button onClick={saveCategory} style={{ backgroundColor: btnBg }}>{editCategory.id ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Lesson Dialog — admin reproduce el video antes de publicar */}
      <Dialog open={!!previewLesson} onOpenChange={(open) => !open && setPreviewLesson(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewLesson?.title || "Previsualización"}</DialogTitle>
          </DialogHeader>
          <div className="bg-black rounded-lg overflow-hidden aspect-video">
            {previewLoading ? (
              <div className="w-full h-full flex items-center justify-center text-white/70 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Preparando video…</span>
              </div>
            ) : previewError ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-red-400 gap-2 px-4 text-center">
                <AlertCircle className="w-8 h-8" />
                <span className="text-sm">{previewError}</span>
              </div>
            ) : previewLesson?.mux_playback_id && previewToken ? (
              <MuxPlayer
                playbackId={previewLesson.mux_playback_id}
                tokens={{ playback: previewToken }}
                metadata={{
                  video_id: previewLesson.id,
                  video_title: `[ADMIN PREVIEW] ${previewLesson.title}`,
                  // viewer_user_id no se setea: es preview admin, no cuenta como view
                  // legítimo en las analytics de Mux Data.
                }}
                envKey={import.meta.env.VITE_MUX_ENV_KEY}
                accentColor={branding.primary_color || "#00E5FF"}
                poster={getThumbUrl(previewLesson.thumbnail_path) || undefined}
                playsInline
                minResolution="1080p"
                style={{ width: "100%", height: "100%" }}
              />
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewLesson(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
};

export default AcademyAdmin;
