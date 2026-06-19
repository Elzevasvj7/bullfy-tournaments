import "server-only";

import { createClient } from "@supabase/supabase-js";

export function createTournamentStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_BULLFY_STORAGE_SUPABASE_URL;
  const serviceRoleKey = process.env.NEXT_PULIC_BULLFY_STORAGE_SUPABASE_SERVICE_ROLE_KEY;
  console.log(supabaseUrl, serviceRoleKey);
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan BULLFY_STORAGE_SUPABASE_URL o BULLFY_STORAGE_SUPABASE_SERVICE_ROLE_KEY para subir avatares.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

export function getAvatarStorageBucket() {
  return process.env.NEXT_PUBLIC_BULLFY_AVATAR_STORAGE_BUCKET ?? "avatars";
}
