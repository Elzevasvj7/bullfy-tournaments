import { useEffect } from "react";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toTitleCase } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";

const StepInfoGeneral = () => {
  const { formData, updateFormData } = useOnboardingStore();
  const { profile } = useAuth();

  const isEmpresa = formData.tipo_persona === "Empresa";

  useEffect(() => {
    if (profile?.nombre && !formData.nombre_bd) {
      updateFormData({ nombre_bd: profile.nombre });
    }
  }, [profile]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-display font-bold text-foreground">Información General</h3>
        <p className="text-sm text-muted-foreground mt-1">Datos básicos del Introducing Broker</p>
      </div>

      {/* Tipo de Persona */}
      <div className="space-y-3">
        <Label>Tipo de IB</Label>
        <RadioGroup
          value={formData.tipo_persona}
          onValueChange={(v) => updateFormData({ tipo_persona: v as 'Persona Física' | 'Empresa', tipo_id: '', id_ib: '' })}
          className="flex gap-6"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="Persona Física" id="persona_fisica" />
            <Label htmlFor="persona_fisica" className="cursor-pointer font-normal">Persona Física</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="Empresa" id="empresa" />
            <Label htmlFor="empresa" className="cursor-pointer font-normal">Empresa (Compañía)</Label>
          </div>
        </RadioGroup>
      </div>

      {formData.tipo_persona && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nombre_bd">Nombre de Business Developer</Label>
            <Input
              id="nombre_bd"
              value={formData.nombre_bd}
              readOnly
              className="bg-muted/50 cursor-not-allowed"
              placeholder="Se asigna automáticamente"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nombre_ib">Nombre del IB</Label>
            <Input
              id="nombre_ib"
              value={formData.nombre_ib}
              onChange={(e) => updateFormData({ nombre_ib: toTitleCase(e.target.value) })}
              placeholder="Nombre completo del IB"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="correo_ib">Correo del IB</Label>
            <Input
              id="correo_ib"
              type="email"
              value={formData.correo_ib}
              onChange={(e) => updateFormData({ correo_ib: e.target.value })}
              placeholder="correo@ejemplo.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tipo_id">{isEmpresa ? "Identificación Fiscal" : "Tipo de ID"}</Label>
            {isEmpresa ? (
              <Input
                id="tipo_id"
                value={formData.tipo_id}
                onChange={(e) => updateFormData({ tipo_id: e.target.value })}
                placeholder="Ej: RFC, NIT, Tax ID"
              />
            ) : (
              <Select
                value={formData.tipo_id}
                onValueChange={(v) => updateFormData({ tipo_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                  <SelectItem value="Cédula">Cédula</SelectItem>
                  <SelectItem value="DNI">DNI</SelectItem>
                  <SelectItem value="Licencia">Licencia de conducir</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="id_ib">{isEmpresa ? "Dirección de constitución de la Empresa" : "Número de ID del IB"}</Label>
            <Input
              id="id_ib"
              value={isEmpresa ? formData.direccion_empresa : formData.id_ib}
              onChange={(e) => isEmpresa
                ? updateFormData({ direccion_empresa: e.target.value })
                : updateFormData({ id_ib: e.target.value })
              }
              placeholder={isEmpresa ? "Dirección de constitución de la empresa" : "Número de identificación"}
            />
          </div>

          {/* Campos adicionales para Empresa */}
          {isEmpresa && (
            <>
              <div className="space-y-2">
                <Label htmlFor="contacto_corporativo">Contacto Corporativo</Label>
                <Input
                  id="contacto_corporativo"
                  value={formData.contacto_corporativo}
                  onChange={(e) => updateFormData({ contacto_corporativo: e.target.value })}
                  placeholder="Nombre del contacto corporativo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="representante_legal">Representante Legal</Label>
                <Input
                  id="representante_legal"
                  value={formData.representante_legal}
                  onChange={(e) => updateFormData({ representante_legal: toTitleCase(e.target.value) })}
                  placeholder="Nombre del representante legal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo_id_representante">Tipo de ID del Representante Legal</Label>
                <Select
                  value={formData.tipo_id_representante}
                  onValueChange={(v) => updateFormData({ tipo_id_representante: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                    <SelectItem value="Cédula">Cédula</SelectItem>
                    <SelectItem value="DNI">DNI</SelectItem>
                    <SelectItem value="Licencia">Licencia de conducir</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="id_representante">Número de ID del Representante Legal</Label>
                <Input
                  id="id_representante"
                  value={formData.id_representante}
                  onChange={(e) => updateFormData({ id_representante: e.target.value })}
                  placeholder="Número de identificación"
                />
              </div>
            </>
          )}

          {/* Nombre Comunidad */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.tiene_nombre_comunidad}
                onCheckedChange={(v) => updateFormData({ tiene_nombre_comunidad: v, nombre_comunidad: v ? formData.nombre_comunidad : '' })}
              />
              <Label>¿El IB tiene algún nombre para su comunidad?</Label>
            </div>
            {formData.tiene_nombre_comunidad && (
              <div className="space-y-2">
                <Label htmlFor="nombre_comunidad">Nombre de la Comunidad</Label>
                <Input
                  id="nombre_comunidad"
                  value={formData.nombre_comunidad}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase().replace(/\s/g, '');
                    updateFormData({ nombre_comunidad: val });
                  }}
                  placeholder="Debe ser una sola palabra"
                  className="uppercase"
                />
                <p className="text-xs text-muted-foreground">Debe ser una sola palabra, sin espacios.</p>
              </div>
            )}
          </div>

          {/* Tipo de cuentas en grupos */}
          <div className="space-y-3 md:col-span-2">
            <Label>¿El IB tendrá grupos con cuentas CENT, Estándar o ambas?</Label>
            <RadioGroup
              value={formData.tipo_grupo_cuentas}
              onValueChange={(v) => updateFormData({ tipo_grupo_cuentas: v as 'CENT' | 'Estándar' | 'Ambas' })}
              className="flex flex-wrap gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="CENT" id="grupo_cent" />
                <Label htmlFor="grupo_cent" className="cursor-pointer font-normal">CENT</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Estándar" id="grupo_estandar" />
                <Label htmlFor="grupo_estandar" className="cursor-pointer font-normal">Estándar</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Ambas" id="grupo_ambas" />
                <Label htmlFor="grupo_ambas" className="cursor-pointer font-normal">Ambas</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Negociaciones Especiales - siempre visible */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="negociaciones_especiales">Negociaciones Especiales</Label>
            <Textarea
              id="negociaciones_especiales"
              value={formData.negociaciones_especiales}
              onChange={(e) => updateFormData({ negociaciones_especiales: e.target.value })}
              placeholder="Describe cualquier negociación especial acordada con el IB..."
              className="min-h-[80px]"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default StepInfoGeneral;
