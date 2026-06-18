import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  title?: string;
  description?: string;
  itemLabel?: string | null;
  busy?: boolean;
  minLength?: number;
  onCancel: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}

/**
 * Confirmation dialog that REQUIRES the user to type a reason before deleting.
 * The reason is passed back to the caller, which is responsible for persisting it
 * (e.g. into accounting_audit_log.before_data.deletion_reason).
 */
export default function DeleteWithReasonDialog({
  open,
  title = "¿Eliminar este registro?",
  description = "Esta acción es permanente. Debes indicar el motivo de la eliminación para dejar registro en Auditoría.",
  itemLabel,
  busy = false,
  minLength = 5,
  onCancel,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const trimmed = reason.trim();
  const valid = trimmed.length >= minLength;

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
            {itemLabel && (
              <span className="mt-2 block rounded-md bg-muted px-3 py-2 text-foreground font-medium">
                {itemLabel}
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="delete-reason">
            Motivo de la eliminación <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="delete-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: registro duplicado, capturado por error, factura anulada por el proveedor…"
            rows={4}
            disabled={busy}
            maxLength={500}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {valid
                ? "Listo para eliminar."
                : `Mínimo ${minLength} caracteres.`}
            </span>
            <span>{trimmed.length}/500</span>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={!valid || busy}
            onClick={(e) => {
              e.preventDefault();
              if (!valid || busy) return;
              onConfirm(trimmed);
            }}
          >
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
