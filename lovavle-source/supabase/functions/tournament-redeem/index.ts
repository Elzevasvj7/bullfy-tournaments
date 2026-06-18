// Canjea Bullfy Points por un item del catálogo. Genera código único.
// PR #7 — C8: el flujo de canje pasa por la RPC tournament_redeem_atomic.
//             Esa RPC envuelve en una sola transacción: lock de fila del
//             catálogo (evita race en stock), lock de fila del usuario
//             (evita race en puntos), decrement de stock + puntos con
//             chequeos condicionales, e inserts del code + ledger entry.
//             Esto elimina las 3 race conditions previas:
//               1) Deducción de puntos partía de un valor cacheado al
//                  inicio del request → dos clicks paralelos podían
//                  canjear gratis.
//               2) Rollback escribía el valor inicial pisando cambios
//                  intermedios.
//               3) Stock decrement read-modify-write podía quedar negativo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireTournamentUser, genRedemptionCode } from "../_shared/tournament-helpers.js";

// Mapea códigos de excepción de la RPC a mensajes user-friendly.
const REDEEM_ERROR_MESSAGES: Record<string, string> = {
  item_not_found_or_inactive: "Item no disponible",
  out_of_stock: "Sin stock",
  user_not_found: "Usuario no encontrado",
  insufficient_points: "Bullfy Points insuficientes",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { user, error: authErr } = await requireTournamentUser(req, supa);
    if (!user) return err(authErr || "No autenticado");

    const { catalog_id } = await req.json();
    if (!catalog_id) return err("Item requerido");

    // Generar code + expiry acá (la RPC los recibe como parámetros).
    const code = genRedemptionCode();
    const expires_at = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error: rpcErr } = await supa.rpc("tournament_redeem_atomic", {
      p_user_id: user.id,
      p_catalog_id: catalog_id,
      p_code: code,
      p_expires_at: expires_at,
    });

    if (rpcErr) {
      // La RPC lanza RAISE EXCEPTION con un código simbólico; el mensaje
      // de Postgres viene en rpcErr.message. Mapear códigos conocidos a
      // mensajes user-friendly, fallback al mensaje crudo para debugging.
      const errCode = (rpcErr.message || "").split("\n")[0].trim();
      const friendly = REDEEM_ERROR_MESSAGES[errCode] || `Error en canje: ${rpcErr.message}`;
      return err(friendly);
    }

    if (!data || typeof data !== "object") {
      return err("Respuesta inesperada del canje");
    }

    return ok({
      code: (data as any).code,
      expires_at: (data as any).expires_at,
      item: (data as any).item,
    });
  } catch (e) {
    return err((e as Error).message);
  }
});
