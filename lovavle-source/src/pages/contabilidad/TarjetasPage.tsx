import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { CreditCard, Plus, Pencil, Trash2, Loader2 } from "lucide-react";

interface CardRow {
  id: string;
  user_id: string;
  card_type: "debit" | "credit";
  brand: string;
  bank: string | null;
  alias: string;
  last4: string;
  currency: string;
  credit_limit: number | null;
  is_active: boolean;
  notes: string | null;
}

interface ProfileOpt { id: string; nombre: string | null }

const BRANDS = [
  { v: "visa", l: "Visa" }, { v: "mastercard", l: "Mastercard" },
  { v: "amex", l: "Amex" }, { v: "other", l: "Otra" },
];

interface FormState {
  id?: string;
  user_id: string;
  card_type: "debit" | "credit";
  brand: string;
  bank: string;
  alias: string;
  last4: string;
  currency: string;
  credit_limit: string;
  is_active: boolean;
  notes: string;
}

const EMPTY: FormState = {
  user_id: "", card_type: "debit", brand: "visa", bank: "", alias: "",
  last4: "", currency: "USD", credit_limit: "", is_active: true, notes: "",
};

export default function TarjetasPage() {
  const [rows, setRows] = useState<CardRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState<string>("__all__");
  const [filterType, setFilterType] = useState<string>("__all__");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<CardRow | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: roles }, { data: allProfiles }] = await Promise.all([
      supabase.from("user_roles").select("user_id").eq("role", "accounting_user"),
      supabase.from("profiles").select("id,nombre").order("nombre"),
    ]);
    const accountingIds = new Set(roles?.map(r => r.user_id) ?? []);
    setProfiles((allProfiles ?? []).filter(p => accountingIds.has(p.id)) as ProfileOpt[]);
    const { data: c } = await supabase.from("accounting_cards").select("*").order("alias");
    setRows((c ?? []) as CardRow[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const nameOf = (uid: string) => {
    const p = profiles.find(x => x.id === uid);
    return p?.nombre ?? uid.slice(0, 8);
  };

  const openNew = () => { setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (r: CardRow) => {
    setForm({
      id: r.id, user_id: r.user_id, card_type: r.card_type, brand: r.brand,
      bank: r.bank ?? "", alias: r.alias, last4: r.last4, currency: r.currency,
      credit_limit: r.credit_limit?.toString() ?? "", is_active: r.is_active, notes: r.notes ?? "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.user_id) return toast({ title: "Selecciona un usuario", variant: "destructive" });
    if (!/^\d{4}$/.test(form.last4)) return toast({ title: "Últimos 4 dígitos inválidos", variant: "destructive" });
    if (!form.alias.trim()) return toast({ title: "Alias requerido", variant: "destructive" });

    setSaving(true);
    try {
      const payload: any = {
        user_id: form.user_id,
        card_type: form.card_type,
        brand: form.brand,
        bank: form.bank.trim() || null,
        alias: form.alias.trim(),
        last4: form.last4,
        currency: form.currency.trim() || "USD",
        credit_limit: form.card_type === "credit" && form.credit_limit ? Number(form.credit_limit) : null,
        is_active: form.is_active,
        notes: form.notes.trim() || null,
      };
      if (form.id) {
        const { error } = await supabase.from("accounting_cards").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        payload.created_by = u.user?.id;
        const { error } = await supabase.from("accounting_cards").insert(payload);
        if (error) throw error;
      }
      toast({ title: form.id ? "Tarjeta actualizada" : "Tarjeta creada" });
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    const { error } = await supabase.from("accounting_cards").delete().eq("id", confirmDel.id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Tarjeta eliminada" });
    setConfirmDel(null);
    await load();
  };

  const filtered = rows.filter(r =>
    (filterUser === "__all__" || r.user_id === filterUser) &&
    (filterType === "__all__" || r.card_type === filterType)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Tarjetas</h2>
            <p className="text-muted-foreground text-sm">
              Asigna tarjetas de débito o crédito a cada usuario para usarlas al cargar facturas/gastos.
            </p>
          </div>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nueva tarjeta</Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="min-w-[220px]">
          <Label className="text-xs">Filtrar por usuario</Label>
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los usuarios</SelectItem>
              {profiles.filter(p => p.nombre).map(p => (
                <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[180px]">
          <Label className="text-xs">Tipo</Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="debit">Débito</SelectItem>
              <SelectItem value="credit">Crédito</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <div className="p-6 text-muted-foreground">Cargando…</div> :
            filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No hay tarjetas con estos filtros.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Alias</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Marca</TableHead>
                    <TableHead>Banco</TableHead>
                    <TableHead>Últimos 4</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{nameOf(r.user_id)}</TableCell>
                      <TableCell>{r.alias}</TableCell>
                      <TableCell>
                        <Badge variant={r.card_type === "credit" ? "default" : "secondary"}>
                          {r.card_type === "credit" ? "Crédito" : "Débito"}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">{r.brand}</TableCell>
                      <TableCell>{r.bank ?? "—"}</TableCell>
                      <TableCell className="font-mono">****{r.last4}</TableCell>
                      <TableCell>{r.currency}</TableCell>
                      <TableCell>
                        {r.is_active
                          ? <Badge className="bg-emerald-500/20 text-emerald-500">Activa</Badge>
                          : <Badge variant="secondary">Inactiva</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="destructive" className="ml-2" onClick={() => setConfirmDel(r)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar tarjeta" : "Nueva tarjeta"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Usuario asignado *</Label>
              <Select value={form.user_id} onValueChange={(v) => setForm(f => ({ ...f, user_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  {profiles.filter(p => p.nombre).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Tipo *</Label>
                <Select value={form.card_type} onValueChange={(v) => setForm(f => ({ ...f, card_type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Débito</SelectItem>
                    <SelectItem value="credit">Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Marca</Label>
                <Select value={form.brand} onValueChange={(v) => setForm(f => ({ ...f, brand: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BRANDS.map(b => <SelectItem key={b.v} value={b.v}>{b.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Banco / Emisor</Label>
                <Input value={form.bank} onChange={(e) => setForm(f => ({ ...f, bank: e.target.value }))}
                  placeholder="Ej: Bancolombia" />
              </div>
              <div className="grid gap-1.5">
                <Label>Alias *</Label>
                <Input value={form.alias} onChange={(e) => setForm(f => ({ ...f, alias: e.target.value }))}
                  placeholder="Ej: Visa Personal" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Últimos 4 *</Label>
                <Input maxLength={4} inputMode="numeric" value={form.last4}
                  onChange={(e) => setForm(f => ({ ...f, last4: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                  placeholder="1234" className="font-mono" />
              </div>
              <div className="grid gap-1.5">
                <Label>Moneda</Label>
                <Input value={form.currency} onChange={(e) => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} maxLength={3} />
              </div>
              {form.card_type === "credit" && (
                <div className="grid gap-1.5">
                  <Label>Límite de crédito</Label>
                  <Input type="number" value={form.credit_limit}
                    onChange={(e) => setForm(f => ({ ...f, credit_limit: e.target.value }))} />
                </div>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>Notas</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))} />
              <Label className="cursor-pointer">Tarjeta activa</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Por seguridad, solo se guardan los últimos 4 dígitos. Nunca registres el número completo, CVV ni fecha de expiración.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar tarjeta?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se eliminará <strong>{confirmDel?.alias} ****{confirmDel?.last4}</strong>.
            Los gastos ya vinculados conservarán el registro histórico (referencia se vuelve nula).
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDel(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={doDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
