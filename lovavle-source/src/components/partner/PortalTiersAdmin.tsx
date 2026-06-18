// Gestión de NIVELES propios del IB (por portal). Controlado por el padre
// (PartnerTierManager) que es dueño del hook usePortalTiers, para que el
// selector de "cambiar nivel" del usuario y este CRUD compartan la misma data.
//
// El IB puede: crear, renombrar, describir, reordenar, activar/desactivar y
// eliminar niveles. El `slug` se genera una sola vez al crear y NO cambia al
// renombrar (así no se rompen los required_tiers[] ni partner_users.tier que ya
// lo referencian). El nivel base (is_default) no se puede desactivar ni borrar.

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/lib/toastUtils";
import { Plus, Edit, Trash2, Eye, EyeOff, ArrowUp, ArrowDown, Layers, Loader2 } from "lucide-react";
import type { PortalTier } from "@/hooks/usePortalTiers";

interface Props {
  portalId: string;
  tiers: PortalTier[];
  onChanged: () => void;
}

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "nivel";

const uniqueSlug = (base: string, existing: string[]): string => {
  if (!existing.includes(base)) return base;
  let i = 2;
  while (existing.includes(`${base}-${i}`)) i++;
  return `${base}-${i}`;
};

const PortalTiersAdmin = ({ portalId, tiers, onChanged }: Props) => {
  const [dialog, setDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

  const open = (t?: PortalTier) => {
    if (t) {
      setEditId(t.id);
      setForm({ name: t.name, description: t.description || "" });
    } else {
      setEditId(null);
      setForm({ name: "", description: "" });
    }
    setDialog(true);
  };

  const save = async () => {
    const name = form.name.trim();
    if (!name) { toast.error("El nombre del nivel es requerido"); return; }
    setSaving(true);
    try {
      if (editId) {
        // Renombrar/describir — el slug NO cambia.
        const { error } = await (supabase.from as any)("partner_tiers")
          .update({ name, description: form.description.trim() || null })
          .eq("id", editId);
        if (error) throw error;
        toast.success("Nivel actualizado");
      } else {
        const slug = uniqueSlug(slugify(name), tiers.map(t => t.slug));
        const maxOrder = tiers.reduce((m, t) => Math.max(m, t.sort_order), -1);
        const { error } = await (supabase.from as any)("partner_tiers").insert({
          portal_id: portalId,
          slug,
          name,
          description: form.description.trim() || null,
          sort_order: maxOrder + 1,
          is_default: false,
          active: true,
        });
        if (error) throw error;
        toast.success("Nivel creado");
      }
      setDialog(false);
      onChanged();
    } catch (e: any) {
      toast.error("Error: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (t: PortalTier) => {
    if (t.is_default && t.active) { toast.error("El nivel base no se puede desactivar"); return; }
    const { error } = await (supabase.from as any)("partner_tiers")
      .update({ active: !t.active }).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    onChanged();
  };

  const remove = async (t: PortalTier) => {
    if (t.is_default) { toast.error("El nivel base no se puede eliminar"); return; }
    if (!confirm(`¿Eliminar el nivel "${t.name}"? Los usuarios o recursos que lo usen quedarán sin ese nivel. Si solo quieres ocultarlo, mejor desactívalo.`)) return;
    const { error } = await (supabase.from as any)("partner_tiers").delete().eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Nivel eliminado");
    onChanged();
  };

  // Reordenar: intercambia sort_order con el vecino.
  const move = async (t: PortalTier, dir: -1 | 1) => {
    const ordered = [...tiers].sort((a, b) => a.sort_order - b.sort_order);
    const idx = ordered.findIndex(x => x.id === t.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= ordered.length) return;
    const other = ordered[swapIdx];
    await Promise.all([
      (supabase.from as any)("partner_tiers").update({ sort_order: other.sort_order }).eq("id", t.id),
      (supabase.from as any)("partner_tiers").update({ sort_order: t.sort_order }).eq("id", other.id),
    ]);
    onChanged();
  };

  const ordered = [...tiers].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" /> Niveles del portal
        </CardTitle>
        <Button size="sm" onClick={() => open()} className="gap-1.5"><Plus className="w-4 h-4" /> Nuevo nivel</Button>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          Crea tus propios niveles para filtrar el acceso a cursos, eventos, clases y streams. Las membresías venden estos niveles a tus usuarios.
        </p>
        <div className="space-y-1.5">
          {ordered.map((t, i) => (
            <div key={t.id} className={`flex items-center gap-3 p-2.5 rounded-md border ${t.active ? "border-border" : "border-dashed border-border/60 opacity-60"}`}>
              <div className="flex flex-col">
                <button disabled={i === 0} onClick={() => move(t, -1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button disabled={i === ordered.length - 1} onClick={() => move(t, 1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground">{t.name}</span>
                  {t.is_default && <Badge variant="secondary" className="text-xs">Base (gratis)</Badge>}
                  {!t.active && <Badge variant="outline" className="text-xs">Inactivo</Badge>}
                  <code className="text-[10px] text-muted-foreground/70 font-mono">{t.slug}</code>
                </div>
                {t.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.description}</p>}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" title={t.active ? "Desactivar" : "Activar"} onClick={() => toggleActive(t)}>
                {t.active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => open(t)}><Edit className="w-3.5 h-3.5" /></Button>
              {!t.is_default && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(t)}><Trash2 className="w-3.5 h-3.5" /></Button>
              )}
            </div>
          ))}
          {ordered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Aún no hay niveles.</p>
          )}
        </div>
      </CardContent>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Editar nivel" : "Nuevo nivel"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nombre</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Oro, Élite, Premium…" /></div>
            <div><Label>Descripción (opcional)</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Qué incluye este nivel" /></div>
            {editId && <p className="text-xs text-muted-foreground">Renombrar no afecta los recursos ni usuarios ya asignados a este nivel.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="gap-1.5">{saving && <Loader2 className="w-4 h-4 animate-spin" />}{editId ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default PortalTiersAdmin;
