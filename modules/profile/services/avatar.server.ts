import "server-only";

import crypto from "node:crypto";
import { getPostgresPool, queryOne } from "@/lib/db/postgres";
import {
  createTournamentStorageClient,
  getAvatarStorageBucket,
} from "@/lib/supabase/storage-supabase/tournament-storage.server";
import type { AvatarProfile } from "../types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AvatarExportUrlType = "httpURL" | "dataURL";

type AvatarProfileRow = {
  avatar_config: Record<string, unknown> | null;
  avatar_provider: string | null;
  avatar_storage_bucket: string | null;
  avatar_storage_path: string | null;
  avatar_3d_url: string | null;
  avaturn_avatar_id: string | null;
  avaturn_user_id: string | null;
  preferred_pose: string | null;
  avatar_updated_at: Date | null;
};

type AvaturnSessionResponse = {
  avaturn_user_id?: unknown;
  error?: unknown;
  ok?: unknown;
  url?: unknown;
};

export type AvatarExportInput = {
  avatarId?: unknown;
  bodyId?: unknown;
  gender?: unknown;
  rawPayload?: unknown;
  sessionId?: unknown;
  url: unknown;
  urlType?: unknown;
};

export async function getAvatarProfile(
  traderId: string,
): Promise<AvatarProfile> {
  const row = await queryOne<AvatarProfileRow>(
    `
      select
        avatar_config,
        avatar_provider,
        avatar_storage_bucket,
        avatar_storage_path,
        avatar_3d_url,
        avaturn_avatar_id,
        avaturn_user_id,
        preferred_pose,
        avatar_updated_at
      from demo_traders
      where id = $1
      limit 1
    `,
    [traderId],
  );

  return {
    avatarConfig: row?.avatar_config ?? {},
    avatarProvider: row?.avatar_provider ?? null,
    avatarStorageBucket: row?.avatar_storage_bucket ?? null,
    avatarStoragePath: row?.avatar_storage_path ?? null,
    avatarUrl: row?.avatar_3d_url ?? null,
    avaturnAvatarId: row?.avaturn_avatar_id ?? null,
    avaturnUserId: row?.avaturn_user_id ?? null,
    preferredPose: row?.preferred_pose ?? "idle",
    updatedAt: row?.avatar_updated_at?.toISOString() ?? null,
  };
}

export async function createAvaturnSession(traderId: string) {
  const profile = await getAvatarProfile(traderId);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.functions.invoke("avaturn-session", {
    body: {
      avaturn_avatar_id: profile.avaturnAvatarId,
      avaturn_user_id: profile.avaturnUserId,
    },
  });
 
  const payload = data as AvaturnSessionResponse;

  if (error || !data.ok) {
    const message =
      typeof payload.error === "string"
        ? payload.error
        : "No se pudo iniciar Avaturn.";
    throw new Error(message);
  }

  const sessionUrl = parseAvaturnSessionUrl(payload.url);
  const avaturnUserId =
    typeof payload.avaturn_user_id === "string"
      ? payload.avaturn_user_id.trim()
      : "";

  if (!avaturnUserId) {
    throw new Error("Avaturn no devolvio avaturn_user_id.");
  }

  await getPostgresPool().query(
    `
      update demo_traders
      set
        avaturn_user_id = $2,
        avatar_provider = 'avaturn',
        avatar_config = coalesce(avatar_config, '{}'::jsonb) || $3::jsonb,
        avatar_updated_at = now()
      where id = $1
    `,
    [
      traderId,
      avaturnUserId,
      JSON.stringify({
        avaturn_user_id: avaturnUserId,
        last_session_started_at: new Date().toISOString(),
      }),
    ],
  );

  await insertAvatarEvent({
    eventType: "session_created",
    payload: {
      has_existing_avatar: Boolean(profile.avaturnAvatarId),
      has_existing_user: Boolean(profile.avaturnUserId),
    },
    traderId,
    userId: avaturnUserId,
  });

  return {
    avaturnUserId,
    sessionUrl,
  };
}

