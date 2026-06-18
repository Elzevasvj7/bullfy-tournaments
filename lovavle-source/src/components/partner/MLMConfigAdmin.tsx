import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/toastUtils";
import { usePortalBrand, brandText } from "@/lib/portalBrand";
import {
  Network, Plus, Trash2, Save, Info, AlertTriangle, Loader2, Layers, Percent, Wallet,
  Settings2, Users2, Crown, Building2,
} from "lucide-react";
import { usePortalBranding, dimHex } from "@/hooks/usePortalBranding";

interface Props {
  portalId: string;
}

interface MLMConfig {
  id?: string;
  enabled: boolean;
  active_levels: number;
  mlm_pool_percentage: number;
  refund_window_days: number;   // legacy (el motor ya no lo usa; se conserva para el RPC)
  orphan_policy: string;
}

interface MLMLevel {
  id?: string;
  level_number: number;
  percentage: number;
  _isNew?: boolean;
}

interface BusinessPartner {
  id?: string;
  partner_user_id: string;
  percentage: number;
  active: boolean;
  notes?: string | null;
  _user?: { nombre: string; email: string };
}

interface EligibleUser {
  id: string;
  nombre: string;
  email: string;
}

const DEFAULT_CONFIG: MLMConfig = {
  enabled: false,
  active_levels: 3,
  mlm_pool_percentage: 20,
  refund_window_days: 7,
  orphan_policy: "portal_owner",
};

