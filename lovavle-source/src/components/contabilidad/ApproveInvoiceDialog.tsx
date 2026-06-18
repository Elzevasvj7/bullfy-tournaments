import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import CardSelect from "@/components/contabilidad/CardSelect";

interface Opt { id: string; name: string; }
interface PayOpt { id: string; name: string; kind: string; }
interface UserOpt { id: string; nombre: string | null; }

interface Props {
  open: boolean;
  invoice: {
    id: string;
    vendor_name: string | null;
    invoice_number: string | null;
    amount_original: number | null;
    currency_original: string | null;
    issue_date: string | null;
    card_id?: string | null;
  } | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (payload: {
    category_id: string;
    geography_id: string;
    user_id: string | null;
    cost_center_id: string | null;
    entity_id: string | null;
    description: string;
    expense_date: string;
    funding_source: "corporate_card" | "treasury_advance" | "own_money_reimbursable";
    payment_method_id: string | null;
    card_id: string | null;
  }) => void;
}

export default function ApproveInvoiceDialog({ open, invoice, busy, onCancel, onConfirm }: Props) {
  const [cats, setCats] = useState<Opt[]>([]);
  const [geos, setGeos] = useState<Opt[]>([]);
  const [centers, setCenters] = useState<Opt[]>([]);
  const [entities, setEntities] = useState<Opt[]>([]);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [payMethods, setPayMethods] = useState<PayOpt[]>([]);
  const [currencies, setCurrencies] = useState<string[]>([]);

  const [categoryId, setCategoryId] = useState<string>("");
  const [geographyId, setGeographyId] = useState<string>("");
  const [userId, setUserId] = useState<string>("__none__");
  const [costCenterId, setCostCenterId] = useState<string>("__none__");
  const [entityId, setEntityId] = useState<string>("__none__");
  const [description, setDescription] = useState<string>("");
  const [expenseDate, setExpenseDate] = useState<string>("");
  const [fundingSource, setFundingSource] = useState<"corporate_card" | "treasury_advance" | "own_money_reimbursable">("corporate_card");
  const [paymentMethodId, setPaymentMethodId] = useState<string>("__none__");
  const [cardId, setCardId] = useState<string>("__none__");
  const [currency, setCurrency] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: roleRows } = await supabase
        .from("user_roles").select("user_id").eq("role", "accounting_user");
      const allowedIds = (roleRows ?? []).map((r: any) => r.user_id);
      const [c, g, cc, en, u, pm, cu] = await Promise.all([
        supabase.from("accounting_expense_categories").select("id,name").order("name"),
        supabase.from("accounting_geographies").select("id,name").order("name"),
        supabase.from("accounting_cost_centers").select("id,name").order("name"),
        supabase.from("accounting_entities").select("id,name").order("name"),
        allowedIds.length
          ? supabase.from("profiles").select("id,nombre").in("id", allowedIds).order("nombre")
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("accounting_payment_methods").select("id,name,kind").eq("is_active", true).order("name"),
        supabase.from("accounting_currencies").select("code").order("code"),
      ]);
      setCats((c.data ?? []) as Opt[]);
      setGeos((g.data ?? []) as Opt[]);
      setCenters((cc.data ?? []) as Opt[]);
      setEntities((en.data ?? []) as Opt[]);
      setUsers(((u.data ?? []) as UserOpt[]).filter((r) => r.nombre));
      setPayMethods((pm.data ?? []) as PayOpt[]);
      setCurrencies(((cu.data ?? []) as { code: string }[]).map(r => r.code));
    })();
  }, [open]);

  useEffect(() => {
    if (!invoice) return;
    setDescription(`Factura ${invoice.invoice_number ?? "—"} / ${invoice.vendor_name ?? "proveedor"}`);
    setExpenseDate(invoice.issue_date ?? new Date().toISOString().slice(0, 10));
    setCategoryId("");
    setGeographyId("");
    setUserId("__none__");
    setCostCenterId("__none__");
    setEntityId("__none__");
    setPaymentMethodId("__none__");
    setCardId(invoice.card_id ?? "__none__");
    setCurrency(invoice.currency_original ?? "");
  }, [invoice]);

  const needsCurrency = !invoice?.currency_original;
  const valid = !!categoryId && !!geographyId && !!description.trim() && !!expenseDate && !!currency;

  const handleConfirm = async () => {
    if (!invoice) return;
    setSaving(true);
    try {
      if (needsCurrency && currency) {
        const { error } = await supabase.from("accounting_invoices")
          .update({ currency_original: currency }).eq("id", invoice.id);
        if (error) throw error;
      }
      onConfirm({
        category_id: categoryId,
        geography_id: geographyId,
        user_id: userId === "__none__" ? null : userId,
        cost_center_id: costCenterId === "__none__" ? null : costCenterId,
        entity_id: entityId === "__none__" ? null : entityId,
        description: description.trim(),
        expense_date: expenseDate,
        funding_source: fundingSource,
        payment_method_id: paymentMethodId === "__none__" ? null : paymentMethodId,
        card_id: cardId === "__none__" ? null : cardId,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Aprobar factura y registrar gasto</DialogTitle>
          <DialogDescription>
            {invoice
              ? `${invoice.vendor_name ?? "—"} · ${Number(invoice.amount_original ?? 0).toLocaleString()} ${invoice.currency_original ?? ""}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Categoría *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {cats.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Geografía *</Label>
              <Select value={geographyId} onValueChange={setGeographyId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {geos.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Usuario responsable</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin usuario —</SelectItem>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Centro de costo</Label>
              <Select value={costCenterId} onValueChange={setCostCenterId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin centro —</SelectItem>
                  {centers.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Entidad</Label>
              <Select value={entityId} onValueChange={setEntityId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin entidad —</SelectItem>
                  {entities.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Fecha del gasto *</Label>
              <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Origen del pago *</Label>
              <Select value={fundingSource} onValueChange={(v) => setFundingSource(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corporate_card">Tarjeta corporativa</SelectItem>
                  <SelectItem value="treasury_advance">Adelanto de tesorería</SelectItem>
                  <SelectItem value="own_money_reimbursable">Dinero propio (a reembolsar)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Medio de pago</Label>
              <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin especificar —</SelectItem>
                  {payMethods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} <span className="text-xs text-muted-foreground">· {p.kind}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {fundingSource === "own_money_reimbursable" && (
            <p className="text-xs text-amber-500">
              Este gasto quedará marcado como pendiente de reembolso al usuario responsable.
            </p>
          )}

          <CardSelect
            userId={userId === "__none__" ? null : userId}
            value={cardId}
            onChange={setCardId}
            label="Tarjeta usada (del usuario responsable)"
          />

          <div className="grid gap-1.5">
            <Label>Descripción / motivo de la compra *</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="¿Para qué fue este gasto? (ej: licencias software equipo marketing Q1)"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Moneda * {needsCurrency && <span className="text-xs text-amber-500 font-normal">(OCR no detectó la moneda, selecciónala)</span>}</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {currencies.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy || saving}>Cancelar</Button>
          <Button
            disabled={!valid || busy || saving}
            onClick={handleConfirm}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {(busy || saving) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Aprobar y registrar gasto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
