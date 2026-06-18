import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserPlus } from "lucide-react";
import { toTitleCase } from "@/lib/utils";
import type { SubIBFormData } from "../SubIBWizard";

const ID_TYPES = ["Cédula", "Pasaporte", "DNI", "Otro"];

interface Props {
  formData: SubIBFormData;
  updateForm: (data: Partial<SubIBFormData>) => void;
}

const StepSubIBInfo = ({ formData, updateForm }: Props) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-primary" />
          Información del Sub IB
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Datos de identificación del nuevo Sub IB
        </p>
      </div>

      {formData.master_ib && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-primary/30 bg-primary/10 text-sm">
          <span className="text-muted-foreground">Master IB:</span>
          <span className="font-semibold text-foreground">{formData.master_ib.nombre_ib}</span>
          <Badge variant="outline" className="text-[10px]">{formData.master_ib.modelo_negocio}</Badge>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sub_nombre">Nombre completo</Label>
          <Input
            id="sub_nombre"
            value={formData.nombre}
            onChange={(e) => updateForm({ nombre: toTitleCase(e.target.value) })}
            placeholder="Nombre del Sub IB"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sub_correo">Correo electrónico</Label>
          <Input
            id="sub_correo"
            type="email"
            value={formData.correo}
            onChange={(e) => updateForm({ correo: e.target.value })}
            placeholder="correo@ejemplo.com"
          />
        </div>
        <div className="space-y-2">
          <Label>Tipo de documento</Label>
          <Select value={formData.tipo_id} onValueChange={(v) => updateForm({ tipo_id: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar tipo" />
            </SelectTrigger>
            <SelectContent>
              {ID_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sub_id">Número de documento</Label>
          <Input
            id="sub_id"
            value={formData.id_documento}
            onChange={(e) => updateForm({ id_documento: e.target.value })}
            placeholder="Número de identificación"
          />
        </div>
      </div>
    </div>
  );
};

export default StepSubIBInfo;
