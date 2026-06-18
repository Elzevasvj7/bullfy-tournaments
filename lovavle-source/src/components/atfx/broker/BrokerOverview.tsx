import { useMemo } from "react";
import { useATFX } from "@/hooks/useATFX";
import { extractRows, fmtUSD, fmtNum, sumField, pct, getPreviousRange } from "../utils";
import { toISO } from "../DateRangePicker";
import KPICard from "../KPICard";
import { TrendingUp, Users, ArrowDownToLine, ArrowUpFromLine, BarChart3 } from "lucide-react";
import type { DateRangeValue } from "../DateRangePicker";

interface Props { range: DateRangeValue }

export default function BrokerOverview({ range }: Props) {
  const prev = useMemo(() => getPreviousRange(range.from, range.to), [range.from, range.to]);
  const params = { date_from: toISO(range.from), date_to: toISO(range.to) };
  const prevParams = { date_from: toISO(prev.from), date_to: toISO(prev.to) };

  const dep = useATFX("list_transactions", { ...params, type: "deposit", status: "approved", limit: 1000 });
  const wd = useATFX("list_transactions", { ...params, type: "withdraw", status: "approved", limit: 1000 });
  const cust = useATFX("list_customers", { ...params, limit: 1000 });
  const vol = useATFX("report_volume", params);

  const depPrev = useATFX("list_transactions", { ...prevParams, type: "deposit", status: "approved", limit: 1000 });
  const wdPrev = useATFX("list_transactions", { ...prevParams, type: "withdraw", status: "approved", limit: 1000 });
  const custPrev = useATFX("list_customers", { ...prevParams, limit: 1000 });

  const depRows = extractRows(dep.data);
  const wdRows = extractRows(wd.data);
  const custRows = extractRows(cust.data);
  const volRows = extractRows(vol.data);

  const totalDep = sumField(depRows, "amount");
  const totalWd = sumField(wdRows, "amount");
  const totalCust = custRows.length;
  const totalVol = sumField(volRows, "volume");

  const totalDepPrev = sumField(extractRows(depPrev.data), "amount");
  const totalWdPrev = sumField(extractRows(wdPrev.data), "amount");
  const totalCustPrev = extractRows(custPrev.data).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard label="Depósitos" value={totalDep} prevValue={totalDepPrev} delta={pct(totalDep, totalDepPrev)} icon={ArrowDownToLine} iconColor="hsl(var(--primary))" loading={dep.isLoading} format={fmtUSD as any} />
      <KPICard label="Retiros" value={totalWd} prevValue={totalWdPrev} delta={pct(totalWd, totalWdPrev)} icon={ArrowUpFromLine} iconColor="hsl(var(--destructive))" loading={wd.isLoading} format={fmtUSD as any} />
      <KPICard label="Net flow" value={totalDep - totalWd} prevValue={totalDepPrev - totalWdPrev} delta={pct(totalDep - totalWd, totalDepPrev - totalWdPrev)} icon={TrendingUp} iconColor="hsl(var(--primary))" loading={dep.isLoading || wd.isLoading} format={fmtUSD as any} />
      <KPICard label="Nuevos clientes" value={totalCust} prevValue={totalCustPrev} delta={pct(totalCust, totalCustPrev)} icon={Users} iconColor="hsl(var(--primary))" loading={cust.isLoading} format={fmtNum as any} />
      <KPICard label="Volumen total (lots)" value={totalVol} icon={BarChart3} iconColor="hsl(var(--primary))" loading={vol.isLoading} format={fmtNum as any} />
    </div>
  );
}
