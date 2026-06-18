import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/lib/toastUtils";
import { Loader2, Plus, Trash2, Save, Layers, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: string;
  portalId: string;
  productTitle: string;
  productPrice: number;
  maxLevels?: number;
}

interface LevelRow {
  id?: string;
  level_number: number;
  percentage: number;
  _new?: boolean;
}

const ProductCommissionLevelsDialog = ({
  open, onOpenChange, productId, portalId, productTitle, productPrice, maxLevels = 10,
}: Props) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [levels, setLevels] = useState<LevelRow[]>([]);

  useEffect(() => {
    if (open) load();
  }, [open, productId]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("portal_product_commission_levels")
      .select("*")
      .eq("product_id", productId)
      .order("level_number");
    setLevels(
      (data ?? []).map((r: any) => ({
        id: r.id, level_number: r.level_number, percentage: Number(r.percentage),
      }))
    );
    setLoading(false);
  };

  const sum = levels.reduce((a, l) => a + (Number(l.percentage) || 0), 0);
  const sumValid = sum <= 100;

  const addLevel = () => {
    if (levels.length >= maxLevels) return toast.error(`Máximo ${maxLevels} niveles`);
    const next = (levels[levels.length - 1]?.level_number || 0) + 1;
    setLevels([...levels, { level_number: next, percentage: 0, _new: true }]);
  };

  const removeLevel = (idx: number) => {
    const next = levels.filter((_, i) => i !== idx).map((l, i) => ({ ...l, level_number: i + 1 }));
    setLevels(next);
  };

  const updatePct = (idx: number, val: string) => {
    const v = parseFloat(val);
    const next = [...levels];
    next[idx].percentage = isNaN(v) ? 0 : v;
    setLevels(next);
  };

  const save = async () => {
    if (!sumValid) return toast.error(`Suma supera 100% (actual: ${sum.toFixed(2)}%)`);
    setSaving(true);
    try {
      // Wipe & re-insert (atomic-ish)
      const { error: delErr } = await supabase
        .from("portal_product_commission_levels")
        .delete()
        .eq("product_id", productId);
      if (delErr) throw delErr;

      if (levels.length > 0) {
        const payload = levels.map(l => ({
          product_id: productId,
          portal_id: portalId,
          level_number: l.level_number,
          percentage: l.percentage,
        }));
        const { error: insErr } = await supabase
          .from("portal_product_commission_levels")
          .insert(payload);
        if (insErr) throw insErr;
      }
      toast.success("Comisiones del producto guardadas");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" /> Comisiones MLM por nivel
          </DialogTitle>
          <DialogDescription>
            Producto: <strong>{productTitle}</strong> — Precio: <strong>${productPrice}</strong>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant={sumValid ? "default" : "destructive"}>
                Suma: {sum.toFixed(2)}% / 100%
              </Badge>
              <Button size="sm" variant="outline" onClick={addLevel} disabled={levels.length >= maxLevels}>
                <Plus className="w-4 h-4" /> Nivel
              </Button>
            </div>

            <Separator />

            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {levels.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Sin niveles configurados. Añade el primero.
                </p>
              )}
              {levels.map((l, idx) => {
                const earn = +(productPrice * l.percentage / 100).toFixed(2);
                return (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-primary text-primary-foreground">
                      {l.level_number}
                    </div>
                    <Label className="flex-1">Nivel {l.level_number}</Label>
                    <Input type="number" min={0} max={100} step="0.01"
                      value={l.percentage}
                      onChange={(e) => updatePct(idx, e.target.value)}
                      className="w-24 text-right" />
                    <span className="text-sm text-muted-foreground">%</span>
                    <span className="text-xs text-muted-foreground w-16 text-right">${earn}</span>
                    <Button size="icon" variant="ghost" className="text-destructive"
                      onClick={() => removeLevel(idx)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>

            {!sumValid && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>La suma supera 100%.</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !sumValid}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProductCommissionLevelsDialog;
