import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Upload } from "lucide-react";

interface Props { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }

export default function NewTransferDialog({ open, onOpenChange, onCreated }: Props) {
  const [users, setUsers] = useState<{ id: string; nombre: string }[]>([]);
  const [currs, setCurrs] = useState<{ code: string; name: string }[]>([]);
  const [geos, setGeos] = useState<{ id: string; name: string }[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [proof, setProof] = useState<File | null>(null);
  const [form, setForm] = useState({
    recipient_user_id: "", amount_original: "", currency_original: "USD",
    transfer_date: new Date().toISOString().slice(0, 10),
    purpose: "", method: "", expected_category_id: "", geography_id: "", due_days: 30,
  });

  useEffect(() => {
    if (!open) return;
    (async () => {
      // Solo usuarios con rol "accounting_user" pueden ser destinatarios de tesorería
      const { data: roleRows } = await supabase
        .from("user_roles").select("user_id").eq("role", "accounting_user");
      const allowedUserIds = (roleRows ?? []).map((r: any) => r.user_id);

      const [u, c, g, ec] = await Promise.all([
        allowedUserIds.length
          ? supabase.from("profiles").select("id,nombre")
              .eq("status", "approved").in("id", allowedUserIds).order("nombre")
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("accounting_currencies").select("code,name").order("code"),
        supabase.from("accounting_geographies").select("id,name").eq("is_active", true).order("name"),
        supabase.from("accounting_expense_categories").select("id,name").eq("is_active", true).order("name"),
      ]);
      setUsers((u.data ?? []) as any);
      setCurrs((c.data ?? []) as any);
      setGeos((g.data ?? []) as any);
      setCats((ec.data ?? []) as any);
    })();
  }, [open]);

  const submit = async () => {
    if (!form.recipient_user_id || !form.amount_original || !form.purpose) {
      toast({ title: "Faltan datos", description: "Destinatario, monto y motivo son obligatorios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("No autenticado");

      let proof_url: string | null = null;
      let proof_uploaded_at: string | null = null;
      if (proof) {
        const path = `${u.user.id}/${Date.now()}_${proof.name}`;
        const up = await supabase.storage.from("accounting-treasury-proofs").upload(path, proof);
        if (up.error) throw up.error;
        const { data: pub } = supabase.storage.from("accounting-treasury-proofs").getPublicUrl(path);
        proof_url = pub.publicUrl;
        proof_uploaded_at = new Date().toISOString();
      }

      const { error } = await supabase.from("accounting_treasury_transfers").insert({
        sender_user_id: u.user.id,
        recipient_user_id: form.recipient_user_id,
        amount_original: Number(form.amount_original),
        currency_original: form.currency_original,
        transfer_date: form.transfer_date,
        purpose: form.purpose,
        method: form.method || null,
        expected_category_id: form.expected_category_id || null,
        geography_id: form.geography_id || null,
        due_days: form.due_days,
        sender_proof_url: proof_url,
        sender_proof_uploaded_at: proof_uploaded_at,
        status: proof_url ? "pending_recipient_receipt" : "pending_sender_proof",
      });
      if (error) throw error;
      toast({ title: "Transferencia creada" });
      onOpenChange(false);
      setProof(null);
      setForm({ ...form, amount_original: "", purpose: "", recipient_user_id: "" });
      onCreated();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nueva transferencia de tesorería</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Destinatario *</Label>
            <Select value={form.recipient_user_id} onValueChange={(v) => setForm({ ...form, recipient_user_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecciona usuario" /></SelectTrigger>
              <SelectContent>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Motivo / propósito *</Label>
            <Textarea value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              placeholder="Ej. Gastos viaje Dubai, compra de equipos…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monto *</Label>
              <Input type="number" step="0.01" value={form.amount_original}
                onChange={(e) => setForm({ ...form, amount_original: e.target.value })} />
            </div>
            <div>
              <Label>Moneda</Label>
              <Select value={form.currency_original} onValueChange={(v) => setForm({ ...form, currency_original: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{currs.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha de envío</Label>
              <Input type="date" value={form.transfer_date}
                onChange={(e) => setForm({ ...form, transfer_date: e.target.value })} />
            </div>
            <div>
              <Label>Plazo (días)</Label>
              <Input type="number" value={form.due_days}
                onChange={(e) => setForm({ ...form, due_days: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Método</Label>
              <Input value={form.method} placeholder="Bancolombia / USDT TRC20…"
                onChange={(e) => setForm({ ...form, method: e.target.value })} />
            </div>
            <div>
              <Label>Categoría esperada</Label>
              <Select value={form.expected_category_id} onValueChange={(v) => setForm({ ...form, expected_category_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Geografía</Label>
              <Select value={form.geography_id} onValueChange={(v) => setForm({ ...form, geography_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{geos.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Comprobante de envío (opcional, lo puedes subir después)</Label>
            <Input type="file" accept="image/*,application/pdf"
              onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
            {proof && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Upload className="h-3 w-3" />{proof.name}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Crear transferencia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
