import { useState, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Table as TableIcon } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export type ChartType = "bar" | "line" | "area" | "pie";

interface Props {
  title?: string;
  type?: ChartType;
  data: any[];
  xKey: string;
  yKeys: { key: string; label: string; color?: string }[];
  loading?: boolean;
  height?: number;
  tableSlot?: ReactNode;
  defaultView?: "chart" | "table";
}

const PALETTE = [
  "hsl(217 91% 60%)", "hsl(142 71% 45%)", "hsl(38 92% 50%)",
  "hsl(0 84% 60%)", "hsl(280 65% 60%)", "hsl(190 80% 50%)",
];

export default function ChartPanel({
  title, type = "bar", data, xKey, yKeys, loading, height = 280, tableSlot, defaultView = "chart",
}: Props) {
  const [view, setView] = useState<"chart" | "table">(defaultView);

  const renderChart = () => {
    if (loading) return <Skeleton className="w-full" style={{ height }} />;
    if (!data?.length) return (
      <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>
        Sin datos para graficar
      </div>
    );

    const tooltipStyle = {
      contentStyle: { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 },
      labelStyle: { color: "hsl(var(--foreground))" },
    };

    if (type === "pie") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={data} dataKey={yKeys[0].key} nameKey={xKey} cx="50%" cy="50%" outerRadius={Math.min(height / 2.5, 100)} label>
              {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    const Chart = type === "line" ? LineChart : type === "area" ? AreaChart : BarChart;
    return (
      <ResponsiveContainer width="100%" height={height}>
        <Chart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey={xKey} stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {yKeys.map((y, i) => {
            const color = y.color ?? PALETTE[i % PALETTE.length];
            if (type === "line") return <Line key={y.key} type="monotone" dataKey={y.key} name={y.label} stroke={color} strokeWidth={2} dot={false} />;
            if (type === "area") return <Area key={y.key} type="monotone" dataKey={y.key} name={y.label} stroke={color} fill={color} fillOpacity={0.25} />;
            return <Bar key={y.key} dataKey={y.key} name={y.label} fill={color} radius={[4, 4, 0, 0]} />;
          })}
        </Chart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm">{title ?? "Visualización"}</CardTitle>
        {tableSlot && (
          <div className="flex gap-1">
            <Button size="sm" variant={view === "chart" ? "default" : "ghost"} onClick={() => setView("chart")}>
              <BarChart3 className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant={view === "table" ? "default" : "ghost"} onClick={() => setView("table")}>
              <TableIcon className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {view === "chart" ? renderChart() : tableSlot}
      </CardContent>
    </Card>
  );
}