const MLMConfigAdmin = ({ portalId }: Props) => {
  const { isWhiteLabel } = usePortalBrand();
  const { branding } = usePortalBranding(portalId);
  const btnBg = dimHex(branding.primary_color, 0.7);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<MLMConfig>(DEFAULT_CONFIG);
  const [levels, setLevels] = useState<MLMLevel[]>([]);
  const [platformFee, setPlatformFee] = useState<number>(0);

  // Business partners (socios) state
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [eligibleUsers, setEligibleUsers] = useState<EligibleUser[]>([]);
  const [addPartnerOpen, setAddPartnerOpen] = useState(false);
  const [newPartner, setNewPartner] = useState<{ user_id: string; pct: string; notes: string }>({
    user_id: "", pct: "", notes: "",
  });
  const [savingPartner, setSavingPartner] = useState(false);

  useEffect(() => { loadData(); }, [portalId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configRes, levelsRes, partnersRes, eligibleRes, portalRes] = await Promise.all([
        supabase.from("portal_mlm_config").select("*").eq("portal_id", portalId).maybeSingle(),
        supabase.from("portal_mlm_levels").select("*").eq("portal_id", portalId).order("level_number"),
        supabase
          .from("portal_business_partners")
          .select("*, partner_users!inner(nombre, email)")
          .eq("portal_id", portalId),
        supabase
          .from("partner_users")
          .select("id, nombre, email")
          .eq("portal_id", portalId)
          .eq("can_be_business_partner", true),
        (supabase.from as any)("partner_portals").select("platform_fee_percentage").eq("id", portalId).maybeSingle(),
      ]);

      if (configRes.data) {
        setConfig({
          id: configRes.data.id,
          enabled: configRes.data.enabled,
          active_levels: configRes.data.active_levels,
          mlm_pool_percentage: Number(configRes.data.mlm_pool_percentage),
          refund_window_days: configRes.data.refund_window_days,
          orphan_policy: configRes.data.orphan_policy,
        });
      }
      if (levelsRes.data && levelsRes.data.length > 0) {
        setLevels(levelsRes.data.map((l: any) => ({
          id: l.id, level_number: l.level_number, percentage: Number(l.percentage),
        })));
      } else {
        setLevels([
          { level_number: 1, percentage: 10, _isNew: true },
          { level_number: 2, percentage: 6, _isNew: true },
          { level_number: 3, percentage: 4, _isNew: true },
        ]);
      }
      if (partnersRes.data) {
        setPartners(partnersRes.data.map((p: any) => ({
          id: p.id,
          partner_user_id: p.partner_user_id,
          percentage: Number(p.percentage),
          active: p.active,
          notes: p.notes,
          _user: p.partner_users,
        })));
      }
      if (eligibleRes.data) setEligibleUsers(eligibleRes.data as any);
      setPlatformFee(Number((portalRes as any)?.data?.platform_fee_percentage) || 0);
    } catch (e: any) {
      toast.error("Error al cargar configuración MLM");
    } finally {
      setLoading(false);
    }
  };

  // ── Cálculos del modelo único ──
  const ibBudget = Math.max(0, 100 - platformFee);                 // el 100% del IB = 100 − fee
  const levelsSum = levels.reduce((acc, l) => acc + (Number(l.percentage) || 0), 0);
  const sociosSum = partners.filter(p => p.active).reduce((acc, p) => acc + Number(p.percentage), 0);
  const poolPct = Number(config.mlm_pool_percentage) || 0;
  // El residual del IB = lo que queda tras fee + pool + socios.
  const ibResidual = Math.max(0, 100 - platformFee - poolPct - sociosSum);
  const levelsValid = levelsSum <= poolPct + 1e-9;                 // Σniveles ≤ pool
  const allocationValid = (platformFee + poolPct + sociosSum) <= 100 + 1e-9; // queda ≥0 para el IB

  const handleAddLevel = () => {
    if (levels.length >= 10) return toast.error("Máximo 10 niveles");
    const next = (levels[levels.length - 1]?.level_number || 0) + 1;
    setLevels([...levels, { level_number: next, percentage: 0, _isNew: true }]);
  };

  const handleRemoveLevel = (idx: number) => {
    const newLevels = levels.filter((_, i) => i !== idx).map((l, i) => ({ ...l, level_number: i + 1 }));
    setLevels(newLevels);
    if (config.active_levels > newLevels.length) {
      setConfig({ ...config, active_levels: Math.max(1, newLevels.length) });
    }
  };

  const handleLevelChange = (idx: number, value: string) => {
    const num = parseFloat(value);
    const newLevels = [...levels];
    newLevels[idx].percentage = isNaN(num) ? 0 : num;
    setLevels(newLevels);
  };

  const handleSave = async () => {
    if (!levelsValid) {
      return toast.error(`La suma de niveles (${levelsSum.toFixed(2)}%) no puede superar el pool (${poolPct}%).`);
    }
    if (!allocationValid) {
      return toast.error(`Platform fee + pool + socios (${(platformFee + poolPct + sociosSum).toFixed(2)}%) no puede superar 100%.`);
    }
    setSaving(true);
    try {
      const { error: cfgErr } = await (supabase.rpc as any)("save_portal_mlm_settings", {
        _portal_id: portalId,
        _enabled: config.enabled,
        _active_levels: config.active_levels,
        _mlm_pool_percentage: config.mlm_pool_percentage,
        _refund_window_days: config.refund_window_days || 7,  // legacy; el motor no lo usa
        _orphan_policy: config.orphan_policy,
        _commission_mode: "pool",            // modelo único
        _business_partners_enabled: true,    // socios siempre considerados si existen
        _levels: levels.map((l) => ({ level_number: l.level_number, percentage: l.percentage })),
      });
      if (cfgErr) throw cfgErr;
      toast.success("Configuración MLM guardada");
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // ── Socios (business partners) ──
  const handleAddPartner = async () => {
    if (!newPartner.user_id) return toast.error("Selecciona un usuario");
    const pct = parseFloat(newPartner.pct);
    if (isNaN(pct) || pct <= 0 || pct > 100) return toast.error("% inválido (0-100)");
    if (platformFee + poolPct + sociosSum + pct > 100 + 1e-9) {
      return toast.error(`Suma excede 100% (fee ${platformFee}% + pool ${poolPct}% + socios ${sociosSum}% + ${pct}%)`);
    }
    setSavingPartner(true);
    try {
      const { error } = await supabase.from("portal_business_partners").insert({
        portal_id: portalId,
        partner_user_id: newPartner.user_id,
        percentage: pct,
        active: true,
        notes: newPartner.notes || null,
      });
      if (error) throw error;
      toast.success("Socio añadido");
      setAddPartnerOpen(false);
      setNewPartner({ user_id: "", pct: "", notes: "" });
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Error al añadir socio");
    } finally {
      setSavingPartner(false);
    }
  };

  const handleTogglePartner = async (id: string, active: boolean) => {
    const { error } = await supabase.from("portal_business_partners").update({ active }).eq("id", id);
    if (error) return toast.error(error.message);
    await loadData();
  };

  const handleDeletePartner = async (id: string) => {
    if (!confirm("¿Eliminar este socio?")) return;
    const { error } = await supabase.from("portal_business_partners").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Socio eliminado");
    await loadData();
  };

  const handleUpdatePartnerPct = async (id: string, pct: number) => {
    const { error } = await supabase.from("portal_business_partners").update({ percentage: pct }).eq("id", id);
    if (error) return toast.error(error.message);
    await loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const availableEligibleUsers = eligibleUsers.filter(
    u => !partners.some(p => p.partner_user_id === u.id)
  );

  return (
    <div className="space-y-6">
      {/* Master switch */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Network className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Sistema de comisiones (MLM)</CardTitle>
                <CardDescription className="mt-1">
                  Activa la red de comisiones de tu portal.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={config.enabled ? "default" : "secondary"} style={{ backgroundColor: config.enabled ? btnBg : undefined }}>
                {config.enabled ? "Activo" : "Inactivo"}
              </Badge>
              <Switch checked={config.enabled} onCheckedChange={(v) => setConfig({ ...config, enabled: v })} />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Resumen del reparto del 100% */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Percent className="w-4 h-4 text-primary" /> Reparto de cada venta (100%)</CardTitle>
          <CardDescription>{brandText(isWhiteLabel, "El Bullfy Platform Fee lo fija el administrador global; tú repartes el resto.")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="rounded-lg border border-border p-3">
              <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-1"><Building2 className="w-3 h-3" /> {brandText(isWhiteLabel, "Bullfy fee")}</div>
              <div className="text-lg font-bold text-foreground">{platformFee}%</div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-1"><Network className="w-3 h-3" /> Pool de red</div>
              <div className="text-lg font-bold text-foreground">{poolPct}%</div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-1"><Users2 className="w-3 h-3" /> Socios</div>
              <div className="text-lg font-bold text-foreground">{sociosSum}%</div>
            </div>
            <div className="rounded-lg border-2 border-primary/40 p-3">
              <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-1"><Crown className="w-3 h-3 text-yellow-500" /> Tú (IB)</div>
              <div className="text-lg font-bold text-primary">{ibResidual.toFixed(2)}%</div>
            </div>
          </div>
          {!allocationValid && (
            <Alert variant="destructive" className="mt-3">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                Fee + pool + socios suman {(platformFee + poolPct + sociosSum).toFixed(2)}% (&gt; 100%). Ajusta para que el IB no quede negativo.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="levels">
        <TabsList className="grid grid-cols-3 w-full max-w-xl">
          <TabsTrigger value="levels"><Settings2 className="w-4 h-4 mr-2" />Pool y Niveles</TabsTrigger>
          <TabsTrigger value="partners"><Users2 className="w-4 h-4 mr-2" />Socios</TabsTrigger>
          <TabsTrigger value="info"><Info className="w-4 h-4 mr-2" />Info</TabsTrigger>
        </TabsList>

        {/* ============ TAB: POOL & LEVELS ============ */}
        <TabsContent value="levels" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Percent className="w-4 h-4 text-primary" /> Pool de red</CardTitle>
              <CardDescription>% de la venta destinado a la red de referidos (se reparte por niveles del upline).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Porcentaje del pool</Label>
                <span className="text-2xl font-bold text-primary">{poolPct}%</span>
              </div>
              <Slider
                value={[poolPct]}
                min={0} max={ibBudget} step={1}
                onValueChange={([v]) => setConfig({ ...config, mlm_pool_percentage: v })}
              />
              <p className="text-xs text-muted-foreground">Máximo disponible (100% − fee): <strong>{ibBudget}%</strong></p>
            </CardContent>
          </Card>

          {/* Levels editor */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> Niveles y Comisiones</CardTitle>
                  <CardDescription>% de la venta por cada nivel del upline. La suma no debe superar el pool.</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={handleAddLevel} disabled={levels.length >= 10}>
                  <Plus className="w-4 h-4" /> Añadir nivel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Niveles activos:</Label>
                  <Input type="number" min={1} max={levels.length}
                    value={config.active_levels}
                    onChange={(e) => setConfig({ ...config, active_levels: Math.min(levels.length, Math.max(1, parseInt(e.target.value) || 1)) })}
                    className="w-20"
                  />
                  <span className="text-xs text-muted-foreground">de {levels.length}</span>
                </div>
                <Badge variant={levelsValid ? "default" : "destructive"}>
                  Suma niveles: {levelsSum.toFixed(2)}% / pool {poolPct}%
                </Badge>
              </div>

              <Separator />

              <div className="space-y-2">
                {levels.map((level, idx) => {
                  const isActive = level.level_number <= config.active_levels;
                  return (
                    <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg border ${isActive ? "bg-card border-border" : "bg-muted/30 border-dashed opacity-60"}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {level.level_number}
                      </div>
                      <Label className="flex-1">Nivel {level.level_number}</Label>
                      <Input type="number" min={0} max={100} step="0.01"
                        value={level.percentage}
                        onChange={(e) => handleLevelChange(idx, e.target.value)}
                        className="w-24 text-right"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                      <Button size="icon" variant="ghost"
                        onClick={() => handleRemoveLevel(idx)}
                        className="text-destructive hover:text-destructive"
                        disabled={levels.length <= 1}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              {!levelsValid && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    La suma de niveles ({levelsSum.toFixed(2)}%) supera el pool ({poolPct}%). El sobrante de niveles no se repartiría; ajusta los % o sube el pool.
                  </AlertDescription>
                </Alert>
              )}
              <p className="text-xs text-muted-foreground">
                Si la red de un comprador es más corta que los niveles configurados, el % no reclamado se suma al pot de socios (y al IB).
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ TAB: SOCIOS ============ */}
        <TabsContent value="partners" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Users2 className="w-4 h-4 text-primary" /> Socios del Portal</CardTitle>
              <CardDescription>
                Co-dueños del negocio del IB: reciben un % del total de cada venta. El IB (tú) recibe el residual.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant={allocationValid ? "default" : "destructive"}>
                  Asignado: fee {platformFee}% + pool {poolPct}% + socios {sociosSum}% → IB {ibResidual.toFixed(2)}%
                </Badge>
                <Button size="sm" variant="outline" onClick={() => setAddPartnerOpen(true)} disabled={availableEligibleUsers.length === 0}>
                  <Plus className="w-4 h-4" /> Añadir socio
                </Button>
              </div>

              {availableEligibleUsers.length === 0 && partners.length === 0 && (
                <Alert>
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription className="text-sm">
                    No hay usuarios elegibles. Pide al <strong>{brandText(isWhiteLabel, "administrador global (Bullfy)")}</strong> que habilite usuarios de tu portal como elegibles para ser socios.
                  </AlertDescription>
                </Alert>
              )}

              {/* Fila del IB (residual, no editable) */}
              <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-primary/30 bg-primary/5">
                <Crown className="w-4 h-4 text-yellow-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">Tú (IB) — residual</div>
                  <div className="text-xs text-muted-foreground">Recibe lo que queda tras fee, pool y socios (incluye el pool no reclamado).</div>
                </div>
                <span className="text-lg font-bold text-primary">{ibResidual.toFixed(2)}%</span>
              </div>

              <div className="space-y-2">
                {partners.map((p) => (
                  <div key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border ${p.active ? "bg-card" : "bg-muted/30 opacity-60"}`}>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p._user?.nombre || "—"}</div>
                      <div className="text-xs text-muted-foreground truncate">{p._user?.email}</div>
                    </div>
                    <Input
                      type="number" min={0} max={100} step="0.01"
                      defaultValue={p.percentage}
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v !== p.percentage) handleUpdatePartnerPct(p.id!, v);
                      }}
                      className="w-24 text-right"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                    <Switch checked={p.active} onCheckedChange={(v) => handleTogglePartner(p.id!, v)} />
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDeletePartner(p.id!)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ TAB: INFO ============ */}
        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cómo se reparte cada venta</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <p><strong className="text-foreground">1. {brandText(isWhiteLabel, "Bullfy Platform Fee")}</strong> — lo fija el administrador global por portal; se debita del 100%.</p>
              <p><strong className="text-foreground">2. Pool de red</strong> — % de la venta que se reparte por niveles del upline (con compresión: si un ancestro está inactivo, sube el siguiente). Lo no reclamado pasa a los socios.</p>
              <p><strong className="text-foreground">3. Socios</strong> — co-dueños que reciben su % de la venta.</p>
              <p><strong className="text-foreground">4. IB (tú)</strong> — recibes el residual (lo que quede). Siempre cuadra a 100%.</p>
              <Separator className="my-2" />
              <p className="flex items-start gap-2"><Wallet className="w-4 h-4 mt-0.5 text-primary shrink-0" /> Las comisiones se acreditan a la wallet del beneficiario: cripto (USDT) al instante; tarjeta (Stripe) queda pendiente hasta la validación de Stripe.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save bar */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border py-3 -mx-6 px-6 flex items-center justify-end gap-3">
        <span className="text-xs text-muted-foreground">{config.enabled ? "✅ MLM activo" : "⚠️ MLM inactivo"}</span>
        <Button onClick={handleSave} disabled={saving || !levelsValid || !allocationValid} style={{ backgroundColor: btnBg }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar configuración
        </Button>
      </div>

      {/* Add Partner Dialog */}
      <Dialog open={addPartnerOpen} onOpenChange={setAddPartnerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir socio del portal</DialogTitle>
            <DialogDescription>
              Solo se muestran usuarios del portal habilitados como elegibles por el administrador global.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Usuario</Label>
              <Select value={newPartner.user_id} onValueChange={(v) => setNewPartner({ ...newPartner, user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona un usuario..." /></SelectTrigger>
                <SelectContent>
                  {availableEligibleUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nombre} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>% sobre el total de la venta</Label>
              <Input type="number" min={0} max={100} step="0.01"
                value={newPartner.pct}
                onChange={(e) => setNewPartner({ ...newPartner, pct: e.target.value })}
                placeholder="Ej: 20"
              />
            </div>
            <div>
              <Label>Notas (opcional)</Label>
              <Input value={newPartner.notes}
                onChange={(e) => setNewPartner({ ...newPartner, notes: e.target.value })}
                placeholder="Ej: Socio fundador"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPartnerOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddPartner} disabled={savingPartner}>
              {savingPartner && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Añadir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MLMConfigAdmin;
