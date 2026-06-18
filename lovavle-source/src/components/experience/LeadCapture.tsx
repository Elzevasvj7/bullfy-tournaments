import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, CheckCircle, Sparkles, ArrowRight, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useExperienceStore } from "@/stores/experienceStore";
import { useExperienceSession } from "@/hooks/useExperienceSession";
import { toast } from "@/lib/toastUtils";
import { z } from "zod";

const COUNTRIES = [
  "México", "Colombia", "Argentina", "Chile", "Perú", "Ecuador", "Venezuela",
  "República Dominicana", "Guatemala", "Costa Rica", "Panamá", "Uruguay",
  "Paraguay", "Bolivia", "Honduras", "El Salvador", "Nicaragua", "España",
  "Estados Unidos", "Brasil", "Otro",
];

const INTERESTS = [
  { value: "rebates", label: "Rebates ($/lote)" },
  { value: "cpa", label: "CPA (pago por cliente)" },
  { value: "hibrido", label: "Híbrido (CPA + Rebates)" },
  { value: "propfirm", label: "PropFirm (cuentas de fondeo)" },
  { value: "no_seguro", label: "No estoy seguro aún" },
];

const COMMUNITY_SIZES = [
  { value: "0-50", label: "0 - 50 personas" },
  { value: "51-200", label: "51 - 200 personas" },
  { value: "201-500", label: "201 - 500 personas" },
  { value: "501-1000", label: "501 - 1,000 personas" },
  { value: "1001-5000", label: "1,001 - 5,000 personas" },
  { value: "5000+", label: "Más de 5,000 personas" },
];

const formSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(100, "Máximo 100 caracteres"),
  correo: z.string().trim().email("Correo electrónico inválido").max(255, "Máximo 255 caracteres"),
  telefono: z.string().trim().min(7, "Teléfono debe tener al menos 7 dígitos").max(20, "Máximo 20 caracteres"),
  pais: z.string().min(1, "Selecciona un país"),
  empresa: z.string().trim().max(100, "Máximo 100 caracteres").optional().or(z.literal("")),
  tamano_comunidad: z.string().optional().or(z.literal("")),
  interes: z.string().optional().or(z.literal("")),
  comentario: z.string().trim().max(500, "Máximo 500 caracteres").optional().or(z.literal("")),
});

type FormData = z.infer<typeof formSchema>;
type FormErrors = Partial<Record<keyof FormData, string>>;

