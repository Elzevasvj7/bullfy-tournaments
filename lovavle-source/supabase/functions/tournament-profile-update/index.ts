import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { cors, ok, err, requireTournamentUser } from "../_shared/tournament-helpers.js";

const AVATAR_BUCKET = "tournament-avatars-3d";

/** Decode a data:...;base64,XXXX payload into a Uint8Array. */
function decodeBase64DataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/i);
  if (!m) return null;
  const contentType = m[1] || "application/octet-stream";
  const b64 = m[2];
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, contentType };
  } catch {
    return null;
  }
}

/**
 * If the avatar payload is a base64 data URL (can be multiple MB), upload it to
 * Storage and return the public URL. Otherwise return the value unchanged.
 * Storing megabyte blobs in the row was triggering statement timeouts under load.
 */
async function persistAvatarBlob(supa: any, userId: string, value: string): Promise<string> {
  if (!/^data:(model\/gltf-binary|application\/octet-stream);base64,/i.test(value)) return value;
  const decoded = decodeBase64DataUrl(value);
  if (!decoded) throw new Error("avatar_3d_url base64 inválido");
  const path = `${userId}/${Date.now()}.glb`;
  const { error: upErr } = await supa.storage.from(AVATAR_BUCKET).upload(path, decoded.bytes, {
    contentType: "model/gltf-binary",
    upsert: true,
  });
  if (upErr) throw new Error(`upload avatar: ${upErr.message}`);
  const { data: pub } = supa.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  if (!pub?.publicUrl) throw new Error("No se pudo obtener publicUrl del avatar");
  return pub.publicUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return err("Método no permitido");
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { user, error } = await requireTournamentUser(req, supa);
    if (!user) return err(error || "Sin autenticación");

    const body = await req.json().catch(() => ({}));
    const updates: Record<string, any> = {};

    if (typeof body.bio === "string") {
      if (body.bio.length > 280) return err("Bio máx. 280 caracteres");
      updates.bio = body.bio;
    }
    if (typeof body.public_profile === "boolean") {
      updates.public_profile = body.public_profile;
    }
    if (typeof body.username === "string") {
      const u = body.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (u.length < 3 || u.length > 24) return err("Username 3-24 caracteres alfanuméricos");
      const { data: exists } = await supa.from("tournament_users")
        .select("id").ilike("username", u).neq("id", user.id).maybeSingle();
      if (exists) return err("Username ya está en uso");
      updates.username = u;
    }
    if (typeof body.avatar_url === "string") {
      updates.avatar_url = body.avatar_url || null;
    }
    if (body.avatar_config !== undefined) {
      if (body.avatar_config === null) {
        updates.avatar_config = null;
      } else if (typeof body.avatar_config === "object") {
        const cfg = body.avatar_config as Record<string, unknown>;
        const serialized = JSON.stringify(cfg);
        if (serialized.length > 4000) return err("Configuración de avatar demasiado grande");
        updates.avatar_config = cfg;
      } else {
        return err("avatar_config inválido");
      }
    }
    if (body.avatar_3d_url !== undefined) {
      const raw = typeof body.avatar_3d_url === "string"
        ? body.avatar_3d_url.trim().replace(/\s/g, "")
        : body.avatar_3d_url;
      if (raw === null || raw === "") {
        updates.avatar_3d_url = null;
      } else if (typeof raw === "string" && /^(https?:\/\/|data:(model\/gltf-binary|application\/octet-stream);base64,)/i.test(raw)) {
        // Offload base64 GLB blobs (often several MB) to Storage to avoid
        // bloating the row and timing out the UPDATE under heavy concurrency.
        try {
          updates.avatar_3d_url = await persistAvatarBlob(supa, user.id, raw);
        } catch (e) {
          return err((e as Error).message || "No se pudo guardar el avatar 3D");
        }
      } else {
        return err("avatar_3d_url inválido");
      }
    }
    if (typeof body.country === "string") {
      updates.country = body.country.slice(0, 80);
    }

    if (Object.keys(updates).length === 0) return err("Sin cambios");

    // Only return lightweight identity fields — never echo the full row (which
    // can include large legacy data URLs) and avoid extra scan cost.
    const { data, error: upErr } = await supa.from("tournament_users")
      .update(updates).eq("id", user.id)
      .select("id, username, full_name, email, country, bio, public_profile, avatar_url, avatar_config, avatar_3d_url, bullfy_points, daily_streak, kyc_status, banned_at")
      .maybeSingle();
    if (upErr) return err(upErr.message);

    return ok({ user: data });
  } catch (e) {
    return err((e as Error).message || "Error");
  }
});
