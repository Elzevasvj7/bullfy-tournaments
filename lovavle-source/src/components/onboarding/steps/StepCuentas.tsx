import { useOnboardingStore } from "@/stores/onboardingStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import IBContextBanner from "../IBContextBanner";

const StepCuentas = () => {
  const { formData, updateFormData } = useOnboardingStore();

  const marketingOpciones = [
    { value: "No tiene", desc: "No tiene cuenta de marketing" },
    { value: "Real Marketing", desc: "Cuentas reales para marketing" },
    { value: "Fondeo Marketing", desc: "Cuentas de fondeo para marketing" },
    { value: "Ambas", desc: "Cuentas reales y de fondeo" },
  ] as const;

  return (
    <div className="space-y-8">
      <IBContextBanner />

      {/* Marketing Accounts */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-display font-bold text-foreground">Cuentas de Marketing</h3>
          <p className="text-sm text-muted-foreground mt-1">¿Desea cuentas de marketing?</p>
        </div>

        <RadioGroup
          value={formData.cuentas_marketing_tipo}
          onValueChange={(v) => updateFormData({ cuentas_marketing_tipo: v as typeof formData.cuentas_marketing_tipo })}
          className="space-y-2"
        >
          {marketingOpciones.map((op) => (
            <div
              key={op.value}
              className={`flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-all ${
                formData.cuentas_marketing_tipo === op.value
                  ? "border-primary bg-primary/5"
                  : "border-border"
              }`}
            >
              <RadioGroupItem value={op.value} id={`mkt-${op.value}`} />
              <Label htmlFor={`mkt-${op.value}`} className="cursor-pointer text-sm">{op.desc}</Label>
            </div>
          ))}
        </RadioGroup>

        {formData.cuentas_marketing_tipo && formData.cuentas_marketing_tipo !== "No tiene" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cantidad</Label>
              <Input
                type="number"
                value={formData.cuentas_marketing_cantidad || ""}
                onChange={(e) => updateFormData({ cuentas_marketing_cantidad: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Balance ($)</Label>
              <Input
                type="number"
                value={formData.cuentas_marketing_balance || ""}
                onChange={(e) => updateFormData({ cuentas_marketing_balance: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Código de Descuento - Solo para PropFirm */}
      {(formData.modelo_negocio === "PropFirm" || formData.modelo_negocio === "Ambos") && (
        <div className="border-t border-border pt-6 space-y-4">
          <div>
            <h3 className="text-lg font-display font-bold text-foreground">Código de Descuento Personalizado</h3>
            <p className="text-sm text-muted-foreground mt-1">¿Desea un código de descuento para cuentas de fondeo?</p>
          </div>

          <RadioGroup
            value={formData.tiene_codigo_descuento ? "si" : "no"}
            onValueChange={(v) => updateFormData({ tiene_codigo_descuento: v === "si" })}
            className="flex gap-4"
          >
            {["si", "no"].map((val) => (
              <div
                key={val}
                className={`flex items-center space-x-2 rounded-lg border p-3 flex-1 cursor-pointer transition-all ${
                  (val === "si" ? formData.tiene_codigo_descuento : !formData.tiene_codigo_descuento)
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
              >
                <RadioGroupItem value={val} id={`descuento-${val}`} />
                <Label htmlFor={`descuento-${val}`} className="cursor-pointer text-sm">
                  {val === "si" ? "Sí" : "No"}
                </Label>
              </div>
            ))}
          </RadioGroup>

          {formData.tiene_codigo_descuento && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código de descuento</Label>
                <Input
                  type="text"
                  placeholder="Ej: IB-DESCUENTO-10"
                  value={formData.codigo_descuento || ""}
                  onChange={(e) => updateFormData({ codigo_descuento: e.target.value.toUpperCase().slice(0, 30) })}
                  maxLength={30}
                />
                <p className="text-xs text-muted-foreground">Código que IT configurará en el sistema</p>
              </div>
              <div className="space-y-2">
                <Label>Porcentaje de descuento (%)</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  placeholder="Ej: 10"
                  value={formData.porcentaje_descuento || ""}
                  onChange={(e) => updateFormData({ porcentaje_descuento: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fondeo Regalo */}
      <div className="border-t border-border pt-6 space-y-4">
        <div>
          <h3 className="text-lg font-display font-bold text-foreground">Cuentas de Fondeo Regalo</h3>
          <p className="text-sm text-muted-foreground mt-1">¿Hay cuentas de fondeo regalo?</p>
        </div>

        <RadioGroup
          value={formData.tiene_fondeo_regalo ? "si" : "no"}
          onValueChange={(v) => updateFormData({ tiene_fondeo_regalo: v === "si" })}
          className="flex gap-4"
        >
          {["si", "no"].map((val) => (
            <div
              key={val}
              className={`flex items-center space-x-2 rounded-lg border p-3 flex-1 cursor-pointer transition-all ${
                (val === "si" ? formData.tiene_fondeo_regalo : !formData.tiene_fondeo_regalo)
                  ? "border-primary bg-primary/5"
                  : "border-border"
              }`}
            >
              <RadioGroupItem value={val} id={`fondeo-regalo-${val}`} />
              <Label htmlFor={`fondeo-regalo-${val}`} className="cursor-pointer text-sm">
                {val === "si" ? "Sí" : "No"}
              </Label>
            </div>
          ))}
        </RadioGroup>

        {formData.tiene_fondeo_regalo && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cantidad</Label>
              <Input
                type="number"
                value={formData.fondeo_regalo_cantidad || ""}
                onChange={(e) => updateFormData({ fondeo_regalo_cantidad: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Balance ($)</Label>
              <Input
                type="number"
                value={formData.fondeo_regalo_balance || ""}
                onChange={(e) => updateFormData({ fondeo_regalo_balance: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Fondeo Especial */}
      <div className="border-t border-border pt-6 space-y-4">
        <div>
          <h3 className="text-lg font-display font-bold text-foreground">Cuenta Fondeo Retiro Especial</h3>
          <p className="text-sm text-muted-foreground mt-1">¿Cuenta con condiciones especiales?</p>
        </div>

        <RadioGroup
          value={formData.tiene_fondeo_especial ? "si" : "no"}
          onValueChange={(v) => updateFormData({ tiene_fondeo_especial: v === "si" })}
          className="flex gap-4"
        >
          {["si", "no"].map((val) => (
            <div
              key={val}
              className={`flex items-center space-x-2 rounded-lg border p-3 flex-1 cursor-pointer transition-all ${
                (val === "si" ? formData.tiene_fondeo_especial : !formData.tiene_fondeo_especial)
                  ? "border-primary bg-primary/5"
                  : "border-border"
              }`}
            >
              <RadioGroupItem value={val} id={`fondeo-esp-${val}`} />
              <Label htmlFor={`fondeo-esp-${val}`} className="cursor-pointer text-sm">
                {val === "si" ? "Sí" : "No"}
              </Label>
            </div>
          ))}
        </RadioGroup>

        {formData.tiene_fondeo_especial && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Balance ($)</Label>
              <Input
                type="number"
                value={formData.fondeo_especial_balance || ""}
                onChange={(e) => updateFormData({ fondeo_especial_balance: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <h4 className="text-sm font-semibold mb-2">Condiciones de retiro:</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Retiro: 50% del profit</li>
                <li>• Máximo 3% del balance</li>
                <li className="text-primary">Ejemplo: Cuenta 100k, Profit 7000 → retiro máximo $3,000</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StepCuentas;
