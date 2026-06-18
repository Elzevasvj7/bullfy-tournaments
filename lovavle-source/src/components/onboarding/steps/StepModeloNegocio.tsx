import { useOnboardingStore } from "@/stores/onboardingStore";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import IBContextBanner from "../IBContextBanner";

const StepModeloNegocio = () => {
  const { formData, updateFormData } = useOnboardingStore();

  const opciones = [
    { value: "Brokeraje", desc: "Modelo de brokeraje tradicional con rebates, CPA o híbrido" },
    { value: "PropFirm", desc: "Modelo PropFirm con comisiones por ventas de cuentas de fondeo" },
    { value: "Ambos", desc: "Combinación de brokeraje y PropFirm" },
  ] as const;

  return (
    <div className="space-y-6">
      <IBContextBanner />
      <div>
        <h3 className="text-lg font-display font-bold text-foreground">Modelo de Negocio</h3>
        <p className="text-sm text-muted-foreground mt-1">¿Qué modelo va a trabajar el IB?</p>
      </div>

      <RadioGroup
        value={formData.modelo_negocio}
        onValueChange={(v) => updateFormData({ modelo_negocio: v as typeof formData.modelo_negocio })}
        className="space-y-3"
      >
        {opciones.map((op) => (
          <div
            key={op.value}
            className={`flex items-start space-x-3 rounded-lg border p-4 transition-all cursor-pointer ${
              formData.modelo_negocio === op.value
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/30"
            }`}
          >
            <RadioGroupItem value={op.value} id={`modelo-${op.value}`} className="mt-0.5" />
            <div>
              <Label htmlFor={`modelo-${op.value}`} className="cursor-pointer font-semibold">
                {op.value}
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">{op.desc}</p>
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
};

export default StepModeloNegocio;
