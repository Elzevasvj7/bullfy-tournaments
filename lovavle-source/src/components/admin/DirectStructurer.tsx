import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Search, Users, PlusCircle, Loader2, CheckCircle2, AlertTriangle,
  UserPlus, Trash2, Building2, ChevronDown, ChevronUp, Shield
} from "lucide-react";
import { toTitleCase } from "@/lib/utils";
import { loadIBFormData } from "@/services/loadIBFormData";
import type { OnboardingFormData } from "@/stores/onboardingStore";

const ID_TYPES = ["Cédula", "Pasaporte", "DNI", "Otro"];

interface IBRecord {
  id: string;
  nombre_ib: string;
  correo_ib: string;
  nombre_bd: string;
  modelo_negocio: string;
  tipo_acuerdo_brokeraje: string | null;
  lugar_operacion: string;
  tiene_sub_ibs: boolean;
}

interface SubIBEntry {
  key: string;
  nombre: string;
  correo: string;
  tipo_id: string;
  id_documento: string;
  dolares_por_lote: number | null;
  invitar_portal: boolean;
  parent_sub_ib_id: string | null;
  // Detection
  has_portal_access: boolean;
  existing_sub_ib_id: string | null;
}

interface PortalStatus {
  has_auth_user: boolean;
  has_ib_externo_role: boolean;
  profile_ib_id: string | null;
}

interface ExistingSubIB {
  id: string;
  nombre: string;
  correo: string;
  parent_sub_ib_id: string | null;
  dolares_por_lote: number | null;
}

const createEmptySubIB = (): SubIBEntry => ({
  key: crypto.randomUUID(),
  nombre: "",
  correo: "",
  tipo_id: "",
  id_documento: "",
  dolares_por_lote: null,
  invitar_portal: true,
  parent_sub_ib_id: null,
  has_portal_access: false,
  existing_sub_ib_id: null,
});

