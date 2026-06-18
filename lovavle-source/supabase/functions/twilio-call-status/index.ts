import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Twilio sends form-urlencoded data
    const formData = await req.formData().catch(() => null);
    const url = new URL(req.url);
    const callRecordId = url.searchParams.get("call_record_id");
    const type = url.searchParams.get("type") || "status";

    if (!callRecordId) {
      console.error("No call_record_id provided");
      // Return TwiML to not break the call
      return new Response("<Response></Response>", {
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    if (type === "dial_complete" && formData) {
      // This is the Dial action callback - the lead portion ended
      const dialCallStatus = formData.get("DialCallStatus") as string;
      const dialCallDuration = formData.get("DialCallDuration") as string;
      const recordingUrl = formData.get("RecordingUrl") as string;
      const recordingSid = formData.get("RecordingSid") as string;

      console.log(`Dial complete for ${callRecordId}: status=${dialCallStatus}, duration=${dialCallDuration}`);

      const statusMap: Record<string, string> = {
        completed: "completed",
        "no-answer": "no_answer",
        busy: "busy",
        failed: "failed",
        canceled: "failed",
      };

      const updates: Record<string, unknown> = {
        status: statusMap[dialCallStatus] || "completed",
        ended_at: new Date().toISOString(),
      };

      if (dialCallDuration) {
        updates.duration_seconds = parseInt(dialCallDuration);
      }
      if (recordingUrl) {
        updates.recording_url = recordingUrl;
      }
      if (recordingSid) {
        updates.recording_sid = recordingSid;
      }

      await supabase.from("lead_calls").update(updates).eq("id", callRecordId);

      // Update agent status back to wrap_up
      const { data: callRecord } = await supabase
        .from("lead_calls")
        .select("agent_id, lead_id, duration_seconds")
        .eq("id", callRecordId)
        .single();

      if (callRecord) {
        await supabase
          .from("sales_agent_status")
          .update({
            status: "wrap_up",
            current_lead_id: null,
          })
          .eq("user_id", callRecord.agent_id);

        // Update daily counters
        const duration = parseInt(dialCallDuration || "0");
        const { data: agentStatus } = await supabase
          .from("sales_agent_status")
          .select("daily_calls, daily_duration_seconds")
          .eq("user_id", callRecord.agent_id)
          .single();

        if (agentStatus) {
          await supabase
            .from("sales_agent_status")
            .update({
              daily_calls: (agentStatus.daily_calls || 0) + 1,
              daily_duration_seconds: (agentStatus.daily_duration_seconds || 0) + duration,
            })
            .eq("user_id", callRecord.agent_id);
        }

        // Log activity
        await supabase.from("lead_activities").insert({
          lead_id: callRecord.lead_id,
          performed_by: callRecord.agent_id,
          activity_type: "call_completed",
          details: `Llamada ${statusMap[dialCallStatus] || dialCallStatus} - ${duration}s`,
        });
      }

      // Return empty TwiML
      return new Response("<Response></Response>", {
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    // Status callback updates
    if (type === "status" && formData) {
      const callStatus = formData.get("CallStatus") as string;
      const callDuration = formData.get("CallDuration") as string;
      const recordingUrl = formData.get("RecordingUrl") as string;
      const recordingSid = formData.get("RecordingSid") as string;

      console.log(`Status update for ${callRecordId}: ${callStatus}`);

      const statusMap: Record<string, string> = {
        initiated: "initiating",
        ringing: "ringing",
        "in-progress": "in_progress",
        completed: "completed",
        "no-answer": "no_answer",
        busy: "busy",
        failed: "failed",
        canceled: "failed",
      };

      const updates: Record<string, unknown> = {};
      if (statusMap[callStatus]) {
        updates.status = statusMap[callStatus];
      }
      if (callStatus === "completed" || callStatus === "no-answer" || callStatus === "busy" || callStatus === "failed") {
        updates.ended_at = new Date().toISOString();
        if (callDuration) updates.duration_seconds = parseInt(callDuration);
      }
      if (recordingUrl) updates.recording_url = recordingUrl;
      if (recordingSid) updates.recording_sid = recordingSid;

      if (Object.keys(updates).length > 0) {
        await supabase.from("lead_calls").update(updates).eq("id", callRecordId);
      }

      // If call ended, update agent status
      if (["completed", "no-answer", "busy", "failed", "canceled"].includes(callStatus)) {
        const { data: callRecord } = await supabase
          .from("lead_calls")
          .select("agent_id")
          .eq("id", callRecordId)
          .single();

        if (callRecord) {
          await supabase
            .from("sales_agent_status")
            .update({ status: "wrap_up", current_lead_id: null })
            .eq("user_id", callRecord.agent_id);
        }
      }
    }

    return new Response("<Response></Response>", {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  } catch (err) {
    console.error("Error in call-status:", err);
    return new Response("<Response></Response>", {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  }
});
