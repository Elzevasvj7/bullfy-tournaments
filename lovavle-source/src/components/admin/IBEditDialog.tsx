import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/toastUtils";
import { Pencil, FileText, Loader2, DollarSign, AlertTriangle, Info, UserCheck } from "lucide-react";
import { loadIBFormData } from "@/services/loadIBFormData";
import { generateAgreementPDF } from "@/services/generateAgreement";
import { getLogoBase64 } from "@/services/pdfLogoHelper";

interface SubIBInfo {
  id: string;
  nombre: string;
  correo: string;
  dolares_por_lote: number | null;
  es_master_ib: boolean;
  master_ib_numero: number | null;
}

interface IBEditDialogProps {
  ib: {
    id: string;
    nombre_ib: string;
    correo_ib: string;
    tipo_id: string;
    id_ib?: string;
    tipo_persona?: string;
    lugar_operacion: string;
    representante_legal?: string | null;
    tipo_id_representante?: string | null;
    id_representante?: string | null;
    direccion_empresa?: string | null;
    contacto_corporativo?: string | null;
    negociaciones_especiales?: string | null;
    comision_dolares_por_lote?: number | null;
    tiene_comision_por_lote?: boolean | null;
    _isSubIb?: boolean;
    _realSubIbId?: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const TIPO_ID_OPTIONS = ["Cédula", "Pasaporte", "ID Fiscal", "RUC", "NIT", "Otro"];
const TIPO_PERSONA_OPTIONS = ["Persona Física", "Empresa"];
const LUGAR_OPTIONS = ["LATAM", "Europa", "Resto del Mundo"];

const IBEditDialog = ({ ib, open, onOpenChange, onSaved }: IBEditDialogProps) => {
  const { isGlobalAdmin, isAdmin, isAdminOperaciones, user } = useAuth();
  const canEditLote = isGlobalAdmin || isAdmin || isAdminOperaciones;
  const isSubIb = !!(ib as any)._isSubIb;
  const realSubIbId = (ib as any)._realSubIbId;
  const [form, setForm] = useState({
    nombre_ib: ib.nombre_ib,
    correo_ib: ib.correo_ib,
    tipo_id: ib.tipo_id || "Cédula",
    id_ib: (ib as any).id_ib || "",
    tipo_persona: ib.tipo_persona || "Persona Física",
    lugar_operacion: ib.lugar_operacion,
    representante_legal: ib.representante_legal || "",
    tipo_id_representante: ib.tipo_id_representante || "",
    id_representante: ib.id_representante || "",
    direccion_empresa: ib.direccion_empresa || "",
    contacto_corporativo: ib.contacto_corporativo || "",
    negociaciones_especiales: ib.negociaciones_especiales || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Alias state
  const [aliasEnabled, setAliasEnabled] = useState(false);
  const [aliasValue, setAliasValue] = useState("");
  const [savingAlias, setSavingAlias] = useState(false);

  // $/lote state
  const [dolaresPorLote, setDolaresPorLote] = useState<number | null>(null);
  const [originalDolaresPorLote, setOriginalDolaresPorLote] = useState<number | null>(null);
  const [subIbs, setSubIbs] = useState<SubIBInfo[]>([]);
  const [parentIBLote, setParentIBLote] = useState<number | null>(null);
  const [childSubIbs, setChildSubIbs] = useState<SubIBInfo[]>([]);
  const [loadingLote, setLoadingLote] = useState(true);
  const [savingLote, setSavingLote] = useState(false);

  const isEmpresa = form.tipo_persona === "Empresa";

  // Load $/lote data on mount
  // Load alias data on mount
  useEffect(() => {
    const loadAlias = async () => {
      if (isSubIb && realSubIbId) {
        const { data } = await supabase.from("sub_ibs").select("alias").eq("id", realSubIbId).single();
        if (data?.alias) { setAliasEnabled(true); setAliasValue(data.alias); }
        else { setAliasEnabled(false); setAliasValue(""); }
      } else {
        const { data } = await (supabase.from as any)("ibs").select("alias").eq("id", ib.id).single();
        if (data?.alias) { setAliasEnabled(true); setAliasValue(data.alias); }
        else { setAliasEnabled(false); setAliasValue(""); }
      }
    };
    if (open) loadAlias();
  }, [open, ib.id, isSubIb, realSubIbId]);

  const handleSaveAlias = async () => {
    setSavingAlias(true);
    const newAlias = aliasEnabled ? aliasValue.trim() || null : null;
    if (isSubIb && realSubIbId) {
      const { error } = await supabase.from("sub_ibs").update({ alias: newAlias } as any).eq("id", realSubIbId);
      if (error) toast.error("Error: " + error.message);
      else { toast.success("Alias actualizado"); onSaved(); }
    } else {
      const { error } = await (supabase.from as any)("ibs").update({ alias: newAlias }).eq("id", ib.id);
      if (error) toast.error("Error: " + error.message);
      else { toast.success("Alias actualizado"); onSaved(); }
    }
    setSavingAlias(false);
  };

  // Helper: resolve the root IB's $/lote with fallback chain:
  // 1) ib_spread_config (max nuevo_dolar_ib across rows) — when modelo Spread/Híbrido
  // 2) ibs.comision_dolares_por_lote — when modelo CPA puro / PropFirm / sin spread
  const resolveRootIbLote = async (rootIbId: string): Promise<number | null> => {
    const { data: spreadData } = await supabase
      .from("ib_spread_config")
      .select("nuevo_dolar_ib, dolares_ib_original")
      .eq("ib_id", rootIbId);
    if (spreadData && spreadData.length > 0) {
      // Use the maximum (the IB total $/lote across symbols)
      const max = spreadData.reduce((m, r: any) => {
        const v = r.nuevo_dolar_ib ?? r.dolares_ib_original ?? 0;
        return v > m ? v : m;
      }, 0);
      if (max > 0) return max;
    }
    // Fallback to ibs.comision_dolares_por_lote
    const { data: ibRow } = await (supabase.from as any)("ibs")
      .select("comision_dolares_por_lote")
      .eq("id", rootIbId)
      .maybeSingle();
    return ibRow?.comision_dolares_por_lote ?? null;
  };

  useEffect(() => {
    const loadLoteData = async () => {
      setLoadingLote(true);
      try {
        if (isSubIb && realSubIbId) {
          // For Sub IB: get its own data including parent_sub_ib_id
          const { data: currentSub } = await supabase
            .from("sub_ibs")
            .select("id, nombre, correo, dolares_por_lote, es_master_ib, master_ib_numero, ib_id, parent_sub_ib_id")
            .eq("id", realSubIbId)
            .single();

          if (currentSub) {
            setDolaresPorLote(currentSub.dolares_por_lote);
            setOriginalDolaresPorLote(currentSub.dolares_por_lote);

            // Determine the direct parent's $/lote and this record's direct children
            if (currentSub.parent_sub_ib_id) {
              // Parent is another Sub IB
              const { data: parentSub } = await supabase
                .from("sub_ibs")
                .select("dolares_por_lote")
                .eq("id", currentSub.parent_sub_ib_id)
                .single();
              setParentIBLote(parentSub?.dolares_por_lote ?? null);
            } else {
              // Parent is the root IB — use fallback chain
              setParentIBLote(await resolveRootIbLote(currentSub.ib_id));
            }

            // Children = only sub_ibs directly below this record
            const { data: children } = await supabase
              .from("sub_ibs")
              .select("id, nombre, correo, dolares_por_lote, es_master_ib, master_ib_numero")
              .eq("parent_sub_ib_id", realSubIbId);
            setChildSubIbs(children ?? []);
          }
        } else {
          // For IB: resolve $/lote with fallback chain (spread_config -> ibs.comision_dolares_por_lote)
          const rootLote = await resolveRootIbLote(ib.id);
          setDolaresPorLote(rootLote);
          setOriginalDolaresPorLote(rootLote);
          const { data } = await supabase
            .from("sub_ibs")
            .select("id, nombre, correo, dolares_por_lote, es_master_ib, master_ib_numero")
            .eq("ib_id", ib.id)
            .is("parent_sub_ib_id", null);
          setSubIbs(data ?? []);
        }
      } catch (err) {
        console.error("Error loading lote data:", err);
      }
      setLoadingLote(false);
    };
    if (open) loadLoteData();
  }, [open, ib.id, isSubIb, realSubIbId]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  // Impact analysis for IB $/lote change
  const loteChanged = dolaresPorLote !== originalDolaresPorLote;
  const subIbsExceedingNewLote = !isSubIb && dolaresPorLote !== null
    ? subIbs.filter(s => s.dolares_por_lote !== null && s.dolares_por_lote > dolaresPorLote)
    : [];
  const totalSubIbLotes = isSubIb
    ? childSubIbs.reduce((sum, s) => sum + (s.dolares_por_lote || 0), 0)
    : subIbs.reduce((sum, s) => sum + (s.dolares_por_lote || 0), 0);

  // For Sub IB: validate only against direct parent and direct children
  const subIbExceedsParent = isSubIb && parentIBLote !== null && dolaresPorLote !== null && dolaresPorLote > parentIBLote;
  const childSubIbsExceedCurrent = isSubIb && dolaresPorLote !== null && totalSubIbLotes > dolaresPorLote;

  const handleSave = async () => {
    if (!form.nombre_ib.trim() || !form.correo_ib.trim()) {
      toast.error("Nombre y correo son obligatorios");
      return;
    }
    setSaving(true);

    if (isSubIb && realSubIbId) {
      // Capture old data for audit
      const { data: oldSub } = await supabase.from("sub_ibs").select("*").eq("id", realSubIbId).maybeSingle();

      const newSubData = {
        nombre: form.nombre_ib.trim(),
        correo: form.correo_ib.trim(),
        tipo_id: form.tipo_id,
        id_documento: form.id_ib.trim(),
      };
      const { error } = await supabase
        .from("sub_ibs")
        .update(newSubData)
        .eq("id", realSubIbId);

      setSaving(false);
      if (error) {
        toast.error("Error al actualizar: " + error.message);
      } else {
        try {
          await supabase.from("audit_log").insert({
            table_name: "sub_ibs",
            record_id: realSubIbId,
            action: "UPDATE",
            old_data: (oldSub as any) || null,
            new_data: newSubData as any,
            changed_fields: ["nombre", "correo", "tipo_id", "id_documento"],
            user_id: user?.id || null,
          });
        } catch (e) { console.warn("audit_log failed", e); }
        toast.success("Datos del Sub IB actualizados correctamente");
        setSaved(true);
        onSaved();
      }
    } else {
      // Capture old data for audit
      const { data: oldIb } = await supabase.from("ibs").select("*").eq("id", ib.id).maybeSingle();

      const newIbData = {
        nombre_ib: form.nombre_ib.trim(),
        correo_ib: form.correo_ib.trim(),
        tipo_id: form.tipo_id,
        id_ib: form.id_ib.trim(),
        tipo_persona: form.tipo_persona,
        lugar_operacion: form.lugar_operacion,
        representante_legal: isEmpresa ? form.representante_legal.trim() || null : null,
        tipo_id_representante: isEmpresa ? form.tipo_id_representante || null : null,
        id_representante: isEmpresa ? form.id_representante.trim() || null : null,
        direccion_empresa: isEmpresa ? form.direccion_empresa.trim() || null : null,
        contacto_corporativo: isEmpresa ? form.contacto_corporativo.trim() || null : null,
        negociaciones_especiales: form.negociaciones_especiales.trim() || null,
      };
      const { error } = await supabase
        .from("ibs")
        .update(newIbData)
        .eq("id", ib.id);

      setSaving(false);
      if (error) {
        toast.error("Error al actualizar: " + error.message);
      } else {
        try {
          await supabase.from("audit_log").insert({
            table_name: "ibs",
            record_id: ib.id,
            action: "UPDATE",
            old_data: (oldIb as any) || null,
            new_data: newIbData as any,
            changed_fields: Object.keys(newIbData),
            user_id: user?.id || null,
          });
        } catch (e) { console.warn("audit_log failed", e); }
        toast.success("Datos del IB actualizados correctamente");
        setSaved(true);
        onSaved();
      }
    }
  };

  const handleSaveLote = async () => {
    if (dolaresPorLote === null || dolaresPorLote < 0) {
      toast.error("Ingresa un valor válido para $/lote");
      return;
    }
    setSavingLote(true);
    try {
      const tableName = isSubIb ? "sub_ibs" : "ibs";
      const recordId = isSubIb ? realSubIbId : ib.id;
      const columnName = isSubIb ? "dolares_por_lote" : "comision_dolares_por_lote";

      if (isSubIb && realSubIbId) {
        const { data: updated, error } = await supabase
          .from("sub_ibs")
          .update({ dolares_por_lote: dolaresPorLote })
          .eq("id", realSubIbId)
          .select("id");
        if (error) throw error;
        if (!updated || updated.length === 0) throw new Error("No se actualizó ningún registro");
        toast.success("$/lote del Sub IB actualizado");
      } else {
        // ROOT IB: write to BOTH places to keep them in sync regardless of model
        // 1) Update ib_spread_config rows IF they exist (Spread/Hybrid model)
        const { data: spreadRows } = await supabase
          .from("ib_spread_config")
          .select("id")
          .eq("ib_id", ib.id);

        if (spreadRows && spreadRows.length > 0) {
          const { error: spreadErr } = await supabase
            .from("ib_spread_config")
            .update({ nuevo_dolar_ib: dolaresPorLote } as any)
            .eq("ib_id", ib.id);
          if (spreadErr) throw spreadErr;
        }

        // 2) ALWAYS persist on ibs.comision_dolares_por_lote as the canonical fallback
        //    so Sub IB inheritance works for all models (CPA puro, PropFirm, sin spread, etc.)
        const { data: ibUpdated, error: ibErr } = await (supabase.from as any)("ibs")
          .update({
            comision_dolares_por_lote: dolaresPorLote,
            tiene_comision_por_lote: true,
          })
          .eq("id", ib.id)
          .select("id");
        if (ibErr) throw ibErr;
        if (!ibUpdated || ibUpdated.length === 0) throw new Error("No se actualizó el IB");
        toast.success("$/lote del IB actualizado");
      }

      // Audit log
      await supabase.from("audit_log").insert({
        table_name: tableName,
        record_id: recordId,
        action: "UPDATE",
        old_data: { [columnName]: originalDolaresPorLote } as any,
        new_data: { [columnName]: dolaresPorLote } as any,
        changed_fields: [columnName],
        user_id: user?.id || null,
      });

      setOriginalDolaresPorLote(dolaresPorLote);
      onSaved();
    } catch (err: any) {
      toast.error("Error al guardar $/lote: " + (err.message || err));
    }
    setSavingLote(false);
  };

  const handleRegenerateAgreement = async () => {
    setRegenerating(true);
    try {
      const formData = await loadIBFormData(ib.id);
      const logoBase64 = await getLogoBase64();

      const { data: reportData, error: reportError } = await supabase
        .from("reports")
        .insert({
          ib_id: ib.id,
          report_type: "agreement",
          nombre_ib: formData.nombre_ib,
          nombre_bd: formData.nombre_bd,
          data: { ...formData, _is_update: true } as any,
          report_number: "",
        })
        .select("report_number")
        .single();

      if (reportError) throw reportError;

      const doc = generateAgreementPDF(formData, reportData.report_number, ib.id, logoBase64);
      doc.save(`Agreement_${formData.nombre_ib.replace(/\s+/g, "_")}_${reportData.report_number}.pdf`);

      toast.success(`Agreement regenerado: ${reportData.report_number}`);
    } catch (err: any) {
      toast.error("Error al regenerar Agreement: " + (err.message || err));
    }
    setRegenerating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4" /> {isSubIb ? "Editar Sub IB" : "Editar IB"}
          </DialogTitle>
          <DialogDescription>{isSubIb ? "Modifica los datos del Sub IB." : "Modifica los datos del IB. Solo Admin y Global Admin."}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo Persona - only for IBs */}
          {!isSubIb && (
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de Persona</Label>
            <Select value={form.tipo_persona} onValueChange={(v) => handleChange("tipo_persona", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPO_PERSONA_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          )}

          {/* Nombre */}
          <div className="space-y-1.5">
            <Label className="text-xs">{isEmpresa ? "Razón Social" : "Nombre completo"}</Label>
            <Input value={form.nombre_ib} onChange={(e) => handleChange("nombre_ib", e.target.value)} />
          </div>

          {/* Correo */}
          <div className="space-y-1.5">
            <Label className="text-xs">Correo electrónico</Label>
            <Input type="email" value={form.correo_ib} onChange={(e) => handleChange("correo_ib", e.target.value)} />
          </div>

          {/* Tipo ID + ID */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de ID</Label>
              <Select value={form.tipo_id} onValueChange={(v) => handleChange("tipo_id", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPO_ID_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Número de ID</Label>
              <Input value={form.id_ib} onChange={(e) => handleChange("id_ib", e.target.value)} />
            </div>
          </div>

          {/* Lugar de operación - only for IBs */}
          {!isSubIb && (
          <div className="space-y-1.5">
            <Label className="text-xs">Lugar de operación</Label>
            <Select value={form.lugar_operacion} onValueChange={(v) => handleChange("lugar_operacion", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LUGAR_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          )}

          {/* Empresa-specific fields - only for IBs */}
          {!isSubIb && isEmpresa && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Dirección de empresa</Label>
                <Input value={form.direccion_empresa} onChange={(e) => handleChange("direccion_empresa", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Contacto corporativo</Label>
                <Input value={form.contacto_corporativo} onChange={(e) => handleChange("contacto_corporativo", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Representante legal</Label>
                <Input value={form.representante_legal} onChange={(e) => handleChange("representante_legal", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo ID Representante</Label>
                  <Select value={form.tipo_id_representante} onValueChange={(v) => handleChange("tipo_id_representante", v)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {TIPO_ID_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">ID Representante</Label>
                  <Input value={form.id_representante} onChange={(e) => handleChange("id_representante", e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* Negociaciones especiales - only for IBs */}
          {!isSubIb && (
          <div className="space-y-1.5">
            <Label className="text-xs">Negociaciones especiales</Label>
            <Textarea
              value={form.negociaciones_especiales}
              onChange={(e) => handleChange("negociaciones_especiales", e.target.value)}
              rows={3}
              placeholder="Dejar vacío si no aplica"
            />
          </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Guardar cambios
            </Button>

            {saved && !isSubIb && (
              <Button
                variant="outline"
                onClick={handleRegenerateAgreement}
                disabled={regenerating}
                className="gap-1.5 text-xs border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
              >
                {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Regenerar Agreement
              </Button>
            )}
          </div>

          {/* Alias Section */}
          <div className="border-t border-border pt-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <UserCheck className="w-4 h-4 text-primary" />
              <Label className="text-sm font-semibold">Alias (nombre visible en portal IB Externo)</Label>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Habilitar alias</Label>
                  <p className="text-[10px] text-muted-foreground">Si se activa, se mostrará el alias en lugar del nombre real en el portal IB Externo</p>
                </div>
                <Switch checked={aliasEnabled} onCheckedChange={(v) => { setAliasEnabled(v); if (!v) setAliasValue(""); }} />
              </div>
              {aliasEnabled && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Alias</Label>
                  <Input
                    value={aliasValue}
                    onChange={(e) => setAliasValue(e.target.value)}
                    placeholder="Nombre visible en portal externo"
                    maxLength={100}
                  />
                </div>
              )}
              <Button onClick={handleSaveAlias} disabled={savingAlias} size="sm" className="gap-1.5">
                {savingAlias && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <UserCheck className="w-3.5 h-3.5" />
                Guardar alias
              </Button>
            </div>
          </div>

          {/* $/Lote Section - only for authorized roles */}
          {canEditLote && (
          <div className="border-t border-border pt-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-primary" />
              <Label className="text-sm font-semibold">Compensación por Lote ($/lote)</Label>
            </div>

            {loadingLote ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> Cargando datos de compensación...
              </div>
            ) : (
              <div className="space-y-3">
                {/* Current value + input */}
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {isSubIb ? "$/lote asignado a este Sub IB" : "$/lote total del IB"}
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">$</span>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      value={dolaresPorLote ?? ""}
                      onChange={(e) => setDolaresPorLote(e.target.value === "" ? null : Number(e.target.value))}
                      className="max-w-[140px]"
                      placeholder="0.00"
                    />
                    {originalDolaresPorLote !== null && loteChanged && (
                      <span className="text-xs text-muted-foreground">
                        (antes: ${originalDolaresPorLote})
                      </span>
                    )}
                  </div>
                </div>

                {/* Impact analysis for IB */}
                {!isSubIb && loteChanged && subIbs.length > 0 && (
                  <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <Info className="w-3.5 h-3.5 text-primary" />
                      Impacto en hijos directos (primer nivel)
                    </div>
                    <div className="space-y-1">
                      {subIbs.map((sub) => {
                        const exceeds = dolaresPorLote !== null && sub.dolares_por_lote !== null && sub.dolares_por_lote > dolaresPorLote;
                        return (
                          <div key={sub.id} className={`flex items-center justify-between text-xs px-2 py-1 rounded ${exceeds ? "bg-destructive/10 border border-destructive/30" : "bg-background/50"}`}>
                            <span className="text-foreground">
                              {sub.nombre}
                              {sub.es_master_ib && <span className="text-primary ml-1">(Master IB{sub.master_ib_numero})</span>}
                            </span>
                            <span className={exceeds ? "text-destructive font-semibold" : "text-muted-foreground"}>
                              ${sub.dolares_por_lote ?? 0}/lote
                              {exceeds && " ⚠️"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Total asignado a Sub IBs: <span className="font-mono font-medium text-foreground">${totalSubIbLotes}</span>
                      {dolaresPorLote !== null && (
                        <> / Nuevo tope: <span className="font-mono font-medium text-foreground">${dolaresPorLote}</span></>
                      )}
                    </div>
                    {subIbsExceedingNewLote.length > 0 && (
                      <div className="flex items-start gap-1.5 text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>
                          {subIbsExceedingNewLote.length} Sub IB(s) tienen asignado más $/lote que el nuevo tope. 
                          Deberás ajustar sus valores manualmente para mantener la estructura coherente.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Impact analysis for Sub IB */}
                {isSubIb && parentIBLote !== null && (
                  <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <Info className="w-3.5 h-3.5 text-primary" />
                      Contexto de distribución (línea directa)
                    </div>
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">$/lote del padre directo</span>
                        <span className="font-mono font-medium text-foreground">${parentIBLote}</span>
                      </div>
                      {childSubIbs.length > 0 && (
                        <>
                          <div className="border-t border-border pt-1 mt-1">
                            <span className="text-muted-foreground">Hijos directos de este Sub IB:</span>
                          </div>
                          {childSubIbs.map((child) => (
                            <div key={child.id} className="flex justify-between px-2">
                              <span className="text-muted-foreground">{child.nombre}</span>
                              <span className="font-mono text-foreground">${child.dolares_por_lote ?? 0}</span>
                            </div>
                          ))}
                          <div className="flex justify-between border-t border-border pt-1">
                            <span className="text-muted-foreground">Total hijos directos</span>
                            <span className="font-mono font-medium text-foreground">${totalSubIbLotes}</span>
                          </div>
                        </>
                      )}
                      {dolaresPorLote !== null && (
                        <div className="flex justify-between border-t border-border pt-1">
                          <span className="text-muted-foreground">Disponible para este Sub IB</span>
                          <span className={`font-mono font-medium ${parentIBLote < dolaresPorLote ? "text-destructive" : "text-foreground"}`}>
                            ${Math.max(0, parentIBLote)}
                          </span>
                        </div>
                      )}
                    </div>
                    {subIbExceedsParent && (
                      <div className="flex items-start gap-1.5 text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>
                          El $/lote de este Sub IB (${dolaresPorLote ?? 0}) excede el $/lote de su padre directo (${parentIBLote}).
                        </span>
                      </div>
                    )}
                    {childSubIbsExceedCurrent && (
                      <div className="flex items-start gap-1.5 text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>
                          El total asignado a los hijos directos (${totalSubIbLotes}) excede el $/lote actual de este Sub IB (${dolaresPorLote ?? 0}).
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* No sub IBs info for IB */}
                {!isSubIb && subIbs.length === 0 && loteChanged && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Info className="w-3.5 h-3.5" />
                    Este IB no tiene Sub IBs, el cambio no afecta la estructura.
                  </div>
                )}

                {/* Save $/lote button */}
                {loteChanged && (
                  <Button
                    onClick={handleSaveLote}
                    disabled={savingLote}
                    size="sm"
                    className="gap-1.5"
                  >
                    {savingLote && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <DollarSign className="w-3.5 h-3.5" />
                    Guardar $/lote
                  </Button>
                )}
              </div>
            )}
          </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IBEditDialog;
