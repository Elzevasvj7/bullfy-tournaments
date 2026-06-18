// Entrega un signed URL temporal para descargar/ver un adjunto de Academy que
// vive en el bucket PRIVADO academy-attachments.
//
// Dos contextos (mismo modelo que academy-mux-signed-token):
//
//   (A) CLIENTE — partner_user accede a un adjunto desde Academy.
//       Body: { attachment_id, partner_user_id }
//       Validación: partner_user approved + mismo portal + curso publicado +
//                   (curso free O enrollment activo).
//
//   (B) ADMIN — preview desde el panel admin.
//       Body: { attachment_id, preview: true } + Authorization: Bearer <jwt>
//       Auth: admin role O owner del portal.
//
// El signed URL lo genera service_role (createSignedUrl), por eso el bucket
// puede ser privado y el contenido de cursos pagados no se filtra por URL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err } from "../_shared/mux-helpers.js";

const URL_TTL_SECONDS = 3600; // 1 hora
const BUCKET = "academy-attachments";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { attachment_id, partner_user_id, preview } = await req.json();
    if (!attachment_id) return err("attachment_id requerido");

    // Resolver attachment → lesson → module → course.
    const { data: att } = await supa
      .from("academy_lesson_attachments")
      .select("id, file_path, file_name, lesson_id")
      .eq("id", attachment_id)
      .maybeSingle();
    if (!att) return err("Archivo no encontrado", {}, 404);

    const { data: lesson } = await supa
      .from("academy_lessons").select("id, module_id").eq("id", att.lesson_id).maybeSingle();
    if (!lesson) return err("Lección no encontrada", {}, 404);

    const { data: mod } = await supa
      .from("academy_modules").select("id, course_id").eq("id", lesson.module_id).maybeSingle();
    if (!mod) return err("Módulo no encontrado", {}, 404);

    const { data: course } = await supa
      .from("academy_courses").select("id, portal_id, is_free, status, required_tiers").eq("id", mod.course_id).maybeSingle();
    if (!course) return err("Curso no encontrado", {}, 404);

    // ===== Contexto B: ADMIN PREVIEW =====
    if (preview) {
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (!token) return err("Sin token de admin", {}, 401);
      const { data: { user: authUser } } = await supa.auth.getUser(token);
      if (!authUser) return err("Admin no autenticado", {}, 401);

      const allowed =
        (await isUserAdmin(supa, authUser.id)) ||
        (await isUserPortalOwner(supa, authUser.id, authUser.email ?? null, course.portal_id));
      if (!allowed) return err("Sin permisos sobre este portal", {}, 403);

      return await signAndReturn(supa, att);
    }

    // ===== Contexto A: CLIENTE (partner_user) =====
    if (!partner_user_id) return err("partner_user_id requerido (o preview=true)");

    const { data: pu } = await supa
      .from("partner_users")
      .select("id, portal_id, status, tier")
      .eq("id", partner_user_id)
      .maybeSingle();
    if (!pu) return err("Usuario no encontrado", {}, 404);
    if (pu.status !== "approved") return err("Usuario sin acceso activo", {}, 403);
    if (course.status !== "published") return err("Curso no publicado", {}, 403);
    if (pu.portal_id !== course.portal_id) return err("Curso no disponible para tu portal", {}, 403);

    if (course.required_tiers && course.required_tiers.length > 0 &&
        !course.required_tiers.includes(pu.tier)) {
      return err("Tu nivel de membresía no tiene acceso a este curso", {}, 403);
    }

    if (!course.is_free) {
      const { data: enroll } = await supa
        .from("academy_enrollments")
        .select("id")
        .eq("course_id", course.id)
        .eq("partner_user_id", partner_user_id)
        .maybeSingle();
      if (!enroll) return err("Sin inscripción a este curso", {}, 403);
    }

    return await signAndReturn(supa, att);
  } catch (e) {
    console.error("academy-file-url error", e);
    return err((e as Error).message || "Error interno");
  }
});

async function signAndReturn(supa: any, att: { file_path: string; file_name: string }) {
  const { data, error } = await supa
    .storage
    .from(BUCKET)
    .createSignedUrl(att.file_path, URL_TTL_SECONDS, { download: att.file_name });
  if (error || !data?.signedUrl) {
    console.error("createSignedUrl failed", error);
    return err("No se pudo generar el enlace", {}, 500);
  }
  return ok({ url: data.signedUrl, file_name: att.file_name, expires_in: URL_TTL_SECONDS });
}

// ============================================================================
// Authorization helpers (replicados de academy-mux-signed-token)
// ============================================================================
async function isUserAdmin(supa: any, userId: string): Promise<boolean> {
  const { data } = await supa
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "global_admin"])
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function isUserPortalOwner(
  supa: any,
  userId: string,
  userEmail: string | null,
  portalId: string,
): Promise<boolean> {
  const { data: portal } = await supa
    .from("partner_portals").select("ib_id").eq("id", portalId).maybeSingle();
  if (!portal?.ib_id) return false;

  const { data: ib } = await supa
    .from("ibs").select("id, created_by, correo_ib").eq("id", portal.ib_id).maybeSingle();
  if (!ib) return false;

  if (ib.created_by === userId) return true;
  const ibEmail = (ib.correo_ib || "").trim().toLowerCase();
  const userEmailNorm = (userEmail || "").trim().toLowerCase();
  if (ibEmail && userEmailNorm && ibEmail === userEmailNorm) return true;
  return false;
}
