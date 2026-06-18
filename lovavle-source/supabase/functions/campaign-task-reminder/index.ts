import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const admin = createClient(supabaseUrl, serviceKey);

    // Get all active campaigns
    const { data: campaigns } = await admin
      .from("marketing_campaigns")
      .select("id, name, start_date, end_date")
      .eq("status", "active");

    if (!campaigns || campaigns.length === 0) {
      return new Response(JSON.stringify({ message: "No active campaigns", reminded: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalReminded = 0;

    for (const campaign of campaigns) {
      const startDate = new Date(campaign.start_date);
      const today = new Date();
      // Calculate current day number (1-based)
      const diffMs = today.getTime() - startDate.getTime();
      const currentDay = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

      if (currentDay < 1) continue; // Campaign hasn't started yet

      // Get tasks for today (and past days that might still be pending)
      const { data: tasks } = await admin
        .from("campaign_tasks")
        .select("id, title, day_number, instruction")
        .eq("campaign_id", campaign.id)
        .lte("day_number", currentDay)
        .order("day_number");

      if (!tasks || tasks.length === 0) continue;

      // Get all assignments for this campaign
      const { data: assignments } = await admin
        .from("campaign_ib_assignments")
        .select("id, ib_id")
        .eq("campaign_id", campaign.id);

      if (!assignments || assignments.length === 0) continue;

      // Get all completions for these assignments
      const assignmentIds = assignments.map((a) => a.id);
      const { data: completions } = await admin
        .from("campaign_task_completions")
        .select("task_id, assignment_id")
        .in("assignment_id", assignmentIds);

      const completionSet = new Set(
        (completions ?? []).map((c) => `${c.assignment_id}_${c.task_id}`)
      );

      // Get today's tasks specifically for the reminder
      const todayTasks = tasks.filter((t) => t.day_number === currentDay);
      // Also include overdue tasks from previous days
      const overdueTasks = tasks.filter((t) => t.day_number < currentDay);

      // For each assignment, check if they have pending tasks
      for (const assignment of assignments) {
        const pendingToday = todayTasks.filter(
          (t) => !completionSet.has(`${assignment.id}_${t.id}`)
        );
        const pendingOverdue = overdueTasks.filter(
          (t) => !completionSet.has(`${assignment.id}_${t.id}`)
        );

        const allPending = [...pendingToday, ...pendingOverdue];
        if (allPending.length === 0) continue; // All tasks done, skip

        // Get profile for this IB
        const { data: profiles } = await admin
          .from("profiles")
          .select("id, correo, nombre")
          .eq("ib_id", assignment.ib_id);

        if (!profiles || profiles.length === 0) continue;

        const todayCount = pendingToday.length;
        const overdueCount = pendingOverdue.length;

        let notifTitle = `📋 Tareas pendientes: ${campaign.name}`;
        let notifParts: string[] = [];
        if (todayCount > 0) {
          notifParts.push(`${todayCount} tarea(s) para hoy`);
        }
        if (overdueCount > 0) {
          notifParts.push(`${overdueCount} tarea(s) atrasada(s)`);
        }
        const notifMessage = `Campaña "${campaign.name}": ${notifParts.join(" y ")}. Revisa tu portal para completarlas.`;

        const taskListHtml = allPending
          .map((t) => {
            const isOverdue = t.day_number < currentDay;
            const badge = isOverdue
              ? `<span style="color:#dc3545;font-weight:bold;">[Atrasada - Día ${t.day_number}]</span>`
              : `<span style="color:#0d6efd;font-weight:bold;">[Hoy - Día ${t.day_number}]</span>`;
            return `<li style="margin:8px 0;">${badge} ${t.title}</li>`;
          })
          .join("");

        const emailHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#062B63;padding:20px;text-align:center;"><h1 style="color:#83CBFF;margin:0;">Bullfy IB System</h1></div>
          <div style="padding:24px;background:#ffffff;">
            <h2 style="color:#062B63;">📋 Recordatorio de Tareas</h2>
            <p>Tienes tareas pendientes en la campaña <strong>${campaign.name}</strong>:</p>
            <ul style="padding-left:20px;">${taskListHtml}</ul>
            <a href="https://bullfyibsystem.lovable.app/ib-externo" style="display:inline-block;background:#146EF5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin-top:12px;">Completar Tareas</a>
          </div>
          <div style="background:#f5f5f5;padding:16px;text-align:center;color:#666;font-size:12px;">Bullfy IB System</div>
        </div>`;

        for (const profile of profiles) {
          // In-app notification
          await admin.from("notifications").insert({
            user_id: profile.id,
            type: "campaign_task_reminder",
            title: notifTitle,
            message: notifMessage,
          });
          totalReminded++;

          // Push notification
          try {
            await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                user_id: profile.id,
                title: notifTitle,
                message: notifMessage,
              }),
            });
          } catch (e) {
            console.error("Push failed for", profile.id, e);
          }

          // Email via Resend
          if (resendKey && profile.correo) {
            try {
              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${resendKey}`,
                },
                body: JSON.stringify({
                  from: "Bullfy IB System <noreply@bullfytech.online>",
                  to: [profile.correo],
                  subject: `📋 Recordatorio: ${campaign.name}`,
                  html: emailHtml,
                }),
              });
            } catch (e) {
              console.error("Email failed for", profile.correo, e);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ reminded: totalReminded }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
