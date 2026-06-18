import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toastUtils";
import { Loader2, FlaskConical } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portalId: string;
  userId: string;
  userName: string;
}

/**
 * Asignación de FONDOS DEMO a un partner_user (P7.4).
 * Llama al RPC SECURITY DEFINER admin_grant_demo_funds, que SOLO acredita el
 * wallet 'demo' (jamás dinero real) y exige rol admin/global_admin. La auditoría
 * queda en portal_demo_fund_grants.
 */
const GrantDemoFundsDialog = ({ open, onOpenChange, portalId, userId, userName }: Props) => {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return toast.error("Ingresa un monto mayor a 0");
    }
    setSubmitting(true);
    // Cast: el RPC nuevo aún no está en los tipos generados (se regeneran al
    // aplicar la migración). Evita romper el build por type-checking.
    const { data, error } = await (supabase.rpc as any)("admin_grant_demo_funds", {
      _portal_id: portalId,
      _user_id: userId,
      _amount: amt,
      _description: description.trim() || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(`Fondos demo asignados. Nuevo saldo demo: $${Number(data ?? 0).toFixed(2)}`);
    setAmount("");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-primary" /> Asignar fondos demo
          </DialogTitle>
          <DialogDescription>
            Acredita saldo <strong>demo</strong> (ficticio, no retirable como dinero real) al
            wallet de <strong>{userName}</strong>. Sirve para que pruebe el flujo de compra y
            comisiones sin mover dinero real.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="demo-amount">Monto (USD demo)</Label>
            <Input
              id="demo-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="100.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="demo-desc">Nota (opcional)</Label>
            <Input
              id="demo-desc"
              placeholder="Motivo de la asignación"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Asignar fondos demo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GrantDemoFundsDialog;
