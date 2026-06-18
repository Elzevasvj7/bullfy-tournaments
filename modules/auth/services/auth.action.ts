"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loginDemoTrader } from "@/modules/demo/demo-auth.service";
import { clearDemoSession } from "@/modules/demo/demo-session";
import type { LoginInput } from "../types";
import { mapLoginRequest } from "./auth.mapper";

export type AuthActionResult = { ok: true } | { ok: false; error: string };

export async function loginTournamentUserAction(
  input: LoginInput,
): Promise<AuthActionResult> {
  const payload = mapLoginRequest(input);

  if (!payload.email || !payload.password) {
    return { ok: false, error: "Usuario/email y contrasena requeridos." };
  }

  try {
    const demoTrader = await loginDemoTrader(payload.email, payload.password);

    if (demoTrader) {
      revalidatePath("/", "layout");

      return { ok: true };
    }
  } catch {
    // Keep Supabase auth usable if the local demo DB is not available.
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword(payload);

    if (error) {
      return { ok: false, error: mapSupabaseAuthError(error.message) };
    }

    revalidatePath("/", "layout");

    return { ok: true };
  } catch (caught) {
    return {
      ok: false,
      error:
        caught instanceof Error
          ? caught.message
          : "No se pudo iniciar sesion.",
    };
  }
}

export async function logoutTournamentUserAction(): Promise<AuthActionResult> {
  try {
    await clearDemoSession();

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/", "layout");

    return { ok: true };
  } catch (caught) {
    return {
      ok: false,
      error:
        caught instanceof Error
          ? caught.message
          : "No se pudo cerrar la sesion.",
    };
  }
}

function mapSupabaseAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid credentials")
  ) {
    return "Email o contrasena incorrectos.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Confirma tu email antes de iniciar sesion.";
  }

  return message;
}
