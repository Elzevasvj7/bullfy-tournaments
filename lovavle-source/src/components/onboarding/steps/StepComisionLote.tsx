import { useOnboardingStore } from "@/stores/onboardingStore";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { DollarSign } from "lucide-react";

const StepComisionLote = () => {
  const { formData, updateFormData } = useOnboardingStore();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="text-lg font-display font-semibold text-foreground">Comisión por Lote Operado</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Esta comisión es adicional al spread y se configura de forma independiente.
        </p>
      </div>

      <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card">
        <Switch
          id="tiene_comision_lote"
          checked={formData.tiene_comision_por_lote}
          onCheckedChange={(checked) =>
            updateFormData({
              tiene_comision_por_lote: checked,
              comision_dolares_por_lote: checked ? formData.comision_dolares_por_lote : null,
            })
          }
        />
        <Label htmlFor="tiene_comision_lote" className="cursor-pointer text-sm font-medium">
          ¿Se debe configurar comisión por lote?
        </Label>
      </div>

      {formData.tiene_comision_por_lote && (
        <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-3 animate-fade-in">
          <Label htmlFor="comision_dolares" className="text-sm font-medium">
            Dólares por lote operado
          </Label>
          <div className="relative max-w-xs">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="comision_dolares"
              type="number"
              min={0}
              step={0.5}
              placeholder="Ej: 2.00"
              className="pl-9"
              value={formData.comision_dolares_por_lote ?? ""}
              onChange={(e) =>
                updateFormData({
                  comision_dolares_por_lote: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Este valor será configurado por Operaciones de forma adicional al spread.
          </p>
        </div>
      )}
    </div>
  );
};

export default StepComisionLote;
