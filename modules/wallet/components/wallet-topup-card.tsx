"use client";

import { Button } from "@/components/ui/button";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { useState } from "react";

type WalletTopUpCardProps = {
  amountUsd: number;
};

export function WalletTopUpCard({ amountUsd }: WalletTopUpCardProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleTopUp() {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/wallet/topup/nowpayments", {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        invoiceUrl?: string;
      } | null;

      if (!response.ok || !payload?.invoiceUrl) {
        throw new Error(
          payload?.error ?? "No se pudo crear el invoice de pago.",
        );
      }

      window.location.assign(payload.invoiceUrl);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo iniciar la recarga.",
      );
      setIsLoading(false);
    }
  }

  return (
    <div className="rounded-md bg-black/24 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">
            Recarga USD / NOWPayments
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Sandbox crypto checkout
          </p>
        </div>
        <p className="t-mono text-xl font-black text-white">
          ${amountUsd.toFixed(2)}
        </p>
      </div>
      <Button
        className="polygon-shape mt-3 h-12 w-full justify-center rounded-none border-0 bg-transparent px-6 text-xs font-black uppercase tracking-[0.14em] text-[#061019] shadow-none [--polygon-bg:#00E5FF] hover:bg-transparent hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isLoading}
        onClick={handleTopUp}
        size="lg"
        type="button"
        variant="ghost"
      >
        {isLoading ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <ArrowUpRight aria-hidden="true" className="size-4" />
        )}
        {isLoading ? "Creando pago" : "Recargar wallet USD"}
      </Button>
      {error ? (
        <p className="mt-3 text-xs text-red-200">{error}</p>
      ) : null}
    </div>
  );
}
