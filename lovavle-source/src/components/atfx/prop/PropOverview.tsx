import { useMemo } from "react";
import { useATFX } from "@/hooks/useATFX";
import KPICard from "../KPICard";
import { extractRows, fmtUSD, fmtNum, sumField, pct, getPreviousRange } from "../utils";
import { toISO, type DateRangeValue } from "../DateRangePicker";
import { ShoppingCart, DollarSign, Users, Trophy } from "lucide-react";

interface Props { range: DateRangeValue }

export default function PropOverview({ range }: Props) {
  const prev = useMemo(() => getPreviousRange(range.from, range.to), [range.from, range.to]);
  const params = { date_from: toISO(range.from), date_to: toISO(range.to) };
  const prevParams = { date_from: toISO(prev.from), date_to: toISO(prev.to) };

  const ov = useATFX("prop_overview", params);
  const ovPrev = useATFX("prop_overview", prevParams);
  const sales = useATFX("prop_sales_summary", params);
  const payouts = useATFX("prop_payouts", params);
  const part = useATFX("list_participants", { ...params, limit: 1000 });

  const ovData = (ov.data?.data as any) ?? {};
  const ovPrevData = (ovPrev.data?.data as any) ?? {};
  const salesRows = extractRows(sales.data);
  const payoutRows = extractRows(payouts.data);
  const partRows = extractRows(part.data);

  const totalSales = sumField(salesRows, "count") || ovData.accounts_sold || partRows.length;
  const totalRevenue = sumField(salesRows, "revenue") || ovData.revenue || 0;
  const totalPayouts = sumField(payoutRows, "amount") || ovData.payouts || 0;
  const activeParticipants = partRows.filter(p => p.status === "active").length || ovData.active_participants || 0;

  const totalSalesPrev = (ovPrevData.accounts_sold as number) ?? 0;
  const totalRevenuePrev = (ovPrevData.revenue as number) ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard label="Cuentas vendidas" value={totalSales} prevValue={totalSalesPrev} delta={pct(totalSales, totalSalesPrev)} icon={ShoppingCart} iconColor="hsl(var(--primary))" loading={ov.isLoading} format={fmtNum as any} />
      <KPICard label="Ingresos" value={totalRevenue} prevValue={totalRevenuePrev} delta={pct(totalRevenue, totalRevenuePrev)} icon={DollarSign} iconColor="hsl(var(--primary))" loading={ov.isLoading} format={fmtUSD as any} />
      <KPICard label="Participantes activos" value={activeParticipants} icon={Users} iconColor="hsl(var(--primary))" loading={part.isLoading} format={fmtNum as any} />
      <KPICard label="Payouts del periodo" value={totalPayouts} icon={Trophy} iconColor="hsl(var(--primary))" loading={payouts.isLoading} format={fmtUSD as any} />
    </div>
  );
}