export async function saveAvatarExport(
  traderId: string,
  input: AvatarExportInput,
) {
  const exportUrl = normalizeAvatarExportUrl(input.url);

  if (!exportUrl) {
    throw new Error("Avaturn no devolvio una URL de avatar valida.");
  }

  const currentProfile = await getAvatarProfile(traderId);
  const urlType = parseExportUrlType(input.urlType, exportUrl);
  const storedAvatar =
    urlType === "dataURL"
      ? await uploadAvatarDataUrlToStorage(traderId, exportUrl)
      : { bucket: null, path: null, publicUrl: exportUrl };
  const avatarId = readString(input.avatarId);
  const gender = readString(input.gender);
  const bodyId = readString(input.bodyId);
  const sessionId = readString(input.sessionId);

  const avatarConfig = {
    avaturn_avatar_id: avatarId || null,
    body_id: bodyId || null,
    gender: gender || null,
    last_export_session_id: sessionId || null,
    last_export_url_type: urlType,
  };

  const result = await getPostgresPool().query<AvatarProfileRow>(
    `
      update demo_traders
      set
        avatar_3d_url = $2,
        avatar_provider = 'avaturn',
        avaturn_avatar_id = coalesce($3, avaturn_avatar_id),
        avatar_config = coalesce(avatar_config, '{}'::jsonb) || $4::jsonb,
        avatar_storage_bucket = $5,
        avatar_storage_path = $6,
        avatar_updated_at = now()
      where id = $1
      returning
        avatar_config,
        avatar_provider,
        avatar_storage_bucket,
        avatar_storage_path,
        avatar_3d_url,
        avaturn_avatar_id,
        avaturn_user_id,
        preferred_pose,
        avatar_updated_at
    `,
    [
      traderId,
      storedAvatar.publicUrl,
      avatarId || null,
      JSON.stringify(avatarConfig),
      storedAvatar.bucket,
      storedAvatar.path,
    ],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("No se encontro el trader actual.");
  }

  await removePreviousAvatarObject(currentProfile, storedAvatar);

  await insertAvatarEvent({
    avatarId: avatarId || null,
    avatarUrl: storedAvatar.publicUrl,
    eventType: "export_saved",
    payload: {
      ...createSafeAvatarPayload(input.rawPayload),
      storageBucket: storedAvatar.bucket,
      storagePath: storedAvatar.path,
    },
    traderId,
    urlType,
    userId: row.avaturn_user_id,
  });

  return {
    avatarConfig: row.avatar_config ?? {},
    avatarProvider: row.avatar_provider,
    avatarStorageBucket: row.avatar_storage_bucket,
    avatarStoragePath: row.avatar_storage_path,
    avatarUrl: row.avatar_3d_url,
    avaturnAvatarId: row.avaturn_avatar_id,
    avaturnUserId: row.avaturn_user_id,
    preferredPose: row.preferred_pose ?? "idle",
    updatedAt: row.avatar_updated_at?.toISOString() ?? null,
  } satisfies AvatarProfile;
}

function parseAvaturnSessionUrl(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("Avaturn no devolvio URL de sesion.");
  }

  const url = value.trim();
  const parsed = new URL(url);

  if (parsed.protocol !== "https:") {
    throw new Error("La URL de sesion de Avaturn debe usar HTTPS.");
  }

  if (!parsed.searchParams.has("session_id")) {
    throw new Error("La URL de sesion de Avaturn no incluye session_id.");
  }

  return url;
}

function parseExportUrlType(
  value: unknown,
  exportUrl: string,
): AvatarExportUrlType {
  if (value === "httpURL" || value === "dataURL") {
    return value;
  }

  if (exportUrl.startsWith("data:")) {
    return "dataURL";
  }

  return "httpURL";
}