const LeadCapture = () => {
  const navigate = useNavigate();
  const { level, badges, opportunityScore, toolsUsed, simulationsCount, addToolUsed, incrementSimulations } = useExperienceStore();
  const { sessionId } = useExperienceSession();
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [form, setForm] = useState<FormData>({
    nombre: "", correo: "", telefono: "", pais: "",
    empresa: "", tamano_comunidad: "", interes: "", comentario: "",
  });

  const updateField = (field: keyof FormData, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = formSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      result.error.errors.forEach(err => {
        const field = err.path[0] as keyof FormData;
        if (!fieldErrors[field]) fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("experience-contact-request", {
        body: {
          session_id: sessionId,
          opportunity_score: opportunityScore,
          level,
          tools_used: toolsUsed,
          badges,
          nombre: result.data.nombre,
          correo: result.data.correo,
          telefono: result.data.telefono,
          pais: result.data.pais,
          empresa: result.data.empresa || null,
          tamano_comunidad: result.data.tamano_comunidad || null,
          interes: result.data.interes || null,
          comentario: result.data.comentario || null,
        },
      });
      if (error) throw error;

      addToolUsed("lead-capture");
      incrementSimulations();
      setSubmitted(true);
      toast.success("¡Solicitud enviada exitosamente!", { icon: "🎉", duration: 5000 });
    } catch {
      toast.error("Error al enviar. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto space-y-8 py-12">
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">¡Solicitud Enviada!</h2>
              <p className="text-muted-foreground">
                Un Bullfy Specialist se pondrá en contacto contigo pronto para diseñar tu plan de negocio IB personalizado.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/50 border border-border/50 space-y-1">
              <p className="text-sm font-medium">Tu perfil actual</p>
              <p className="text-xs text-muted-foreground">
                Nivel: <span className="text-primary font-semibold">{level}</span> · Score: <span className="text-primary font-semibold">{opportunityScore}/100</span> · {simulationsCount} simulaciones
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate("/IbBullfyExperience/tools")} variant="outline" className="gap-2">
                Seguir explorando herramientas
              </Button>
              <Button onClick={() => navigate("/IbBullfyExperience/dashboard")} className="gap-2 bg-gradient-brand shadow-brand">
                Ver mi Dashboard <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
          <UserPlus className="w-5 h-5 text-primary" />
          <span className="text-sm font-semibold text-primary">Lead Capture</span>
        </div>
        <h1 className="text-3xl font-bold">Conviértete en IB de Bullfy</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Completa tus datos y un Bullfy Specialist diseñará un plan de negocio personalizado para ti.
        </p>
      </div>

      {/* Score badge */}
      {opportunityScore > 0 && (
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-lg bg-primary/5 border border-primary/10">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm">
              Tu score de oportunidad: <span className="font-bold text-primary">{opportunityScore}/100</span>
            </span>
            <span className="text-xs text-muted-foreground">({level})</span>
          </div>
        </div>
      )}

      {/* Form */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Required fields */}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Información de contacto</h3>
              <p className="text-xs text-muted-foreground">Campos marcados con * son obligatorios</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lc-nombre">Nombre completo *</Label>
                <Input
                  id="lc-nombre"
                  placeholder="Tu nombre completo"
                  value={form.nombre}
                  onChange={e => updateField("nombre", e.target.value)}
                  className={errors.nombre ? "border-destructive" : ""}
                  maxLength={100}
                />
                {errors.nombre && <p className="text-xs text-destructive">{errors.nombre}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lc-correo">Correo electrónico *</Label>
                <Input
                  id="lc-correo"
                  type="email"
                  placeholder="tu@email.com"
                  value={form.correo}
                  onChange={e => updateField("correo", e.target.value)}
                  className={errors.correo ? "border-destructive" : ""}
                  maxLength={255}
                />
                {errors.correo && <p className="text-xs text-destructive">{errors.correo}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lc-telefono">Teléfono / WhatsApp *</Label>
                <Input
                  id="lc-telefono"
                  type="tel"
                  placeholder="+52 55 1234 5678"
                  value={form.telefono}
                  onChange={e => updateField("telefono", e.target.value)}
                  className={errors.telefono ? "border-destructive" : ""}
                  maxLength={20}
                />
                {errors.telefono && <p className="text-xs text-destructive">{errors.telefono}</p>}
              </div>
              <div className="space-y-2">
                <Label>País *</Label>
                <Select value={form.pais} onValueChange={v => updateField("pais", v)}>
                  <SelectTrigger className={errors.pais ? "border-destructive" : ""}>
                    <SelectValue placeholder="Selecciona tu país" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.pais && <p className="text-xs text-destructive">{errors.pais}</p>}
              </div>
            </div>

            {/* Optional fields */}
            <div className="pt-4 border-t border-border/50 space-y-1">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Sobre tu negocio</h3>
              <p className="text-xs text-muted-foreground">Opcional — nos ayuda a preparar una propuesta más precisa</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lc-empresa">Empresa / Marca</Label>
                <Input
                  id="lc-empresa"
                  placeholder="Nombre de tu empresa o marca"
                  value={form.empresa}
                  onChange={e => updateField("empresa", e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label>Tamaño de tu comunidad</Label>
                <Select value={form.tamano_comunidad} onValueChange={v => updateField("tamano_comunidad", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un rango" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMUNITY_SIZES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Modelo de negocio de interés</Label>
                <Select value={form.interes} onValueChange={v => updateField("interes", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="¿Qué modelo te interesa?" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERESTS.map(i => (
                      <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lc-comentario">Comentario adicional</Label>
              <Textarea
                id="lc-comentario"
                placeholder="Cuéntanos sobre tu experiencia, tus objetivos o cualquier duda..."
                value={form.comentario}
                onChange={e => updateField("comentario", e.target.value)}
                className="min-h-[80px] resize-none"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">{(form.comentario || "").length}/500</p>
            </div>

            <Button type="submit" disabled={sending} className="w-full h-12 text-base bg-gradient-brand shadow-brand">
              {sending ? "Enviando..." : "Enviar solicitud"}
            </Button>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-3 h-3" />
              <span>Tu información está protegida y no será compartida con terceros</span>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadCapture;
