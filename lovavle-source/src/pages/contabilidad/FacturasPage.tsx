import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Upload, ScanLine, Loader2, Check, X, Trash2, ExternalLink, Wallet } from "lucide-react";
import EditInvoicePaymentDialog from "@/components/contabilidad/EditInvoicePaymentDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import InvoiceCropDialog from "@/components/contabilidad/InvoiceCropDialog";
import DeleteWithReasonDialog from "@/components/contabilidad/DeleteWithReasonDialog";
import ApproveInvoiceDialog from "@/components/contabilidad/ApproveInvoiceDialog";

interface Invoice {
  id: string; file_url: string; file_name: string | null;
  vendor_name: string | null; invoice_number: string | null;
  issue_date: string | null; currency_original: string | null;
  amount_original: number | null; status: string;
  ocr_confidence: number | null; created_at: string;
  uploaded_by: string | null;
  card_id: string | null;
}

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  uploaded: { label: "Subida", tone: "bg-muted" },
  pending_review: { label: "Pendiente revisión", tone: "bg-muted" },
  approved: { label: "Aprobada", tone: "bg-emerald-500/20 text-emerald-500" },
  rejected: { label: "Rechazada", tone: "bg-rose-500/20 text-rose-500" },
  linked: { label: "Vinculada", tone: "bg-blue-500/20 text-blue-500" },
};

const BUCKET = "accounting-invoices";

// extract storage path from a stored public URL like:
// https://xxx.supabase.co/storage/v1/object/public/accounting-invoices/<path>
const extractPath = (fileUrl: string): string | null => {
  const m = fileUrl.match(new RegExp(`/${BUCKET}/(.+)$`));
  return m?.[1] ? decodeURIComponent(m[1]) : null;
};

