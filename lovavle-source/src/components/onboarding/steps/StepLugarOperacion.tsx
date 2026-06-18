import { useOnboardingStore } from "@/stores/onboardingStore";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import IBContextBanner from "../IBContextBanner";

const StepLugarOperacion = () => {
  const { formData, updateFormData } = useOnboardingStore();

  const opciones = ["LATAM", "Europa", "Resto del Mundo"] as const;

  return (
    <div className="space-y-6">
      <IBContextBanner />
      <div>
        <h3 className="text-lg font-display font-bold text-foreground">Lugar de Operación</h3>
        <p className="text-sm text-muted-foreground mt-1">¿Dónde opera el IB?</p>
      </div>

      <RadioGroup
        value={formData.lugar_operacion}
        onValueChange={(v) => updateFormData({ lugar_operacion: v as typeof formData.lugar_operacion })}
        className="space-y-3"
      >
        {opciones.map((op) => (
          <div
            key={op}
            className={`flex items-center space-x-3 rounded-lg border p-4 transition-all cursor-pointer ${
              formData.lugar_operacion === op
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/30"
            }`}
          >
            <RadioGroupItem value={op} id={op} />
            <Label htmlFor={op} className="cursor-pointer flex-1">{op}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
};

export default StepLugarOperacion;
