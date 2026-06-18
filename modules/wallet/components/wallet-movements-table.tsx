"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type {
  WalletCurrency,
  WalletMovement,
  WalletMovementStatus,
  WalletMovementType,
} from "../types";

type WalletMovementsTableProps = {
  emptyText: string;
  movements: WalletMovement[];
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("es-VE", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

const movementTypeLabel: Record<WalletMovementType, string> = {
  adjustment: "Ajuste",
  deposit: "Deposito",
  entryFee: "Entrada",
  points: "Puntos",
  reward: "Premio",
  withdrawal: "Retiro",
};

const statusLabel: Record<WalletMovementStatus, string> = {
  completed: "Completado",
  failed: "Fallido",
  pending: "Pendiente",
};

export function WalletMovementsTable({
  emptyText,
  movements,
}: WalletMovementsTableProps) {
  return (
    <Table className="min-w-[760px]">
      <TableHeader>
        <TableRow className="border-b border-cyan-300/10 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 hover:bg-transparent">
          <TableHead className="px-5 py-3">Tipo</TableHead>
          <TableHead className="px-5 py-3">Movimiento</TableHead>
          <TableHead className="px-5 py-3 text-right">Monto</TableHead>
          <TableHead className="px-5 py-3 text-right">Estado</TableHead>
          <TableHead className="px-5 py-3 text-right">Fecha</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {movements.length > 0 ? (
          movements.map((movement) => (
            <WalletMovementTableRow key={movement.id} movement={movement} />
          ))
        ) : (
          <TableRow className="border-t border-white/5 hover:bg-transparent">
            <TableCell
              className="px-5 py-10 text-center text-sm text-slate-500"
              colSpan={5}
            >
              {emptyText}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

function WalletMovementTableRow({ movement }: { movement: WalletMovement }) {
  const isPositive = movement.amount > 0;

  return (
    <TableRow className="group border-t border-white/5 text-slate-300 transition hover:bg-white/[0.035]">
      <TableCell className="px-5 py-3">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
          {movementTypeLabel[movement.type]}
        </p>
      </TableCell>
      <TableCell className="px-5 py-3">
        <p className="max-w-[24rem] truncate font-bold text-white">
          {movement.title}
        </p>
        <p className="mt-1 max-w-[28rem] truncate text-xs text-slate-500">
          {movement.description}
        </p>
      </TableCell>
      <TableCell
        className={cn(
          "t-mono px-5 py-3 text-right font-black",
          isPositive ? "text-[#B6FF3D]" : "text-[#FF514F]",
        )}
      >
        {formatMovementAmount(movement.amount, movement.currency)}
      </TableCell>
      <TableCell className="px-5 py-3 text-right">
        <span
          className={cn(
            "inline-flex px-2.5 py-1 text-[10px] font-black uppercase",
            movement.status === "completed" &&
              "bg-emerald-300/10 text-emerald-200",
            movement.status === "pending" &&
              "bg-amber-300/10 text-amber-200",
            movement.status === "failed" && "bg-red-300/10 text-red-200",
          )}
        >
          {statusLabel[movement.status]}
        </span>
      </TableCell>
      <TableCell className="t-mono px-5 py-3 text-right text-xs font-bold text-slate-500">
        {dateFormatter.format(new Date(movement.createdAt))}
      </TableCell>
    </TableRow>
  );
}

function formatMovementAmount(amount: number, currency: WalletCurrency) {
  const sign = amount > 0 ? "+" : "";

  if (currency === "BFP") {
    return `${sign}${compactFormatter.format(amount)} BP`;
  }

  if (currency === "DEMO") {
    return `${sign}${compactFormatter.format(amount)} BM$`;
  }

  return `${sign}$${moneyFormatter.format(amount)}`;
}
