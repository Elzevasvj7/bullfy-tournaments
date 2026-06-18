// Genera un JWT RS256 firmado para reproducir un video de Mux con playback
// policy "signed". El token se pasa como `?token=<jwt>` al URL HLS.
//
// Dos contextos soportados:
//
//   (A) CLIENTE — partner_user accede a la lección desde Academy.
//       Body: { lesson_id, partner_user_id }
//       Validación:
//         1) partner_user existe y status='approved'.
//         2) pertenece al mismo portal que el curso.
//         3) acceso al curso (free o enrollment activo).
//
//   (B) ADMIN — admin/portal-owner previsualiza la lección desde el panel
//       admin antes de publicar el curso.
//       Body: { lesson_id, preview: true }  (sin partner_user_id)
//       Auth: JWT en Authorization header → auth.users.
//       Validación: mismo modelo que academy-mux-create-upload
//         (admin role O owner del portal por created_by O por correo_ib).
//
// El modelo del partner_user NO tiene tokens server-side (sessionStorage trust).
// Mitigantes intrínsecos del approach Mux: JWT scoped a 1 playback_id, expiry 1h,
// auditable en Mux Data dashboard.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, generateMuxJwt } from "../_shared/mux-helpers.js";

const TOKEN_TTL_SECONDS = 3600; // 1 hora

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { lesson_id, partner_user_id, preview } = body;
    if (!lesson_id) return err("lesson_id requerido");

    // Resolver lesson → course (compartido entre ambos contextos).
    const { data: lesson } = await supa
      .from("academy_lessons")
      .select("id, mux_playback_id, mux_status, module_id")
      .eq("id", lesson_id)
      .maybeSingle();
    if (!lesson) return err("Lección no encontrada", {}, 404);
    if (lesson.mux_status !== "ready" || !lesson.mux_playback_id) {
      return err("Video aún no disponible", { status: lesson.mux_status }, 425);
    }

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

      // Admin puede previsualizar incluso si el curso es 'draft' — está revisando.
      const playbackToken = await generateMuxJwt(lesson.mux_playback_id, TOKEN_TTL_SECONDS, "v");
      return ok({
        playback_id: lesson.mux_playback_id,
        token: playbackToken,
        expires_in: TOKEN_TTL_SECONDS,
      });
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

    if (pu.portal_id !== course.portal_id) {
      return err("Curso no disponible para tu portal", {}, 403);
    }

    // Gate por tier (membresía): si el curso lo restringe, el tier del usuario
    // debe estar incluido.
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

    const playbackToken = await generateMuxJwt(lesson.mux_playback_id, TOKEN_TTL_SECONDS, "v");
    return ok({
      playback_id: lesson.mux_playback_id,
      token: playbackToken,
      expires_in: TOKEN_TTL_SECONDS,
    });
  } catch (e) {
    console.error("academy-mux-signed-token error", e);
    return err((e as Error).message || "Error interno");
  }
});


// ============================================================================
// Authorization helpers (replicados de academy-mux-create-upload — mantener
// sincronizados; si el modelo cambia hay que actualizar ambos)
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