const DirectStructurer = () => {
  const { user, isAdmin, isOperaciones } = useAuth();
  const [mode, setMode] = useState<"select" | "configure">("select");
  const [ibs, setIbs] = useState<IBRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loadingIBs, setLoadingIBs] = useState(true);
  const [selectedIB, setSelectedIB] = useState<IBRecord | null>(null);
  const [masterFormData, setMasterFormData] = useState<OnboardingFormData | null>(null);
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [subIBs, setSubIBs] = useState<SubIBEntry[]>([createEmptySubIB()]);
  const [saving, setSaving] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number>(0);
  const [existingSubIBs, setExistingSubIBs] = useState<ExistingSubIB[]>([]);

  const canAccess = isAdmin || isOperaciones;

  // Fetch IBs
  useEffect(() => {
    if (!canAccess) return;
    const fetchIBs = async () => {
      const { data } = await supabase
        .from("ibs")
        .select("id, nombre_ib, correo_ib, nombre_bd, modelo_negocio, tipo_acuerdo_brokeraje, lugar_operacion, tiene_sub_ibs")
        .in("status", ["submitted", "active", "configurado", "en_proceso"])
        .order("nombre_ib");
      setIbs(data ?? []);
      setLoadingIBs(false);
    };
    fetchIBs();
  }, [canAccess]);

  const handleSelectIB = async (ib: IBRecord) => {
    setSelectedIB(ib);
    setLoadingMaster(true);
    try {
      const data = await loadIBFormData(ib.id);
      setMasterFormData(data);

      // Load existing sub IBs with parent info
      const { data: existingSubs } = await supabase
        .from("sub_ibs")
        .select("id, nombre, correo, parent_sub_ib_id, dolares_por_lote")
        .eq("ib_id", ib.id);
      setExistingSubIBs(existingSubs ?? []);

      setMode("configure");
    } catch (err: any) {
      toast({ title: "Error cargando IB", description: err.message, variant: "destructive" });
    } finally {
      setLoadingMaster(false);
    }
  };

  // Check portal access for a sub IB by email
  const checkPortalAccess = useCallback(async (correo: string): Promise<{ hasAccess: boolean }> => {
    if (!correo) return { hasAccess: false };
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, ib_id")
      .eq("correo", correo.toLowerCase().trim())
      .maybeSingle();

    if (!profile) return { hasAccess: false };

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.id)
      .eq("role", "ib_externo");

    return { hasAccess: !!(roles && roles.length > 0) };
  }, []);

  const handleSubIBEmailBlur = async (idx: number) => {
    const entry = subIBs[idx];
    if (!entry.correo) return;

    const { hasAccess } = await checkPortalAccess(entry.correo);

    // Check if already exists as sub_ib under this IB
    const existing = existingSubIBs.find(
      s => s.correo.toLowerCase().trim() === entry.correo.toLowerCase().trim()
    );

    const updated = [...subIBs];
    updated[idx] = {
      ...updated[idx],
      has_portal_access: hasAccess,
      invitar_portal: !hasAccess,
      existing_sub_ib_id: existing?.id ?? null,
    };
    setSubIBs(updated);

    if (existing) {
      toast({
        title: "Sub IB ya existe",
        description: `${entry.correo} ya está registrado como Sub IB de este IB.`,
        variant: "destructive",
      });
    }
  };

  const updateSubIB = (idx: number, data: Partial<SubIBEntry>) => {
    setSubIBs(prev => prev.map((s, i) => i === idx ? { ...s, ...data } : s));
  };

  const addSubIB = () => {
    setSubIBs(prev => [...prev, createEmptySubIB()]);
    setExpandedIdx(subIBs.length);
  };

  const removeSubIB = (idx: number) => {
    if (subIBs.length <= 1) return;
    setSubIBs(prev => prev.filter((_, i) => i !== idx));
    if (expandedIdx >= subIBs.length - 1) setExpandedIdx(Math.max(0, subIBs.length - 2));
  };

  // Build a label showing the hierarchy path for a sub-IB
  const getSubIBLabel = (sub: ExistingSubIB): string => {
    const parentName = sub.parent_sub_ib_id
      ? existingSubIBs.find(s => s.id === sub.parent_sub_ib_id)?.nombre
      : null;
    return parentName ? `${sub.nombre} (bajo ${parentName})` : sub.nombre;
  };

  const handleSave = async () => {
    if (!user || !selectedIB) return;

    // Validate
    const validSubIBs = subIBs.filter(s => s.nombre && s.correo && s.tipo_id && s.id_documento);
    const newSubIBs = validSubIBs.filter(s => !s.existing_sub_ib_id);

    if (newSubIBs.length === 0) {
      toast({ title: "No hay Sub IBs nuevos para crear", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // 1. Insert sub_ibs records
      const subIbRows = newSubIBs.map(s => ({
        ib_id: selectedIB.id,
        nombre: s.nombre,
        correo: s.correo,
        tipo_id: s.tipo_id,
        id_documento: s.id_documento,
        dolares_por_lote: s.dolares_por_lote,
        parent_sub_ib_id: s.parent_sub_ib_id || null,
      }));

      const { error: insertError } = await supabase.from("sub_ibs").insert(subIbRows as any);
      if (insertError) throw new Error(`Error insertando Sub IBs: ${insertError.message}`);

      // 2. Update master IB tiene_sub_ibs
      if (!selectedIB.tiene_sub_ibs) {
        await supabase.from("ibs").update({ tiene_sub_ibs: true }).eq("id", selectedIB.id);
      }

      // 3. Create or update ops_queue entry so it enters the normal ops workflow
      const subNames = newSubIBs.map(s => s.nombre).join(", ");
      const opsNote = `Estructura creada vía Estructurador Directo por ${user.email}. Sub IBs: ${subNames} (${newSubIBs.length} nuevos).`;

      const { data: opsEntry } = await supabase
        .from("ops_queue")
        .select("id, status")
        .eq("ib_id", selectedIB.id)
        .maybeSingle();

      if (!opsEntry) {
        // No entry exists — create one as "nuevo" so ops picks it up
        await supabase.from("ops_queue").insert({
          ib_id: selectedIB.id,
          status: "nuevo",
          notes: opsNote,
        } as any);
      } else if (opsEntry.status === "configurado") {
        // Already configured — reopen as "nuevo" since new sub IBs were added
        await supabase
          .from("ops_queue")
          .update({ status: "nuevo", notes: opsNote } as any)
          .eq("id", opsEntry.id);
      } else {
        // Entry exists and is in progress — just append notes
        await supabase
          .from("ops_queue")
          .update({ notes: opsNote } as any)
          .eq("id", opsEntry.id);
      }

      // 4. Auto-invite portal for those who need it
      const toInvite = newSubIBs.filter(s => s.invitar_portal && !s.has_portal_access);
      for (const sub of toInvite) {
        try {
          await supabase.functions.invoke("invite-ib-externo", {
            body: {
              correo: sub.correo,
              nombre: sub.nombre,
              ib_id: selectedIB.id,
            },
          });
        } catch (inviteErr) {
          console.error(`Error inviting ${sub.correo}:`, inviteErr);
          toast({
            title: `⚠️ No se pudo invitar a ${sub.nombre}`,
            description: "Puedes invitarlo manualmente desde Mantenimiento IBs.",
            variant: "destructive",
          });
        }
      }

      const invitedCount = toInvite.length;
      toast({
        title: "✅ Estructura creada",
        description: `${newSubIBs.length} Sub IB(s) creados${invitedCount > 0 ? ` y ${invitedCount} invitado(s) al portal` : ""}.`,
      });

      // Reset
      setSubIBs([createEmptySubIB()]);
      setMode("select");
      setSelectedIB(null);
      setMasterFormData(null);
    } catch (err: any) {
      toast({ title: "Error al crear estructura", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center space-y-2">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Acceso restringido a Administradores y Operaciones.</p>
        </div>
      </div>
    );
  }

  const filtered = ibs.filter(
    ib => ib.nombre_ib.toLowerCase().includes(search.toLowerCase()) ||
          ib.correo_ib.toLowerCase().includes(search.toLowerCase()) ||
          ib.nombre_bd.toLowerCase().includes(search.toLowerCase())
  );

  // Get master's $/lote for reference — fallback chain matches IBEditDialog:
  // 1) explicit global override, 2) max nuevo_dolar_ib across spread rows,
  // 3) max dolares_ib_original, 4) ibs.comision_dolares_por_lote (CPA puro / sin spread)
  const spreadRows = masterFormData?.spread_config ?? [];
  const maxNuevoDolarIb = spreadRows.reduce((m: number, r: any) => {
    const v = Number(r?.nuevo_dolar_ib ?? 0);
    return v > m ? v : m;
  }, 0);
  const maxOriginal = spreadRows.reduce((m: number, r: any) => {
    const v = Number(r?.dolares_ib_original ?? 0);
    return v > m ? v : m;
  }, 0);
  const masterDolarLote =
    (masterFormData as any)?.nuevo_dolar_ib_global ??
    (maxNuevoDolarIb > 0 ? maxNuevoDolarIb : null) ??
    (maxOriginal > 0 ? maxOriginal : null) ??
    (masterFormData as any)?.comision_dolares_por_lote ??
    0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Building2 className="w-5 h-5 text-primary" />
        <div>
          <h3 className="text-lg font-display font-bold text-foreground">Estructurador Directo</h3>
          <p className="text-xs text-muted-foreground">
            Crea jerarquías de Sub IBs directamente sin pasar por el flujo de solicitudes o aprobaciones
          </p>
        </div>
      </div>

      {mode === "select" && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar IB por nombre, correo o BD..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {loadingIBs ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando IBs...
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No se encontraron IBs</p>
          ) : (
            <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
              {filtered.map(ib => (
                <button
                  key={ib.id}
                  onClick={() => handleSelectIB(ib)}
                  disabled={loadingMaster}
                  className="w-full text-left rounded-lg border border-border p-4 transition-all hover:border-primary/50 hover:bg-primary/5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{ib.nombre_ib}</p>
                      <p className="text-xs text-muted-foreground">{ib.correo_ib}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-xs font-mono uppercase text-muted-foreground">{ib.nombre_bd}</p>
                      <div className="flex gap-1.5 justify-end">
                        <Badge variant="outline" className="text-[10px]">{ib.modelo_negocio}</Badge>
                        {ib.tipo_acuerdo_brokeraje && (
                          <Badge variant="secondary" className="text-[10px]">{ib.tipo_acuerdo_brokeraje}</Badge>
                        )}
                        {ib.tiene_sub_ibs && (
                          <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">Sub IBs</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {loadingMaster && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-primary/30 bg-primary/10 text-primary text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando configuración del IB...
            </div>
          )}
        </div>
      )}

      {mode === "configure" && selectedIB && (
        <div className="space-y-5">
          {/* Selected IB header */}
          <Card>
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">{selectedIB.nombre_ib}</p>
                  <p className="text-xs text-muted-foreground">{selectedIB.correo_ib} · BD: {selectedIB.nombre_bd}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">{selectedIB.modelo_negocio}</Badge>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setMode("select"); setSelectedIB(null); setMasterFormData(null); setSubIBs([createEmptySubIB()]); }}>
                Cambiar IB
              </Button>
            </CardContent>
          </Card>

          {/* Existing sub IBs info */}
          {existingSubIBs.length > 0 && (
            <div className="rounded-lg border border-border p-3 bg-secondary/30">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Sub IBs existentes ({existingSubIBs.length}):</p>
              <div className="flex flex-wrap gap-2">
                {existingSubIBs.map(s => (
                  <Badge key={s.id} variant="outline" className="text-xs">
                    {s.nombre} ({s.correo})
                    {s.parent_sub_ib_id && (
                      <span className="ml-1 text-muted-foreground">
                        ← {existingSubIBs.find(p => p.id === s.parent_sub_ib_id)?.nombre || "?"}
                      </span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Sub IBs to add */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                Sub IBs a crear
              </h4>
              <Button variant="outline" size="sm" onClick={addSubIB} className="gap-1.5">
                <PlusCircle className="w-3.5 h-3.5" /> Agregar
              </Button>
            </div>

            {subIBs.map((entry, idx) => {
              const isExpanded = expandedIdx === idx;
              return (
                <Card key={entry.key} className={`transition-all ${entry.existing_sub_ib_id ? "border-destructive/50 bg-destructive/5" : ""}`}>
                  <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => setExpandedIdx(isExpanded ? -1 : idx)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">#{idx + 1}</span>
                        <span className="text-sm font-semibold text-foreground">
                          {entry.nombre || "Nuevo Sub IB"}
                        </span>
                        {entry.has_portal_access && (
                          <Badge className="text-[10px] bg-accent/20 text-accent border-accent/30">Ya tiene portal</Badge>
                        )}
                        {entry.existing_sub_ib_id && (
                          <Badge variant="destructive" className="text-[10px]">Ya existe</Badge>
                        )}
                        {entry.parent_sub_ib_id && (
                          <Badge variant="secondary" className="text-[10px]">
                            Bajo: {existingSubIBs.find(s => s.id === entry.parent_sub_ib_id)?.nombre || "Sub IB"}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {subIBs.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); removeSubIB(idx); }}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        )}
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent className="pt-0 pb-4 px-4 space-y-4">
                      {/* Parent Sub IB selector */}
                      {existingSubIBs.length > 0 && (
                        <div className="rounded-lg border border-border p-3 space-y-2 bg-secondary/20">
                          <Label className="text-xs font-semibold">Ubicar debajo de (Sub IB padre)</Label>
                          <Select
                            value={entry.parent_sub_ib_id || "__root__"}
                            onValueChange={v => updateSubIB(idx, { parent_sub_ib_id: v === "__root__" ? null : v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Directamente bajo el Master IB" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__root__">
                                📌 Directamente bajo {selectedIB.nombre_ib} (Master IB)
                              </SelectItem>
                              {existingSubIBs.map(sub => (
                                <SelectItem key={sub.id} value={sub.id}>
                                  👤 {getSubIBLabel(sub)} {sub.dolares_por_lote ? `— $${sub.dolares_por_lote}/lote` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-muted-foreground">
                            Selecciona un Sub IB existente para crear este nuevo Sub IB debajo de él en la jerarquía.
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Nombre completo</Label>
                          <Input
                            value={entry.nombre}
                            onChange={e => updateSubIB(idx, { nombre: toTitleCase(e.target.value) })}
                            placeholder="Nombre del Sub IB"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Correo electrónico</Label>
                          <Input
                            type="email"
                            value={entry.correo}
                            onChange={e => updateSubIB(idx, { correo: e.target.value })}
                            onBlur={() => handleSubIBEmailBlur(idx)}
                            placeholder="correo@ejemplo.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Tipo de documento</Label>
                          <Select value={entry.tipo_id} onValueChange={v => updateSubIB(idx, { tipo_id: v })}>
                            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                            <SelectContent>
                              {ID_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Número de documento</Label>
                          <Input
                            value={entry.id_documento}
                            onChange={e => updateSubIB(idx, { id_documento: e.target.value })}
                            placeholder="Número de identificación"
                          />
                        </div>
                      </div>

                      {/* Compensation */}
                      {masterFormData && (masterFormData.tipo_acuerdo_brokeraje === "Rebates" || masterFormData.tipo_acuerdo_brokeraje === "Híbrido") && (
                        <div className="rounded-lg border border-border p-3 space-y-2">
                          <Label className="text-xs font-semibold">$/Lote asignado al Sub IB</Label>
                          <div className="flex items-center gap-3">
                            {(() => {
                              // If has a parent sub IB, max is the parent's $/lote
                              const parentSub = entry.parent_sub_ib_id
                                ? existingSubIBs.find(s => s.id === entry.parent_sub_ib_id)
                                : null;
                              const maxDolarLote = parentSub?.dolares_por_lote ?? masterDolarLote;
                              const refLabel = parentSub ? `${parentSub.nombre}` : "Master IB";
                              return (
                                <>
                                  <Input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max={maxDolarLote}
                                    value={entry.dolares_por_lote ?? ""}
                                    onChange={e => updateSubIB(idx, { dolares_por_lote: parseFloat(e.target.value) || null })}
                                    className="w-32"
                                    placeholder="0"
                                  />
                                  <span className="text-xs text-muted-foreground">
                                    de ${maxDolarLote} del {refLabel}
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                          {(() => {
                            const parentSub = entry.parent_sub_ib_id
                              ? existingSubIBs.find(s => s.id === entry.parent_sub_ib_id)
                              : null;
                            const maxDolarLote = parentSub?.dolares_por_lote ?? masterDolarLote;
                            return (entry.dolares_por_lote ?? 0) > maxDolarLote ? (
                              <div className="flex items-center gap-1.5 text-xs text-destructive">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Excede el total del {parentSub ? "Sub IB padre" : "Master IB"}
                              </div>
                            ) : null;
                          })()}
                        </div>
                      )}

                      {/* Portal invitation toggle */}
                      <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                        {entry.has_portal_access ? (
                          <div className="flex items-center gap-2 text-xs text-accent">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Este Sub IB ya tiene acceso al portal — no se re-invitará</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={entry.invitar_portal}
                              onCheckedChange={(checked) => updateSubIB(idx, { invitar_portal: checked === true })}
                            />
                            <Label className="text-xs cursor-pointer">
                              Invitar al portal automáticamente (crear usuario + enviar email con contraseña temporal)
                            </Label>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => { setMode("select"); setSelectedIB(null); setMasterFormData(null); setSubIBs([createEmptySubIB()]); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || subIBs.every(s => !!s.existing_sub_ib_id)}
              className="bg-gradient-gold text-primary-foreground font-semibold shadow-gold hover:opacity-90 gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? "Creando estructura..." : "Crear Estructura"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DirectStructurer;
