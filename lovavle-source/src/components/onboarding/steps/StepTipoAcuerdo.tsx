import { useOnboardingStore } from "@/stores/onboardingStore";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import IBContextBanner from "../IBContextBanner";

const StepTipoAcuerdo = () => {
  const { formData, updateFormData } = useOnboardingStore();

  const opciones = [
    { value: "Rebates", desc: "Dólares por lote operado basado en spreads" },
    { value: "CPA", desc: "Costo por adquisición basado en depósitos del cliente" },
    { value: "Híbrido", desc: "Combinación de CPA y dólares por lote" },
  ] as const;

  return (
    <div className="space-y-6">
      <IBContextBanner />
      <div>
        <h3 className="text-lg font-display font-bold text-foreground">Tipo de Acuerdo Brokeraje</h3>
        <p className="text-sm text-muted-foreground mt-1">Selecciona el tipo de acuerdo comercial</p>
      </div>

      <RadioGroup
        value={formData.tipo_acuerdo_brokeraje}
        onValueChange={(v) => updateFormData({ tipo_acuerdo_brokeraje: v as typeof formData.tipo_acuerdo_brokeraje })}
        className="space-y-3"
      >
        {opciones.map((op) => (
          <div
            key={op.value}
            className={`flex items-start space-x-3 rounded-lg border p-4 transition-all cursor-pointer ${
              formData.tipo_acuerdo_brokeraje === op.value
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/30"
            }`}
          >
            <RadioGroupItem value={op.value} id={`acuerdo-${op.value}`} className="mt-0.5" />
            <div>
              <Label htmlFor={`acuerdo-${op.value}`} className="cursor-pointer font-semibold">
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

export default StepTipoAcuerdo;
