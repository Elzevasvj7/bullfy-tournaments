import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle } from "lucide-react";
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

const INTERESTS = [
  "Rebates / Spreads",
  "CPA",
  "Híbrido",
  "Prop Firm",
  "Aún no estoy seguro",
];

const COMMUNITY_SIZES = [
  "1-50 traders",
  "51-200 traders",
  "201-500 traders",
  "500+ traders",
  "Aún no tengo comunidad",
];

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const ContactFormDialog = ({ open, onOpenChange, onSuccess }: ContactFormDialogProps) => {
  const { level, badges, opportunityScore, toolsUsed } = useExperienceStore();
  const { sessionId } = useExperienceSession();
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    correo: "",
    telefono: "",
    pais: "",
    empresa: "",
    tamano_comunidad: "",
    interes: "",
    comentario: "",
  });

  const isValid = form.nombre.trim() && form.correo.trim() && form.telefono.trim() && form.pais;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSending(true);
    try {
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
          empresa: form.empresa.trim() || undefined,
          tamano_comunidad: form.tamano_comunidad || undefined,
          interes: form.interes || undefined,
          comentario: form.comentario.trim() || undefined,
        },
      });
      if (error) throw error;
      onSuccess();
      onOpenChange(false);
      toast.success("¡Solicitud enviada! Un Bullfy Specialist estará contactándote pronto.", {
        duration: 6000,
        icon: "🎉",
      });
    } catch {
      toast.error("Hubo un error al enviar tu solicitud. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Contacta un Bullfy Specialist
          </DialogTitle>
          <DialogDescription>
            Déjanos tus datos para que un especialista te contacte
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="cf-nombre">Nombre completo *</Label>
            <Input
              id="cf-nombre"
              placeholder="Tu nombre"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cf-correo">Correo electrónico *</Label>
            <Input
              id="cf-correo"
              type="email"
              placeholder="tu@email.com"
              value={form.correo}
              onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cf-telefono">Teléfono *</Label>
            <Input
              id="cf-telefono"
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
          <div className="space-y-2">
            <Label htmlFor="cf-empresa">Empresa / Marca <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Input
              id="cf-empresa"
              placeholder="Nombre de tu empresa o marca"
              value={form.empresa}
              onChange={(e) => setForm((f) => ({ ...f, empresa: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Tamaño de comunidad <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Select value={form.tamano_comunidad} onValueChange={(v) => setForm((f) => ({ ...f, tamano_comunidad: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el tamaño" />
              </SelectTrigger>
              <SelectContent>
                {COMMUNITY_SIZES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Modelo de interés <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Select value={form.interes} onValueChange={(v) => setForm((f) => ({ ...f, interes: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="¿Qué modelo te interesa?" />
              </SelectTrigger>
              <SelectContent>
                {INTERESTS.map((i) => (
                  <SelectItem key={i} value={i}>{i}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cf-comentario">Comentario <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Textarea
              id="cf-comentario"
              placeholder="Cuéntanos más sobre tu interés..."
              value={form.comentario}
              onChange={(e) => setForm((f) => ({ ...f, comentario: e.target.value }))}
              rows={3}
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || sending}
            className="w-full bg-gradient-brand shadow-brand"
          >
            {sending ? "Enviando..." : "Enviar solicitud"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContactFormDialog;