export default function FacturasPage() {
  const { isAdmin, isGlobalAdmin, isAccountant, user } = useAuth();
  const canManage = isAdmin || isGlobalAdmin || isAccountant;

  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Invoice | null>(null);
  const [approveTarget, setApproveTarget] = useState<Invoice | null>(null);
  const [editPayId, setEditPayId] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("accounting_invoices").select("*").order("created_at", { ascending: false }).limit(100);
    setRows((data ?? []) as Invoice[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openFile = async (r: Invoice) => {
    const path = extractPath(r.file_url);
    if (!path) {
      window.open(r.file_url, "_blank");
      return;
    }
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) {
      toast({ title: "No se pudo abrir el archivo", description: error?.message ?? "URL no disponible", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("No autenticado");
      const path = `${u.user.id}/${Date.now()}_${file.name}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { error } = await supabase.from("accounting_invoices").insert({
        uploaded_by: u.user.id,
        file_url: pub.publicUrl,
        file_name: file.name,
      });
      if (error) throw error;
      toast({ title: "Factura subida", description: "Lista para escanear con OCR." });
      await load();
    } catch (e: any) {
      toast({ title: "Error al subir", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const runOcr = async (id: string) => {
    setBusyId(id);
    try {
      const { data, error } = await supabase.functions.invoke("ocr-invoice", { body: { invoice_id: id } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "OCR falló");
      toast({ title: "OCR completado", description: `Confianza: ${Math.round((data.parsed?.confidence ?? 0) * 100)}%` });
      await load();
    } catch (e: any) {
      toast({ title: "Error OCR", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const rejectInvoice = async (r: Invoice) => {
    setBusyId(r.id);
    try {
      const { error } = await supabase.from("accounting_invoices").update({ status: "rejected" }).eq("id", r.id);
      if (error) throw error;
      await supabase.from("accounting_audit_log").insert({
        actor_user_id: user?.id ?? null,
        entity: "accounting_invoices",
        entity_id: r.id,
        action: "update",
        before_data: { status: r.status },
        after_data: { status: "rejected" },
      });
      toast({ title: "Factura rechazada" });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const doApprove = async (payload: {
    category_id: string; geography_id: string; user_id: string | null;
    cost_center_id: string | null; entity_id: string | null;
    description: string; expense_date: string;
    funding_source: "corporate_card" | "treasury_advance" | "own_money_reimbursable";
    payment_method_id: string | null;
    card_id: string | null;
  }) => {
    if (!approveTarget) return;
    setBusyId(approveTarget.id);
    try {
      const { error } = await (supabase as any).rpc("approve_invoice_to_expense", {
        p_invoice_id: approveTarget.id,
        p_category_id: payload.category_id,
        p_geography_id: payload.geography_id,
        p_user_id: payload.user_id,
        p_cost_center_id: payload.cost_center_id,
        p_entity_id: payload.entity_id,
        p_description: payload.description,
        p_expense_date: payload.expense_date,
        p_funding_source: payload.funding_source,
        p_payment_method_id: payload.payment_method_id,
        p_card_id: payload.card_id,
      });
      if (error) throw error;
      toast({ title: "Factura aprobada", description: "Gasto registrado en Reportes." });
      setApproveTarget(null);
      await load();
    } catch (e: any) {
      toast({ title: "Error al aprobar", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async (r: Invoice, reason: string) => {
    setBusyId(r.id);
    try {
      // Log BEFORE deletion so the audit trail survives even if storage cleanup fails.
      await supabase.from("accounting_audit_log").insert({
        actor_user_id: user?.id ?? null,
        entity: "accounting_invoices",
        entity_id: r.id,
        action: "delete",
        before_data: { ...(r as any), deletion_reason: reason },
        after_data: null,
      });
      const { error } = await supabase.from("accounting_invoices").delete().eq("id", r.id);
      if (error) throw error;
      const path = extractPath(r.file_url);
      if (path) await supabase.storage.from(BUCKET).remove([path]);
      toast({ title: "Factura eliminada", description: "Motivo registrado en Auditoría." });
      setConfirmDelete(null);
      await load();
    } catch (e: any) {
      toast({ title: "Error al eliminar", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Facturas / Tickets</h2>
          <p className="text-muted-foreground text-sm">Sube tickets y deja que la IA extraiga los datos.</p>
        </div>
        <div>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.type.startsWith("image/")) setCropFile(f);
              else onUpload(f);
            }} />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Subir factura
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <div className="p-6 text-muted-foreground">Cargando…</div> :
            rows.length === 0 ? <div className="p-6 text-center text-muted-foreground">Aún no hay facturas. Sube la primera.</div> : (
            <div className="divide-y">
              {rows.map((r) => (
                <div key={r.id} className="p-3 flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => openFile(r)}
                    className="text-sm font-medium hover:underline truncate max-w-[220px] inline-flex items-center gap-1 text-primary"
                    title="Abrir archivo"
                  >
                    {r.file_name ?? "archivo"}
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </button>
                  <Badge variant="secondary" className={STATUS_LABEL[r.status]?.tone ?? ""}>
                    {STATUS_LABEL[r.status]?.label ?? r.status}
                  </Badge>
                  <div className="text-xs text-muted-foreground flex-1 flex flex-wrap gap-3">
                    <span>{r.vendor_name ?? "—"}</span>
                    <span>{r.issue_date ?? "—"}</span>
                    <span>
                      {r.amount_original != null
                        ? `${Number(r.amount_original).toLocaleString()} ${r.currency_original ?? ""}`
                        : "—"}
                    </span>
                    {r.ocr_confidence != null && <span>conf {Math.round(r.ocr_confidence * 100)}%</span>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => runOcr(r.id)} disabled={busyId === r.id}>
                    {busyId === r.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ScanLine className="h-4 w-4 mr-1" />}
                    Escanear
                  </Button>
                  {canManage && (r.status === "pending_review" || r.status === "uploaded") && (
                    <>
                      <Button size="sm" variant="default" onClick={() => setApproveTarget(r)} disabled={busyId === r.id}
                        className="bg-emerald-600 hover:bg-emerald-700">
                        <Check className="h-4 w-4 mr-1" /> Aprobar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => rejectInvoice(r)} disabled={busyId === r.id}>
                        <X className="h-4 w-4 mr-1" /> Rechazar
                      </Button>
                    </>
                  )}
                  {canManage && (
                    <Button size="sm" variant="outline" onClick={() => setEditPayId(r.id)} disabled={busyId === r.id}>
                      <Wallet className="h-4 w-4 mr-1" /> Pago
                    </Button>
                  )}
                  {canManage && (
                    <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(r)} disabled={busyId === r.id}>
                      <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <InvoiceCropDialog
        open={!!cropFile}
        file={cropFile}
        onCancel={() => { setCropFile(null); if (fileRef.current) fileRef.current.value = ""; }}
        onConfirm={async (cropped) => { setCropFile(null); await onUpload(cropped); }}
      />


      <DeleteWithReasonDialog
        open={!!confirmDelete}
        title="¿Eliminar esta factura?"
        description="Esta acción es permanente. Se registrará en Auditoría con tu usuario, fecha, datos previos de la factura y el motivo."
        itemLabel={confirmDelete?.file_name ?? confirmDelete?.invoice_number ?? null}
        busy={!!confirmDelete && busyId === confirmDelete.id}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={(reason) => confirmDelete && doDelete(confirmDelete, reason)}
      />

      <ApproveInvoiceDialog
        open={!!approveTarget}
        invoice={approveTarget}
        busy={!!approveTarget && busyId === approveTarget.id}
        onCancel={() => setApproveTarget(null)}
        onConfirm={doApprove}
      />
      <EditInvoicePaymentDialog
        open={!!editPayId}
        invoiceId={editPayId}
        onClose={() => setEditPayId(null)}
        onSaved={load}
      />
    </div>
  );
}
