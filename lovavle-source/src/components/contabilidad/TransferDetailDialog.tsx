import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Send, Paperclip, Link2, ExternalLink } from "lucide-react";

interface Note {
  id: string; author_user_id: string; note: string; attachment_url: string | null; created_at: string;
}
interface Transfer {
  id: string; sender_user_id: string; recipient_user_id: string; status: string;
  amount_original: number; currency_original: string; amount_usd: number | null;
  amount_justified_usd: number | null; transfer_date: string; purpose: string | null;
  method: string | null; sender_proof_url: string | null; due_days: number | null;
}
interface Expense {
  id: string; description: string | null; amount_original: number; currency_original: string;
  amount_usd: number | null; expense_date: string;
}
interface Linked {
  id: string; expense_id: string; amount_applied_usd: number;
  accounting_expenses: Expense | null;
}

export default function TransferDetailDialog({
  transferId, onClose, onChanged,
}: { transferId: string; onClose: () => void; onChanged: () => void }) {
  const [t, setT] = useState<Transfer | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [linked, setLinked] = useState<Linked[]>([]);
  const [myExpenses, setMyExpenses] = useState<Expense[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [noteText, setNoteText] = useState("");
  const [noteFile, setNoteFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkExpenseId, setLinkExpenseId] = useState("");
  const [linkAmount, setLinkAmount] = useState("");

  const reload = async () => {
    const [tr, nt, lk] = await Promise.all([
      supabase.from("accounting_treasury_transfers").select("*").eq("id", transferId).maybeSingle(),
      supabase.from("accounting_treasury_transfer_notes").select("*").eq("transfer_id", transferId).order("created_at", { ascending: true }),
      supabase.from("accounting_treasury_transfer_expenses")
        .select("id, expense_id, amount_applied_usd, accounting_expenses(id,description,amount_original,currency_original,amount_usd,expense_date)")
        .eq("transfer_id", transferId),
    ]);
    setT((tr.data ?? null) as Transfer | null);
    setNotes((nt.data ?? []) as Note[]);
    setLinked((lk.data ?? []) as any);
  };

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setUserId(u.user?.id ?? null);
      await reload();
      // load own expenses for linking
      const { data: exps } = await supabase
        .from("accounting_expenses").select("id,description,amount_original,currency_original,amount_usd,expense_date")
        .order("expense_date", { ascending: false }).limit(50);
      setMyExpenses((exps ?? []) as Expense[]);
      // realtime notes
      const ch = supabase.channel(`transfer-${transferId}`)
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "accounting_treasury_transfer_notes", filter: `transfer_id=eq.${transferId}` },
          (payload) => setNotes((prev) => [...prev, payload.new as Note]))
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferId]);

  useEffect(() => {
    if (!t) return;
    const ids = Array.from(new Set([t.sender_user_id, t.recipient_user_id, ...notes.map((n) => n.author_user_id)]));
    (async () => {
      const { data } = await supabase.from("profiles").select("id,nombre").in("id", ids);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { map[p.id] = p.nombre; });
      setProfiles(map);
    })();
  }, [t, notes]);

  const sendNote = async () => {
    if (!noteText.trim() && !noteFile) return;
    setBusy(true);
    try {
      let url: string | null = null;
      if (noteFile && userId) {
        const path = `${userId}/notes/${Date.now()}_${noteFile.name}`;
        const up = await supabase.storage.from("accounting-treasury-proofs").upload(path, noteFile);
        if (up.error) throw up.error;
        url = supabase.storage.from("accounting-treasury-proofs").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("accounting_treasury_transfer_notes").insert({
        transfer_id: transferId, author_user_id: userId, note: noteText || "(adjunto)", attachment_url: url,
      });
      if (error) throw error;
      setNoteText(""); setNoteFile(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const uploadSenderProof = async (file: File) => {
    if (!userId) return;
    setBusy(true);
    try {
      const path = `${userId}/proof/${Date.now()}_${file.name}`;
      const up = await supabase.storage.from("accounting-treasury-proofs").upload(path, file);
      if (up.error) throw up.error;
      const url = supabase.storage.from("accounting-treasury-proofs").getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.from("accounting_treasury_transfers").update({
        sender_proof_url: url, sender_proof_uploaded_at: new Date().toISOString(),
        status: "pending_recipient_receipt",
      }).eq("id", transferId);
      if (error) throw error;
      toast({ title: "Comprobante subido" });
      await reload(); onChanged();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const acknowledgeReceipt = async () => {
    setBusy(true);
    const { error } = await supabase.from("accounting_treasury_transfers").update({
      recipient_acknowledged_at: new Date().toISOString(),
    }).eq("id", transferId);
    setBusy(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Recepción confirmada" });
    await reload(); onChanged();
  };

  const linkExpense = async () => {
    if (!linkExpenseId || !linkAmount || !userId) return;
    setBusy(true);
    const { error } = await supabase.from("accounting_treasury_transfer_expenses").insert({
      transfer_id: transferId, expense_id: linkExpenseId,
      amount_applied_usd: Number(linkAmount), applied_by: userId,
    });
    setBusy(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setLinkExpenseId(""); setLinkAmount("");
    await reload(); onChanged();
  };

  const unlinkExpense = async (id: string) => {
    const { error } = await supabase.from("accounting_treasury_transfer_expenses").delete().eq("id", id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    await reload(); onChanged();
  };

  if (!t) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent><Loader2 className="h-6 w-6 animate-spin mx-auto" /></DialogContent>
      </Dialog>
    );
  }

  const isSender = userId === t.sender_user_id;
  const isRecipient = userId === t.recipient_user_id;
  const tot = Number(t.amount_usd ?? 0);
  const just = Number(t.amount_justified_usd ?? 0);
  const pct = tot > 0 ? Math.min(100, Math.round((just / tot) * 100)) : 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Transferencia <Badge variant="secondary">{t.status}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-muted-foreground">De</span><div>{profiles[t.sender_user_id] ?? "—"}</div></div>
            <div><span className="text-muted-foreground">Para</span><div>{profiles[t.recipient_user_id] ?? "—"}</div></div>
            <div><span className="text-muted-foreground">Fecha</span><div>{t.transfer_date}</div></div>
            <div><span className="text-muted-foreground">Plazo</span><div>{t.due_days ?? 30} días</div></div>
            <div className="col-span-2"><span className="text-muted-foreground">Motivo</span><div>{t.purpose}</div></div>
            <div><span className="text-muted-foreground">Monto</span><div>{Number(t.amount_original).toLocaleString()} {t.currency_original}</div></div>
            <div><span className="text-muted-foreground">USD</span><div className="font-semibold">${tot.toFixed(2)}</div></div>
          </div>

          <div className="space-y-1">
            <div className="text-sm flex justify-between"><span>Justificación N:N</span><span>${just.toFixed(2)} / ${tot.toFixed(2)} ({pct}%)</span></div>
            <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
          </div>

          {/* Sender proof */}
          <div className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">Comprobante de envío</div>
              {t.sender_proof_url && (
                <a href={t.sender_proof_url} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1">
                  Ver <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            {!t.sender_proof_url && isSender && (
              <Input type="file" accept="image/*,application/pdf" disabled={busy}
                onChange={(e) => e.target.files?.[0] && uploadSenderProof(e.target.files[0])} />
            )}
            {!t.sender_proof_url && !isSender && <p className="text-xs text-muted-foreground">Pendiente del emisor.</p>}
            {isRecipient && t.sender_proof_url && t.status === "pending_recipient_receipt" && (
              <Button size="sm" onClick={acknowledgeReceipt} disabled={busy}>Confirmar recepción</Button>
            )}
          </div>

          {/* Linked expenses (N:N) */}
          <div className="border rounded-lg p-3 space-y-3">
            <div className="font-semibold text-sm flex items-center gap-2"><Link2 className="h-4 w-4" />Gastos vinculados ({linked.length})</div>
            {linked.length === 0 && <p className="text-xs text-muted-foreground">Aún no se vinculan gastos a esta transferencia.</p>}
            {linked.map((l) => (
              <div key={l.id} className="flex items-center gap-2 text-sm border-b pb-2">
                <div className="flex-1 truncate">
                  {l.accounting_expenses?.description ?? "(gasto)"} · {l.accounting_expenses?.expense_date}
                </div>
                <span className="font-semibold">${Number(l.amount_applied_usd).toFixed(2)}</span>
                <Button size="sm" variant="ghost" onClick={() => unlinkExpense(l.id)}>×</Button>
              </div>
            ))}
            <div className="grid grid-cols-[1fr,140px,auto] gap-2 items-end pt-2">
              <div>
                <Label className="text-xs">Gasto</Label>
                <select value={linkExpenseId} onChange={(e) => setLinkExpenseId(e.target.value)}
                  className="w-full h-9 rounded-md border bg-background px-2 text-sm">
                  <option value="">Selecciona un gasto…</option>
                  {myExpenses.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.expense_date} · {e.description?.slice(0, 40) ?? "—"} · {Number(e.amount_original).toLocaleString()} {e.currency_original}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Monto USD aplicado</Label>
                <Input type="number" step="0.01" value={linkAmount}
                  onChange={(e) => setLinkAmount(e.target.value)} />
              </div>
              <Button onClick={linkExpense} disabled={busy || !linkExpenseId || !linkAmount}>Vincular</Button>
            </div>
          </div>

          {/* Notes chat */}
          <div className="border rounded-lg p-3 space-y-2">
            <div className="font-semibold text-sm">Notas (en tiempo real)</div>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {notes.length === 0 && <p className="text-xs text-muted-foreground">Sin notas aún.</p>}
              {notes.map((n) => {
                const mine = n.author_user_id === userId;
                return (
                  <div key={n.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg p-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <div className="text-[10px] opacity-70 mb-0.5">{profiles[n.author_user_id] ?? "—"} · {new Date(n.created_at).toLocaleString()}</div>
                      <div className="whitespace-pre-wrap">{n.note}</div>
                      {n.attachment_url && (
                        <a href={n.attachment_url} target="_blank" rel="noreferrer" className="text-xs underline flex items-center gap-1 mt-1">
                          <Paperclip className="h-3 w-3" /> Adjunto
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 items-end">
              <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)}
                placeholder="Escribe una nota…" className="min-h-[40px] flex-1" />
              <Input type="file" className="w-44" onChange={(e) => setNoteFile(e.target.files?.[0] ?? null)} />
              <Button onClick={sendNote} disabled={busy || (!noteText.trim() && !noteFile)} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
