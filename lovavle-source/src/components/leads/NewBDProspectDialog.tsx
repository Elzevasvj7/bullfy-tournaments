import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toastUtils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onClose: () => void;
}

const NewBDProspectDialog = ({ open, onClose }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    correo: "",
    telefono: "",
    empresa: "",
    pais: "",
    notas: "",
  });

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      // Get default pipeline stage
      const { data: defaultStage } = await supabase
        .from("lead_pipeline_stages")
        .select("id")
        .eq("is_default", true)
        .maybeSingle();

      const { error } = await supabase.from("bd_prospects").insert({
        bd_user_id: user!.id,
        nombre: form.nombre.trim(),
        correo: form.correo.trim() || null,
        telefono: form.telefono.trim() || null,
        empresa: form.empresa.trim() || null,
        pais: form.pais.trim() || null,
        notas: form.notas.trim() || null,
        pipeline_stage_id: defaultStage?.id || null,
        opportunity_score: 0,
      });
      if (error) throw error;
      toast.success("Prospecto IB creado");
      qc.invalidateQueries({ queryKey: ["bd-prospects"] });
      setForm({ nombre: "", correo: "", telefono: "", empresa: "", pais: "", notas: "" });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Error al crear prospecto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo Prospecto IB</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nombre *</Label>
            <Input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Nombre del prospecto" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Correo</Label>
              <Input type="email" value={form.correo} onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))} placeholder="correo@ejemplo.com" />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} placeholder="+52..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Empresa</Label>
              <Input value={form.empresa} onChange={(e) => setForm((f) => ({ ...f, empresa: e.target.value }))} placeholder="Nombre de empresa" />
            </div>
            <div>
              <Label>País</Label>
              <Input value={form.pais} onChange={(e) => setForm((f) => ({ ...f, pais: e.target.value }))} placeholder="País" />
            </div>
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} placeholder="Observaciones del prospecto..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "Crear Prospecto"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewBDProspectDialog;
