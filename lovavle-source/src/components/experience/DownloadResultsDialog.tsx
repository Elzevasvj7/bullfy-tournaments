import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useExperienceStore } from "@/stores/experienceStore";
import { useExperienceSession } from "@/hooks/useExperienceSession";
import { toast } from "@/lib/toastUtils";

const COUNTRIES = [
  "México", "Colombia", "Argentina", "Chile", "Perú", "Ecuador", "Venezuela",
  "República Dominicana", "Guatemala", "Costa Rica", "Panamá", "Uruguay",
  "Paraguay", "Bolivia", "Honduras", "El Salvador", "Nicaragua", "España",
  "Estados Unidos", "Brasil", "Otro",
];

interface DownloadResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const DownloadResultsDialog = ({ open, onOpenChange, onSuccess }: DownloadResultsDialogProps) => {
  const { level, badges, opportunityScore, toolsUsed, simulationsCount, progressStage } = useExperienceStore();
  const { sessionId } = useExperienceSession();
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ nombre: "", correo: "", telefono: "", pais: "" });

  const isValid = form.nombre.trim() && form.correo.trim() && form.telefono.trim() && form.pais;

  const generateResultsSummary = () => {
    const lines = [
      "═══════════════════════════════════════",
      "       BULLFY IB EXPERIENCE — RESUMEN",
      "═══════════════════════════════════════",
      "",
      `Nombre: ${form.nombre.trim()}`,
      `Correo: ${form.correo.trim()}`,
      `Teléfono: ${form.telefono.trim()}`,
      `País: ${form.pais}`,
      "",
      "───────────────────────────────────────",
      "                PROGRESO",
      "───────────────────────────────────────",
      `Nivel: ${level}`,
      `Opportunity Score: ${opportunityScore}/100`,
      `Simulaciones realizadas: ${simulationsCount}`,
      `Herramientas usadas: ${toolsUsed.length} (${toolsUsed.join(", ") || "Ninguna"})`,
      `Badges obtenidos: ${badges.length} (${badges.join(", ") || "Ninguno"})`,
      "",
      "───────────────────────────────────────",
      `Fecha: ${new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}`,
      "",
      "Generado por Bullfy IB Experience",
      "═══════════════════════════════════════",
    ];
    return lines.join("\n");
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    setSending(true);
    try {
      // Same notification process as CTA
      const { error } = await supabase.functions.invoke("experience-contact-request", {
        body: {
          session_id: sessionId,
          opportunity_score: opportunityScore,
          level,
          tools_used: toolsUsed,
          badges,
          nombre: form.nombre.trim(),
          correo: form.correo.trim(),
          telefono: form.telefono.trim(),
          pais: form.pais,
          interes: "download_results",
        },
      });
      if (error) throw error;

      // Generate and download the results file
      const summary = generateResultsSummary();
      const blob = new Blob([summary], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bullfy-ib-resultados-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onSuccess();
      onOpenChange(false);
      toast.success("¡Resultados descargados! Un Bullfy Specialist estará contactándote pronto.", {
        duration: 6000,
        icon: "📄",
      });
    } catch {
      toast.error("Hubo un error al procesar tu solicitud. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            Descarga mis resultados
          </DialogTitle>
          <DialogDescription>
            Ingresa tus datos para descargar un resumen de tus simulaciones y resultados
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="dl-nombre">Nombre completo *</Label>
            <Input
              id="dl-nombre"
              placeholder="Tu nombre"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dl-correo">Correo electrónico *</Label>
            <Input
              id="dl-correo"
              type="email"
              placeholder="tu@email.com"
              value={form.correo}
              onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dl-telefono">Teléfono *</Label>
            <Input
              id="dl-telefono"
              type="tel"
              placeholder="+52 55 1234 5678"
              value={form.telefono}
              onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>País *</Label>
            <Select value={form.pais} onValueChange={(v) => setForm((f) => ({ ...f, pais: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona tu país" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || sending}
            className="w-full bg-gradient-brand shadow-brand"
          >
            <Download className="w-4 h-4 mr-2" />
            {sending ? "Procesando..." : "Descargar resultados"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DownloadResultsDialog;
