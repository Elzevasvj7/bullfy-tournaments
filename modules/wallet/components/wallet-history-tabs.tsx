"use client";

import { useMemo, useState } from "react";
import type { WalletMovement } from "../types";
import { WalletMovementsTable } from "./wallet-movements-table";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type WalletHistoryTabsProps = {
  bmoneyMovements: WalletMovement[];
  usdMovements: WalletMovement[];
};

type HistoryTab = "usd" | "bmoney";

export function WalletHistoryTabs({
  bmoneyMovements,
  usdMovements,
}: WalletHistoryTabsProps) {
  const [activeTab, setActiveTab] = useState<HistoryTab>("usd");
  const movements = activeTab === "usd" ? usdMovements : bmoneyMovements;
  const emptyText =
    activeTab === "usd" ? "Sin movimientos USD." : "Sin movimientos BMoney.";
  const tabs = useMemo(
    () =>
      [
        { count: usdMovements.length, id: "usd", label: "USD" },
        { count: bmoneyMovements.length, id: "bmoney", label: "BMoney" },
      ] as const,
    [bmoneyMovements.length, usdMovements.length],
  );

  return (
    <section className="relative overflow-hidden">
      <Card>
        <CardContent>
        <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <h2 className="relative text-xs font-black uppercase tracking-[0.18em] text-slate-300">
            Historial
          </h2>
          <div className="polygon-shape grid grid-cols-2 gap-1.5 p-2 [--polygon-bg:#00000059]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={cn(
                  `polygon-shape px-5 py-2 text-xs font-black uppercase tracking-[0.14em] transition [--polygon-bg:transparent] hover:text-white hover:[--polygon-bg:#ffffff14]`,
                  activeTab === tab.id && "text-[#061019] [--polygon-bg:#00E5FF]",
                  activeTab === tab.id &&
                    activeTab === "bmoney" &&
                    "[--polygon-bg:#B6FF3D] text-[#061019]",
                )}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                <span className="block">
                  {tab.label} / {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
        <WalletMovementsTable emptyText={emptyText} movements={movements} />
        </CardContent>
      </Card>
    </section>
  );
}