function normalizeAvatarExportUrl(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const clean = value.trim();

  if (/^https:\/\//i.test(clean)) {
    return clean;
  }

  if (isSupportedAvatarDataUrl(clean)) {
    return clean;
  }

  return "";
}

async function uploadAvatarDataUrlToStorage(traderId: string, dataUrl: string) {
  const { base64 } = parseAvatarDataUrl(dataUrl);
  const buffer = Buffer.from(base64, "base64");

  if (buffer.byteLength === 0) {
    throw new Error("El avatar GLB esta vacio.");
  }

  const safeTraderId = traderId.replace(/[^a-z0-9_-]/gi, "_");
  const bucket = getAvatarStorageBucket();
  const storagePath = `avatars/${safeTraderId}/${Date.now()}-${crypto.randomUUID()}.glb`;
  const supabase = createTournamentStorageClient();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, {
      contentType: "model/gltf-binary",
      upsert: false,
    });

  if (error) {
    throw new Error(
      `No se pudo subir avatar a Supabase Storage: ${error.message}`,
    );
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  if (!data.publicUrl) {
    throw new Error("Supabase Storage no devolvio URL publica del avatar.");
  }

  return {
    bucket,
    path: storagePath,
    publicUrl: data.publicUrl,
  };
}

function isSupportedAvatarDataUrl(value: string) {
  const commaIndex = value.indexOf(",");

  if (commaIndex <= 0) {
    return false;
  }

  const metadata = value.slice(0, commaIndex).toLowerCase();

  return (
    metadata === "data:model/gltf-binary;base64" ||
    metadata === "data:application/octet-stream;base64"
  );
}

function parseAvatarDataUrl(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(",");

  if (commaIndex <= 0) {
    throw new Error("El dataURL de Avaturn no tiene separador base64.");
  }

  if (!isSupportedAvatarDataUrl(dataUrl)) {
    throw new Error("El dataURL de Avaturn no tiene formato GLB valido.");
  }

  const base64 = dataUrl.slice(commaIndex + 1);

  if (!base64) {
    throw new Error("El dataURL de Avaturn no incluye contenido base64.");
  }

  return { base64 };
}

async function removePreviousAvatarObject(
  previous: AvatarProfile,
  next: {
    bucket: string | null;
    path: string | null;
  },
) {
  if (
    !previous.avatarStorageBucket ||
    !previous.avatarStoragePath ||
    previous.avatarStorageBucket !== next.bucket ||
    previous.avatarStoragePath === next.path
  ) {
    return;
  }

  const supabase = createTournamentStorageClient();
  await supabase.storage
    .from(previous.avatarStorageBucket)
    .remove([previous.avatarStoragePath]);
}

async function insertAvatarEvent({
  avatarId,
  avatarUrl,
  eventType,
  payload,
  traderId,
  urlType,
  userId,
}: {
  avatarId?: string | null;
  avatarUrl?: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  traderId: string;
  urlType?: string | null;
  userId?: string | null;
}) {
  await getPostgresPool().query(
    `
      insert into user_avatar_events (
        id,
        trader_id,
        provider,
        event_type,
        avaturn_user_id,
        avaturn_avatar_id,
        url_type,
        avatar_url,
        payload
      )
      values ($1, $2, 'avaturn', $3, $4, $5, $6, $7, $8::jsonb)
    `,
    [
      `avatar_event_${crypto.randomUUID()}`,
      traderId,
      eventType,
      userId ?? null,
      avatarId ?? null,
      urlType ?? null,
      avatarUrl ?? null,
      JSON.stringify(payload),
    ],
  );
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function createSafeAvatarPayload(value: unknown) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const payload = value as Record<string, unknown>;

  return {
    avatarId: readString(payload.avatarId),
    avatarSupportsFaceAnimations: payload.avatarSupportsFaceAnimations === true,
    bodyId: readString(payload.bodyId),
    gender: readString(payload.gender),
    sessionId: readString(payload.sessionId),
    urlType: readString(payload.urlType),
  };
}
