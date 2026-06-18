import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: "No autorizado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ ok: false, error: "No autorizado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const ib_id = body.ib_id;
    const correo_ib = body.correo_ib?.trim().toLowerCase();
    const nombre_ib = body.nombre_ib?.trim();

    if (!ib_id || !correo_ib || !nombre_ib) {
      return new Response(JSON.stringify({ ok: false, error: "Faltan datos requeridos" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correo_ib)) {
      return new Response(JSON.stringify({ ok: false, error: "Formato de email inválido: " + correo_ib }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const userRoles = roles?.map((r: any) => r.role) ?? [];
    const isAdmin = userRoles.includes("admin") || userRoles.includes("global_admin");

    // Check if ib_id refers to an IB or a Sub IB
    let parentIbId = ib_id;
    let isSubIb = false;
    let subIbId: string | null = null;

    const { data: ibData } = await userClient
      .from("ibs")
      .select("created_by")
      .eq("id", ib_id)
      .single();

    if (!ibData) {
      // Try sub_ibs table
      const { data: subIbData } = await userClient
        .from("sub_ibs")
        .select("ib_id, id")
        .eq("id", ib_id)
        .single();

      if (subIbData) {
        isSubIb = true;
        parentIbId = subIbData.ib_id;
        subIbId = subIbData.id;
      }
    }

    if (!isAdmin) {
      // Check if user is the BD who created the IB or an IB Externo with access
      const creatorCheck = await userClient
        .from("ibs")
        .select("created_by")
        .eq("id", parentIbId)
        .single();

      const isCreator = creatorCheck.data?.created_by === user.id;
      const isIBExterno = userRoles.includes("ib_externo");

      if (!isCreator && !isIBExterno) {
        return new Response(JSON.stringify({ ok: false, error: "No tienes permisos para este IB" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const tempPassword = "Bullfy" + Math.random().toString(36).slice(2, 8) + "!";

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find existing user by email — paginate listUsers because default returns only first page (50 users)
    let existingUser: any = null;
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data: pageData, error: pageErr } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (pageErr) break;
      const users = pageData?.users ?? [];
      const found = users.find((u: any) => (u.email || "").toLowerCase() === correo_ib);
      if (found) { existingUser = found; break; }
      if (users.length < perPage) break;
      page++;
      if (page > 50) break; // safety cap (50k users)
    }

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      await adminClient.auth.admin.updateUserById(userId, {
        password: tempPassword,
      });
    } else {
      const { data: newUser, error: createError } =
        await adminClient.auth.admin.createUser({
          email: correo_ib,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { nombre: nombre_ib },
        });

      if (createError) {
        // Fallback: if Supabase says email exists but our paginated lookup missed it,
        // try a final scan via profiles table (which is keyed by auth user id)
        if ((createError as any).code === "email_exists" || /already been registered/i.test(createError.message)) {
          const { data: prof } = await adminClient
            .from("profiles")
            .select("id, email")
            .ilike("email", correo_ib)
            .maybeSingle();
          if (prof?.id) {
            userId = prof.id;
            await adminClient.auth.admin.updateUserById(userId, { password: tempPassword });
          } else {
            return new Response(JSON.stringify({ ok: false, error: "El correo ya está registrado en el sistema pero no se pudo localizar el usuario. Contacta a soporte." }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else {
          return new Response(JSON.stringify({ ok: false, error: createError.message }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        userId = newUser.user.id;
      }
    }

    // Remove auto-assigned bd role (from handle_new_user trigger) and set only ib_externo
    await adminClient
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .neq("role", "ib_externo");

    await adminClient
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "ib_externo" },
        { onConflict: "user_id,role" }
      );

    // Set pending status and link to the specific sub_ib if applicable
    const profileUpdate: any = {
      ib_id: parentIbId,
      must_change_password: true,
      status: "pending",
    };
    if (isSubIb && subIbId) {
      profileUpdate.sub_ib_id = subIbId;
    }

    await adminClient
      .from("profiles")
      .update(profileUpdate)
      .eq("id", userId);

    // Notify admins about new IB externo pending approval
    const { data: adminUsers } = await adminClient
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "global_admin"]);

    if (adminUsers) {
      for (const admin of adminUsers) {
        await adminClient.from("notifications").insert({
          user_id: admin.user_id,
          type: "ib_externo_pending",
          title: "IB Externo pendiente de aprobación",
          message: `El IB "${nombre_ib}" (${correo_ib}) fue invitado y requiere aprobación para acceder al portal.`,
          reference_id: ib_id,
          reference_type: "ib",
        });
      }
    }

    // Send invitation email
    const emailHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#062B63;padding:20px;text-align:center;">
        <h1 style="color:#83CBFF;margin:0;">Bullfy IB System</h1>
      </div>
      <div style="padding:24px;background:#ffffff;">
        <h2 style="color:#062B63;">🎉 Bienvenido al Portal IB de Bullfy</h2>
        <p>Hola <strong>${nombre_ib}</strong>,</p>
        <p>Has sido invitado al portal de Introducing Brokers de Bullfy. Un administrador revisará tu acceso y te notificaremos cuando esté aprobado.</p>
        <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:16px 0;">
          <p style="margin:0 0 8px 0;"><strong>Correo:</strong> ${correo_ib}</p>
          <p style="margin:0;"><strong>Contraseña temporal:</strong> ${tempPassword}</p>
        </div>
        <p style="color:#dc2626;font-size:14px;">⚠️ Al iniciar sesión se te pedirá cambiar la contraseña. Tu acceso estará activo una vez aprobado por un administrador.</p>
        <a href="https://bullfyibsystem.lovable.app/login" style="display:inline-block;background:#146EF5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin-top:12px;">Iniciar Sesión</a>
      </div>
      <div style="background:#f5f5f5;padding:16px;text-align:center;color:#666;font-size:12px;">Bullfy IB System</div>
    </div>`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        to: correo_ib,
        subject: "🎉 Invitación al Portal IB de Bullfy",
        html: emailHtml,
      }),
    });

    // Log invitation in audit_log (bitácora)
    await adminClient.from("audit_log").insert({
      table_name: isSubIb ? "sub_ibs" : "ibs",
      record_id: ib_id,
      action: "INVITE_PORTAL",
      old_data: null,
      new_data: { correo_ib, nombre_ib, invited_user_id: userId, is_sub_ib: isSubIb, parent_ib_id: parentIbId, sub_ib_id: subIbId },
      changed_fields: ["invite_portal"],
      user_id: user.id,
    });

    return new Response(
      JSON.stringify({ success: true, userId, tempPassword }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
