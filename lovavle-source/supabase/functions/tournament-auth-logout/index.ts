import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return ok({ loggedOut: true });
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await supa.from("tournament_user_sessions").delete().eq("token", token);
    return ok({ loggedOut: true });
  } catch (e) {
    return err((e as Error).message);
  }
});
