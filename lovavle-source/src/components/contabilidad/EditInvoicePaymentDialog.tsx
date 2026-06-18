import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import CardSelect from "@/components/contabilidad/CardSelect";

interface Props {
  open: boolean;
  invoiceId: string | null;
  onClose: () => void;
  onSaved?: () => void;
}

interface PayMethod { id: string; name: string }

const FUNDING_LABELS: Record<string, string> = {
  corporate_card: "Tarjeta corporativa",
  treasury_advance: "Adelanto de tesorería",
  own_money_reimbursable: "Dinero propio (reembolsable)",
};

export default function EditInvoicePaymentDialog({ open, invoiceId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [methods, setMethods] = useState<PayMethod[]>([]);
  const [hasExpense, setHasExpense] = useState(false);
  const [expenseId, setExpenseId] = useState<string | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<string>("__none__");
  const [fundingSource, setFundingSource] = useState<string>("__keep__");
  const [description, setDescription] = useState("");
  const [cardId, setCardId] = useState<string>("__none__");
  const [cardUserId, setCardUserId] = useState<string | null>(null);
  const [currentCardLabel, setCurrentCardLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !invoiceId) return;
    (async () => {
      setLoading(true);
      const [mRes, expRes, invRes] = await Promise.all([
        supabase.from("accounting_payment_methods").select("id,name").eq("is_active", true).order("name"),
        supabase.from("accounting_expenses")
          .select("id, payment_method_id, funding_source, description, user_id, card_id")
          .eq("invoice_id", invoiceId).maybeSingle(),
        supabase.from("accounting_invoices")
          .select("payment_method_id, notes, card_id, uploaded_by").eq("id", invoiceId).maybeSingle(),
      ]);
      setMethods((mRes.data ?? []) as PayMethod[]);
      let resolvedCardId: string | null = null;
      let resolvedUserId: string | null = null;
      if (expRes.data) {
        setHasExpense(true);
        setExpenseId(expRes.data.id);
        setPaymentMethodId(expRes.data.payment_method_id ?? "__none__");
        setFundingSource(expRes.data.funding_source ?? "__keep__");
        setDescription(expRes.data.description ?? "");
        resolvedCardId = (expRes.data as any).card_id ?? null;
        resolvedUserId = (expRes.data as any).user_id ?? null;
      } else {
        setHasExpense(false);
        setExpenseId(null);
        setPaymentMethodId(invRes.data?.payment_method_id ?? "__none__");
        setFundingSource("__keep__");
        setDescription(invRes.data?.notes ?? "");
        resolvedCardId = (invRes.data as any)?.card_id ?? null;
        resolvedUserId = (invRes.data as any)?.uploaded_by ?? null;
      }
      setCardUserId(resolvedUserId);
      setCardId(resolvedCardId ?? "__none__");
      if (resolvedCardId) {
        const { data: cd } = await supabase.from("accounting_cards")
          .select("alias,last4").eq("id", resolvedCardId).maybeSingle();
        setCurrentCardLabel(cd ? `${cd.alias} ****${cd.last4}` : null);
      } else setCurrentCardLabel(null);
      setLoading(false);
    })();
  }, [open, invoiceId]);

  const save = async () => {
    if (!invoiceId) return;
    setSaving(true);
    try {
      const pm = paymentMethodId === "__none__" ? null : paymentMethodId;
      const cId = cardId === "__none__" ? null : cardId;
      if (hasExpense && expenseId) {
        const upd: any = { payment_method_id: pm, description, card_id: cId };
        if (fundingSource !== "__keep__") upd.funding_source = fundingSource;
        const { error } = await supabase.from("accounting_expenses").update(upd).eq("id", expenseId);
        if (error) throw error;
        await supabase.from("accounting_invoices").update({ payment_method_id: pm, notes: description, card_id: cId }).eq("id", invoiceId);
      } else {
        const { error } = await supabase.from("accounting_invoices")
          .update({ payment_method_id: pm, notes: description, card_id: cId }).eq("id", invoiceId);
        if (error) throw error;
      }
      toast({ title: "Datos de pago actualizados" });
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Editar datos de pago</DialogTitle></DialogHeader>
        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Medio de pago</Label>
              <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin especificar —</SelectItem>
                  {methods.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {hasExpense && (
              <div>
                <Label>Origen de los fondos</Label>
                <Select value={fundingSource} onValueChange={setFundingSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__keep__">— Mantener actual —</SelectItem>
                    {Object.entries(FUNDING_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <CardSelect
              userId={cardUserId}
              value={cardId}
              onChange={setCardId}
              fallbackCardLabel={currentCardLabel}
            />
            <div>
              <Label>Descripción / motivo de la compra</Label>
              <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: Pago publicidad Meta — campaña noviembre" />
            </div>
            {!hasExpense && (
              <p className="text-xs text-muted-foreground">
                Esta factura aún no está aprobada. Los datos quedarán guardados y se aplicarán al gasto al aprobarla.
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
