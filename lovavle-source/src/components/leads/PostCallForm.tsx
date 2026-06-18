import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ClipboardCheck } from "lucide-react";
import { toast } from "@/lib/toastUtils";
import { useAuth } from "@/hooks/useAuth";

interface PostCallFormProps {
  callId: string;
  leadId: string;
  onComplete: () => void;
}

const dispositions = [
  { value: "interested", label: "Interesado", emoji: "✅" },
  { value: "callback", label: "Reagendar", emoji: "📅" },
  { value: "not_interested", label: "No interesado", emoji: "❌" },
  { value: "no_answer", label: "Sin respuesta", emoji: "📵" },
  { value: "wrong_number", label: "Número incorrecto", emoji: "🚫" },
  { value: "voicemail", label: "Buzón de voz", emoji: "📨" },
];

const PostCallForm = ({ callId, leadId, onComplete }: PostCallFormProps) => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [disposition, setDisposition] = useState("");
  const [notes, setNotes] = useState("");

  const saveDisposition = useMutation({
    mutationFn: async () => {
      if (!disposition) throw new Error("Selecciona una disposición");

      const { error } = await supabase
        .from("lead_calls")
        .update({ disposition, notes: notes.trim() || null })
        .eq("id", callId);
      if (error) throw error;

      // Log activity
      const dispLabel = dispositions.find((d) => d.value === disposition)?.label || disposition;
      await supabase.from("lead_activities").insert({
        lead_id: leadId,
        performed_by: user?.id,
        activity_type: "call_disposition",
        details: `Disposición: ${dispLabel}${notes.trim() ? " - " + notes.trim() : ""}`,
      });

      // If notes, also add as lead note
      if (notes.trim()) {
        await supabase.from("lead_notes").insert({
          lead_id: leadId,
          user_id: user!.id,
          author_name: "Post-llamada",
          content: notes.trim(),
        });
      }

      // Set agent back to available
      await supabase
        .from("sales_agent_status")
        .update({ status: "available", current_lead_id: null })
        .eq("user_id", user!.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-calls"] });
      qc.invalidateQueries({ queryKey: ["lead-activities"] });
      qc.invalidateQueries({ queryKey: ["lead-notes"] });
      qc.invalidateQueries({ queryKey: ["sales-agent-status"] });
      toast.success("Disposición guardada");

      // Auto-trigger AI analysis in background
      supabase.functions.invoke("analyze-call-recording", {
        body: { call_id: callId },
      }).then(() => {
        qc.invalidateQueries({ queryKey: ["call-analysis"] });
        qc.invalidateQueries({ queryKey: ["smart-call-analyses"] });
      }).catch((err) => {
        console.error("Auto-analysis error:", err);
      });

      onComplete();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-primary" />
          Registro post-llamada
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Resultado de la llamada *</Label>
          <Select value={disposition} onValueChange={setDisposition}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="¿Cómo fue la llamada?" />
            </SelectTrigger>
            <SelectContent>
              {dispositions.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.emoji} {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Notas (opcional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Detalles de la conversación..."
            rows={2}
            className="text-sm"
          />
        </div>
        <Button
          size="sm"
          className="w-full"
          onClick={() => saveDisposition.mutate()}
          disabled={!disposition || saveDisposition.isPending}
        >
          Guardar y volver a disponible
        </Button>
      </CardContent>
    </Card>
  );
};

export default PostCallForm;
