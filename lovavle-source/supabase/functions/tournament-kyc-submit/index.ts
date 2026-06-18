// Recibe documentos KYC del usuario (base64), los sube al bucket privado y registra en BD.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireTournamentUser } from "../_shared/tournament-helpers.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface DocIn { doc_type: string; filename: string; content_base64: string; mime: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(SUPABASE_URL, SVC);
    const { user, error: authErr } = await requireTournamentUser(req, supa);
    if (!user) return err(authErr || "No autenticado");

    const { documents } = await req.json() as { documents: DocIn[] };
    if (!Array.isArray(documents) || !documents.length) return err("documents requerido");
    const valid = ["id_front", "id_back", "selfie", "address_proof"];
    const inserted: any[] = [];

    for (const d of documents) {
      if (!valid.includes(d.doc_type)) return err(`doc_type inválido: ${d.doc_type}`);
      if (!d.content_base64) return err("contenido faltante");
      const bytes = Uint8Array.from(atob(d.content_base64), (c) => c.charCodeAt(0));
      if (bytes.length > 8 * 1024 * 1024) return err(`${d.doc_type} excede 8MB`);
      const ext = (d.filename.split(".").pop() || "bin").toLowerCase();
      const path = `${user.id}/${d.doc_type}-${Date.now()}.${ext}`;
      const up = await supa.storage.from("tournament-kyc").upload(path, bytes, {
        contentType: d.mime || "application/octet-stream", upsert: true,
      });
      if (up.error) return err(up.error.message);
      const { data: row, error: rowErr } = await supa.from("tournament_kyc_documents").insert({
        user_id: user.id, doc_type: d.doc_type, file_url: path, status: "pending",
      }).select().single();
      if (rowErr) return err(rowErr.message);
      inserted.push(row);
    }

    await supa.from("tournament_users").update({
      kyc_status: "pending", kyc_submitted_at: new Date().toISOString(),
    }).eq("id", user.id);

    return ok({ inserted });
  } catch (e) {
    return err((e as Error).message);
  }
});
