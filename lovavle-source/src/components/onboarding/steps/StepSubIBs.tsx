import { useOnboardingStore } from "@/stores/onboardingStore";
import { toTitleCase } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Crown } from "lucide-react";
import IBContextBanner from "../IBContextBanner";

const ID_TYPES = ["Cédula", "Pasaporte", "DNI", "Otro"];

const StepSubIBs = () => {
  const { formData, updateFormData } = useOnboardingStore();

  const nextMasterNumber = () => {
    const existing = formData.sub_ibs.filter((s) => s.es_master_ib);
    // Master IB1 is always the principal IB, so sub IBs start at 2
    return existing.length + 2;
  };

  const addSubIB = () => {
    updateFormData({
      sub_ibs: [
        ...formData.sub_ibs,
        { nombre: "", correo: "", tipo_id: "", id_documento: "", es_master_ib: false, master_ib_numero: null, dolares_por_lote: null },
      ],
    });
  };

  const removeSubIB = (index: number) => {
    const updated = formData.sub_ibs.filter((_, i) => i !== index);
    // Recalculate master_ib_numero for remaining masters
    let masterCount = 2;
    const renumbered = updated.map((s) => {
      if (s.es_master_ib) {
        return { ...s, master_ib_numero: masterCount++ };
      }
      return s;
    });
    updateFormData({ sub_ibs: renumbered });
  };

  const updateSubIB = (index: number, field: keyof typeof formData.sub_ibs[0], value: string | boolean | number | null) => {
    const updated = [...formData.sub_ibs];
    if (field === "es_master_ib") {
      const isMaster = value as boolean;
      updated[index] = {
        ...updated[index],
        es_master_ib: isMaster,
        master_ib_numero: isMaster ? nextMasterNumber() : null,
        dolares_por_lote: isMaster ? updated[index].dolares_por_lote : null,
      };
      // Renumber all masters
      let masterCount = 2;
      for (let i = 0; i < updated.length; i++) {
        if (updated[i].es_master_ib) {
          updated[i] = { ...updated[i], master_ib_numero: masterCount++ };
        }
      }
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    updateFormData({ sub_ibs: updated });
  };

  const masterCount = formData.sub_ibs.filter((s) => s.es_master_ib).length;

  return (
    <div className="space-y-6">
      <IBContextBanner />
      <div>
        <h3 className="text-lg font-display font-bold text-foreground">Sub IBs</h3>
        <p className="text-sm text-muted-foreground mt-1">¿Existen Sub IBs asociados?</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          El IB principal es automáticamente <span className="text-amber-400 font-semibold">Master IB1</span>.
        </p>
      </div>

      <RadioGroup
        value={formData.tiene_sub_ibs ? "si" : "no"}
        onValueChange={(v) => {
          const tiene = v === "si";
          updateFormData({
            tiene_sub_ibs: tiene,
            sub_ibs: tiene
              ? formData.sub_ibs.length
                ? formData.sub_ibs
                : [{ nombre: "", correo: "", tipo_id: "", id_documento: "", es_master_ib: false, master_ib_numero: null, dolares_por_lote: null }]
              : [],
          });
        }}
        className="flex gap-4"
      >
        {["si", "no"].map((val) => (
          <div
            key={val}
            className={`flex items-center space-x-2 rounded-lg border p-4 flex-1 cursor-pointer transition-all ${
              (val === "si" ? formData.tiene_sub_ibs : !formData.tiene_sub_ibs)
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/30"
            }`}
          >
            <RadioGroupItem value={val} id={`sub-ib-${val}`} />
            <Label htmlFor={`sub-ib-${val}`} className="cursor-pointer">
              {val === "si" ? "Sí" : "No"}
            </Label>
          </div>
        ))}
      </RadioGroup>

      {formData.tiene_sub_ibs && (
        <div className="space-y-6">
          {/* Distribution summary */}
          {masterCount > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-xs font-semibold text-amber-400 mb-1 flex items-center gap-1">
                <Crown className="w-3.5 h-3.5" /> Distribución Master IBs
              </p>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>• Master IB1 (Principal) — {formData.nombre_ib || "IB Principal"}</p>
                {formData.sub_ibs
                  .filter((s) => s.es_master_ib)
                  .map((s) => (
                    <p key={s.master_ib_numero}>
                      • Master IB{s.master_ib_numero} — {s.nombre || "Sin nombre"}
                    </p>
                  ))}
              </div>
            </div>
          )}

          {formData.sub_ibs.map((sub, index) => (
            <div
              key={index}
              className={`rounded-lg border p-4 space-y-3 ${
                sub.es_master_ib ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-secondary/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-display font-bold text-foreground flex items-center gap-2">
                  {sub.es_master_ib && <Crown className="w-4 h-4 text-amber-400" />}
                  {sub.es_master_ib ? `Master IB${sub.master_ib_numero}` : `Sub IB ${index + 1}`}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSubIB(index)}
                  className="text-destructive hover:text-destructive h-8 w-8"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Master IB toggle */}
              <div className="flex items-center justify-between rounded-md border border-border p-3 bg-background/50">
                <div>
                  <Label className="text-xs font-semibold">¿Es Master IB adicional?</Label>
                  <p className="text-xs text-muted-foreground">Se le asignará un número de Master IB y sus $/lote se configurarán en el paso de Rebates</p>
                </div>
                <Switch
                  checked={sub.es_master_ib}
                  onCheckedChange={(checked) => updateSubIB(index, "es_master_ib", checked)}
                />
              </div>


              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input
                    value={sub.nombre}
                    onChange={(e) => updateSubIB(index, "nombre", toTitleCase(e.target.value))}
                    placeholder="Nombre del Sub IB"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Correo</Label>
                  <Input
                    type="email"
                    value={sub.correo}
                    onChange={(e) => updateSubIB(index, "correo", e.target.value)}
                    placeholder="correo@ejemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de documento</Label>
                  <Select value={sub.tipo_id} onValueChange={(v) => updateSubIB(index, "tipo_id", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {ID_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Número de documento</Label>
                  <Input
                    value={sub.id_documento}
                    onChange={(e) => updateSubIB(index, "id_documento", e.target.value)}
                    placeholder="Número de identificación"
                  />
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addSubIB}>
            <Plus className="w-4 h-4 mr-2" />
            Agregar Sub IB
          </Button>
        </div>
      )}
    </div>
  );
};

export default StepSubIBs;
