import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import StatCard from "@/components/StatCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Clock, AlertCircle, CheckCircle2, TrendingUp, Inbox, Timer, UserCheck, AlertTriangle,
  BarChart3, Activity, Download, Loader2,
} from "lucide-react";
import { getLogoBase64, addLogoToHeader } from "@/services/pdfLogoHelper";
import { toast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

/* ───── types ───── */
interface RawItem {
  id: string;
  status: string;
  created_at: string;
  taken_at: string | null;
  completed_at: string | null;
  assigned_to: string | null;
  source: "queue" | "request" | "ib_externo";
}

interface Operator {
  id: string;
  nombre: string;
}

interface OperatorStats {
  id: string;
  nombre: string;
  total: number;
  completadas: number;
  enProceso: number;
  pendientes: number;
  avgTakeMs: number;
  avgResolveMs: number;
  avgTotalMs: number;
  slowestMs: number;
}

/* ───── helpers ───── */
const msToLabel = (ms: number): string => {
  if (ms <= 0) return "—";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) { const d = Math.floor(h / 24); return `${d}d ${h % 24}h`; }
  return `${h}h ${m}m`;
};

const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

const COLORS = [
  "hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--destructive))",
  "#6366f1", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6",
];

const SEMAPHORE = (ms: number) => {
  if (ms <= 0) return "default";
  const h = ms / 3_600_000;
  if (h < 4) return "default";       // green-ish
  if (h < 12) return "secondary";    // yellow-ish
  return "destructive";              // red
};

/* ───── component ───── */
const OpsEfficiencyReport = () => {
  const [items, setItems] = useState<RawItem[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [selectedOp, setSelectedOp] = useState("all");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [sourceFilter, setSourceFilter] = useState("all");

  /* ── fetch ── */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [q, r, ext, ops] = await Promise.all([
        supabase.from("ops_queue").select("id, status, created_at, taken_at, completed_at, assigned_to"),
        supabase.from("ops_requests").select("id, status, created_at, taken_at, completed_at, assigned_to, taken_by"),
        supabase.from("ib_external_requests").select("id, status, created_at, ops_taken_at, ops_completed_at, ops_assigned_to"),
        supabase.from("profiles").select("id, nombre").in("id",
          await supabase.from("user_roles").select("user_id").in("role", ["operaciones", "admin_operaciones"])
            .then(r => (r.data ?? []).map(x => x.user_id))
        ),
      ]);

      const mapped: RawItem[] = [
        ...(q.data ?? []).map(d => ({ id: d.id, status: d.status, created_at: d.created_at, taken_at: d.taken_at, completed_at: d.completed_at, assigned_to: d.assigned_to, source: "queue" as const })),
        ...(r.data ?? []).map(d => ({ id: d.id, status: d.status, created_at: d.created_at, taken_at: d.taken_at, completed_at: d.completed_at, assigned_to: d.assigned_to || d.taken_by, source: "request" as const })),
        ...(ext.data ?? []).map(d => ({
          id: d.id,
          status: d.status === "en_proceso_ops" ? "en_proceso" : d.status === "completado" || d.status === "rechazado" ? "configurado" : d.status,
          created_at: d.created_at,
          taken_at: d.ops_taken_at,
          completed_at: d.ops_completed_at,
          assigned_to: d.ops_assigned_to,
          source: "ib_externo" as const,
        })),
      ];

      setItems(mapped);
      setOperators(ops.data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  /* ── filtered items ── */
  const filtered = useMemo(() => {
    return items.filter(i => {
      const d = new Date(i.created_at);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
      if (selectedOp !== "all" && i.assigned_to !== selectedOp) return false;
      if (sourceFilter !== "all" && i.source !== sourceFilter) return false;
      return true;
    });
  }, [items, dateFrom, dateTo, selectedOp, sourceFilter]);

  /* ── global KPIs ── */
  const kpis = useMemo(() => {
    const withTaken = filtered.filter(i => i.taken_at);
    const withCompleted = filtered.filter(i => i.taken_at && i.completed_at);
    const nuevo = filtered.filter(i => ["nuevo", "submitted", "pendiente_bd", "aprobado_bd"].includes(i.status));
    const enProceso = filtered.filter(i => i.status === "en_proceso");
    const completado = filtered.filter(i => i.status === "configurado");

    const takeTimes = withTaken.map(i => new Date(i.taken_at!).getTime() - new Date(i.created_at).getTime());
    const resolveTimes = withCompleted.map(i => new Date(i.completed_at!).getTime() - new Date(i.taken_at!).getTime());
    const totalTimes = withCompleted.map(i => new Date(i.completed_at!).getTime() - new Date(i.created_at).getTime());

    const now = Date.now();
    const stale24h = nuevo.filter(i => (now - new Date(i.created_at).getTime()) > 86_400_000).length;

    return {
      total: filtered.length,
      nuevo: nuevo.length,
      enProceso: enProceso.length,
      completado: completado.length,
      avgTake: avg(takeTimes),
      avgResolve: avg(resolveTimes),
      avgTotal: avg(totalTimes),
      stale24h,
      completionRate: filtered.length ? Math.round((completado.length / filtered.length) * 100) : 0,
    };
  }, [filtered]);

  /* ── per-operator stats ── */
  const opStats: OperatorStats[] = useMemo(() => {
    return operators.map(op => {
      const mine = filtered.filter(i => i.assigned_to === op.id);
      const completed = mine.filter(i => i.status === "configurado");
      const enProceso = mine.filter(i => i.status === "en_proceso");
      const pendientes = mine.filter(i => ["nuevo", "submitted", "pendiente_bd", "aprobado_bd"].includes(i.status));

      const takeTimes = mine.filter(i => i.taken_at).map(i => new Date(i.taken_at!).getTime() - new Date(i.created_at).getTime());
      const resolveTimes = mine.filter(i => i.taken_at && i.completed_at).map(i => new Date(i.completed_at!).getTime() - new Date(i.taken_at!).getTime());
      const totalTimes = mine.filter(i => i.taken_at && i.completed_at).map(i => new Date(i.completed_at!).getTime() - new Date(i.created_at).getTime());

      return {
        id: op.id,
        nombre: op.nombre,
        total: mine.length,
        completadas: completed.length,
        enProceso: enProceso.length,
        pendientes: pendientes.length,
        avgTakeMs: avg(takeTimes),
        avgResolveMs: avg(resolveTimes),
        avgTotalMs: avg(totalTimes),
        slowestMs: totalTimes.length ? Math.max(...totalTimes) : 0,
      };
    }).sort((a, b) => b.total - a.total);
  }, [filtered, operators]);



  /* ── chart: operator comparison bars ── */
  const opComparisonData = useMemo(() =>
    opStats.filter(o => o.total > 0).map(o => ({
      nombre: o.nombre.split(" ")[0],
      "T. Toma (h)": +(o.avgTakeMs / 3_600_000).toFixed(1),
      "T. Resolución (h)": +(o.avgResolveMs / 3_600_000).toFixed(1),
    }))
  , [opStats]);

  /* ── chart: workload pie ── */
  const workloadPie = useMemo(() =>
    opStats.filter(o => o.total > 0).map(o => ({ name: o.nombre.split(" ")[0], value: o.total }))
  , [opStats]);

  /* ── chart: day-of-week heatmap ── */
  const dayVolume = useMemo(() => {
    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    filtered.forEach(i => { counts[new Date(i.created_at).getDay()]++; });
    return days.map((d, idx) => ({ dia: d, solicitudes: counts[idx] }));
  }, [filtered]);

  /* ── conclusions ── */
  const conclusions = useMemo(() => {
    const msgs: string[] = [];
    if (kpis.stale24h > 0) msgs.push(`⚠️ Hay ${kpis.stale24h} solicitud(es) sin tomar con más de 24 horas de antigüedad.`);

    const avgTeam = kpis.avgResolve;
    opStats.forEach(o => {
      if (o.completadas >= 3 && avgTeam > 0) {
        const ratio = o.avgResolveMs / avgTeam;
        if (ratio > 1.4) msgs.push(`🔴 ${o.nombre} tiene un tiempo de resolución ${Math.round((ratio - 1) * 100)}% superior al promedio del equipo.`);
        if (ratio < 0.6) msgs.push(`🟢 ${o.nombre} resuelve ${Math.round((1 - ratio) * 100)}% más rápido que el promedio del equipo.`);
      }
    });

    if (kpis.completionRate < 50 && kpis.total > 5) msgs.push(`⚠️ La tasa de completado es solo del ${kpis.completionRate}%. Revisar carga de trabajo.`);
    if (kpis.completionRate >= 80) msgs.push(`✅ Tasa de completado del ${kpis.completionRate}%. Buen rendimiento general.`);

    const peakDay = dayVolume.reduce((max, d) => d.solicitudes > max.solicitudes ? d : max, dayVolume[0]);
    if (peakDay.solicitudes > 0) msgs.push(`📊 Día con mayor carga: ${peakDay.dia} (${peakDay.solicitudes} solicitudes). Considerar refuerzo operativo.`);

    const avgTakeH = kpis.avgTake / 3_600_000;
    if (avgTakeH > 12) msgs.push(`🔴 Tiempo promedio de toma: ${msToLabel(kpis.avgTake)}. Supera las 12h — posible cuello de botella.`);
    else if (avgTakeH > 4) msgs.push(`🟡 Tiempo promedio de toma: ${msToLabel(kpis.avgTake)}. En rango aceptable pero mejorable.`);
    else if (kpis.avgTake > 0) msgs.push(`🟢 Tiempo promedio de toma: ${msToLabel(kpis.avgTake)}. Excelente capacidad de respuesta.`);

    if (msgs.length === 0) msgs.push("ℹ️ No hay suficientes datos para generar conclusiones en el rango seleccionado.");
    return msgs;
  }, [kpis, opStats, dayVolume]);

  /* ── PDF generation ── */
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const handleDownloadPdf = useCallback(async () => {
    setGeneratingPdf(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const logo = await getLogoBase64();

      const doc = new jsPDF("landscape", "mm", "a4");
      const pageW = doc.internal.pageSize.getWidth();

      // Brand palette
      const darkBlue: [number, number, number] = [6, 43, 99];     // #062B63
      const accentBlue: [number, number, number] = [20, 110, 245]; // #146EF5
      const green: [number, number, number] = [16, 185, 129];      // #10B981
      const amber: [number, number, number] = [245, 158, 11];      // #F59E0B
      const red: [number, number, number] = [239, 68, 68];         // #EF4444
      const grayText: [number, number, number] = [100, 113, 131];  // #A0B1BD-ish
      const lightBlueBg: [number, number, number] = [230, 242, 255]; // light fill
      const greenBg: [number, number, number] = [220, 252, 231];
      const amberBg: [number, number, number] = [254, 243, 199];
      const redBg: [number, number, number] = [254, 226, 226];
      let y = 8;

      // Header
      addLogoToHeader(doc, logo);
      doc.setDrawColor(...darkBlue);
      doc.setLineWidth(0.5);
      doc.line(14, 40, pageW - 14, 40);

      doc.setFontSize(16);
      doc.setTextColor(...darkBlue);
      doc.text("Reporte de Eficiencia Operativa", 14, 50);

      doc.setFontSize(9);
      doc.setTextColor(...grayText);
      doc.text(`Período: ${dateFrom} — ${dateTo}`, 14, 56);
      doc.text(`Operador: ${selectedOp === "all" ? "Todos" : operators.find(o => o.id === selectedOp)?.nombre ?? selectedOp}`, 14, 61);
      doc.text(`Generado: ${new Date().toLocaleString("es-ES")}`, pageW - 14, 56, { align: "right" });
      y = 68;

      // KPIs table — color-coded rows
      doc.setFontSize(11);
      doc.setTextColor(...darkBlue);
      doc.text("Indicadores Clave (KPIs)", 14, y);
      y += 3;

      const kpiRows = [
        { label: "Total Solicitudes", value: kpis.total.toString(), color: null },
        { label: "Pendientes", value: kpis.nuevo.toString(), color: kpis.nuevo > 0 ? amberBg : null },
        { label: "En Proceso", value: kpis.enProceso.toString(), color: lightBlueBg },
        { label: "Completadas", value: kpis.completado.toString(), color: greenBg },
        { label: "Tasa de Completado", value: `${kpis.completionRate}%`, color: kpis.completionRate >= 80 ? greenBg : kpis.completionRate >= 50 ? amberBg : redBg },
        { label: "T. Promedio de Toma", value: msToLabel(kpis.avgTake), color: kpis.avgTake / 3_600_000 > 12 ? redBg : kpis.avgTake / 3_600_000 > 4 ? amberBg : greenBg },
        { label: "T. Promedio de Resolución", value: msToLabel(kpis.avgResolve), color: null },
        { label: "T. Promedio Total", value: msToLabel(kpis.avgTotal), color: null },
        { label: "Sin tomar >24h", value: kpis.stale24h.toString(), color: kpis.stale24h > 0 ? redBg : greenBg },
      ];

      autoTable(doc, {
        startY: y,
        head: [["Métrica", "Valor"]],
        body: kpiRows.map(r => [r.label, r.value]),
        theme: "grid",
        headStyles: { fillColor: darkBlue, fontSize: 9, halign: "center", textColor: [255, 255, 255] },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 70 }, 1: { halign: "center" } },
        margin: { left: 14, right: 14 },
        didParseCell: (data: any) => {
          if (data.section === "body" && kpiRows[data.row.index]?.color) {
            data.cell.styles.fillColor = kpiRows[data.row.index].color;
          }
        },
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      // Operator detail table — semaphore cells colored
      if (opStats.length > 0) {
        if (y > 160) { doc.addPage(); y = 20; }
        doc.setFontSize(11);
        doc.setTextColor(...darkBlue);
        doc.text("Detalle por Operador", 14, y);
        y += 3;

        const semaphoreColor = (ms: number) => {
          if (ms <= 0) return null;
          const h = ms / 3_600_000;
          if (h < 4) return greenBg;
          if (h < 12) return amberBg;
          return redBg;
        };
        const semaphoreTextColor = (ms: number): [number, number, number] => {
          if (ms <= 0) return grayText;
          const h = ms / 3_600_000;
          if (h < 4) return [5, 120, 80];
          if (h < 12) return [146, 100, 0];
          return [180, 30, 30];
        };

        autoTable(doc, {
          startY: y,
          head: [["Operador", "Total", "Complet.", "En Proc.", "Pend.", "T. Toma", "T. Resol.", "T. Total", "Más lenta", "Semáforo"]],
          body: opStats.map(o => [
            o.nombre,
            o.total.toString(),
            o.completadas.toString(),
            o.enProceso.toString(),
            o.pendientes.toString(),
            msToLabel(o.avgTakeMs),
            msToLabel(o.avgResolveMs),
            msToLabel(o.avgTotalMs),
            msToLabel(o.slowestMs),
            o.avgResolveMs <= 0 ? "—" : o.avgResolveMs / 3_600_000 < 4 ? "VERDE" : o.avgResolveMs / 3_600_000 < 12 ? "AMARILLO" : "ROJO",
          ]),
          theme: "grid",
          headStyles: { fillColor: accentBlue, fontSize: 8, halign: "center", textColor: [255, 255, 255] },
          bodyStyles: { fontSize: 8 },
          margin: { left: 14, right: 14 },
          didParseCell: (data: any) => {
            if (data.section === "body" && data.column.index === 9) {
              const op = opStats[data.row.index];
              if (op) {
                const bg = semaphoreColor(op.avgResolveMs);
                if (bg) data.cell.styles.fillColor = bg;
                data.cell.styles.textColor = semaphoreTextColor(op.avgResolveMs);
                data.cell.styles.fontStyle = "bold";
              }
            }
          },
        });

        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // Day-of-week volume table — highlight peak day
      if (y > 160) { doc.addPage(); y = 20; }
      doc.setFontSize(11);
      doc.setTextColor(...darkBlue);
      doc.text("Volumen por Día de la Semana", 14, y);
      y += 3;

      const peakIdx = dayVolume.reduce((maxI, d, i, arr) => d.solicitudes > arr[maxI].solicitudes ? i : maxI, 0);

      autoTable(doc, {
        startY: y,
        head: [dayVolume.map(d => d.dia)],
        body: [dayVolume.map(d => d.solicitudes.toString())],
        theme: "grid",
        headStyles: { fillColor: darkBlue, fontSize: 9, halign: "center", textColor: [255, 255, 255] },
        bodyStyles: { fontSize: 9, halign: "center" },
        margin: { left: 14, right: 14 },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === peakIdx) {
            data.cell.styles.fillColor = amberBg;
            data.cell.styles.textColor = [146, 100, 0];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      y = (doc as any).lastAutoTable.finalY + 10;


      // Conclusions — use autoTable to avoid text rendering/overlap issues
      if (y > 150) { doc.addPage(); y = 20; }
      doc.setFontSize(11);
      doc.setTextColor(...darkBlue);
      doc.text("Conclusiones y Recomendaciones", 14, y);
      y += 5;

      const conclusionRows = conclusions.map(msg => {
        // Strip emoji for clean PDF text
        const clean = msg.replace(/^[🔴🟡🟢⚠️✅📊ℹ️]+\s*/, "").trim();
        let tipo = "Info";
        let bgColor: [number, number, number] | null = null;
        let txtColor: [number, number, number] = [40, 40, 40];
        if (msg.startsWith("🔴") || msg.startsWith("⚠️")) { tipo = "ALERTA"; bgColor = redBg; txtColor = [180, 30, 30]; }
        else if (msg.startsWith("🟡")) { tipo = "AVISO"; bgColor = amberBg; txtColor = [146, 100, 0]; }
        else if (msg.startsWith("🟢") || msg.startsWith("✅")) { tipo = "OK"; bgColor = greenBg; txtColor = [5, 120, 80]; }
        else if (msg.startsWith("📊")) { tipo = "DATO"; bgColor = lightBlueBg; txtColor = [20, 80, 180]; }
        return { tipo, clean, bgColor, txtColor };
      });

      autoTable(doc, {
        startY: y,
        head: [["Estado", "Detalle"]],
        body: conclusionRows.map(r => [r.tipo, r.clean]),
        theme: "grid",
        headStyles: { fillColor: darkBlue, fontSize: 9, halign: "center", textColor: [255, 255, 255] },
        bodyStyles: { fontSize: 8.5, cellPadding: 3 },
        columnStyles: { 0: { cellWidth: 22, halign: "center", fontStyle: "bold" }, 1: { cellWidth: undefined } },
        margin: { left: 14, right: 14 },
        didParseCell: (data: any) => {
          if (data.section === "body") {
            const row = conclusionRows[data.row.index];
            if (row) {
              if (row.bgColor) data.cell.styles.fillColor = row.bgColor;
              data.cell.styles.textColor = row.txtColor;
            }
          }
        },
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      // Footer
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        const ph = doc.internal.pageSize.getHeight();
        doc.setDrawColor(...darkBlue);
        doc.setLineWidth(0.3);
        doc.line(14, ph - 12, pageW - 14, ph - 12);
        doc.setFontSize(7);
        doc.setTextColor(...grayText);
        doc.text(`Bullfy — Reporte de Eficiencia Operativa`, 14, ph - 8);
        doc.text(`Página ${p} de ${totalPages}`, pageW - 14, ph - 8, { align: "right" });
      }

      doc.save(`Eficiencia_Ops_${dateFrom}_${dateTo}.pdf`);
    } catch (err: any) {
      toast({ title: "Error al generar PDF", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingPdf(false);
    }
  }, [kpis, opStats, dayVolume, conclusions, dateFrom, dateTo, selectedOp, operators]);

  if (loading) return <p className="text-muted-foreground py-8 text-center">Cargando reporte de eficiencia...</p>;

  return (
    <div className="space-y-6">
      {/* ── Filters ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 p-4 rounded-xl border border-border bg-card">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Operador</Label>
          <Select value={selectedOp} onValueChange={setSelectedOp}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los operadores</SelectItem>
              {operators.map(o => <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Desde</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Hasta</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tipo de solicitud</Label>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="queue">Cola de trabajo</SelectItem>
              <SelectItem value="request">Solicitudes</SelectItem>
              <SelectItem value="ib_externo">IB Externo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 flex flex-col justify-end">
          <Button
            onClick={handleDownloadPdf}
            disabled={generatingPdf}
            className="bg-gradient-gold text-primary-foreground gap-2"
          >
            {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Descargar PDF
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/30 dark:to-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400"><Inbox className="w-5 h-5" /><span className="text-xs font-medium">Total Solicitudes</span></div>
          <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{kpis.total}</p>
        </div>
        <div className={`rounded-xl border-2 p-4 space-y-1 ${kpis.avgTake / 3_600_000 > 12 ? 'border-red-200 bg-gradient-to-br from-red-50 to-white dark:from-red-950/30 dark:to-card' : kpis.avgTake / 3_600_000 > 4 ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-card' : 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-card'}`}>
          <div className={`flex items-center gap-2 ${kpis.avgTake / 3_600_000 > 12 ? 'text-red-600 dark:text-red-400' : kpis.avgTake / 3_600_000 > 4 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}><Timer className="w-5 h-5" /><span className="text-xs font-medium">T. Prom. Toma</span></div>
          <p className="text-2xl font-bold">{msToLabel(kpis.avgTake)}</p>
        </div>
        <div className="rounded-xl border-2 border-cyan-200 bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-950/30 dark:to-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400"><Clock className="w-5 h-5" /><span className="text-xs font-medium">T. Prom. Resolución</span></div>
          <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{msToLabel(kpis.avgResolve)}</p>
        </div>
        <div className="rounded-xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/30 dark:to-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400"><TrendingUp className="w-5 h-5" /><span className="text-xs font-medium">T. Prom. Total</span></div>
          <p className="text-2xl font-bold text-violet-700 dark:text-violet-300">{msToLabel(kpis.avgTotal)}</p>
        </div>
        <div className={`rounded-xl border-2 p-4 space-y-1 ${kpis.stale24h > 0 ? 'border-red-300 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/40 dark:to-card animate-pulse' : 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-card'}`}>
          <div className={`flex items-center gap-2 ${kpis.stale24h > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}><AlertTriangle className="w-5 h-5" /><span className="text-xs font-medium">Sin tomar &gt;24h</span></div>
          <p className="text-2xl font-bold">{kpis.stale24h}</p>
          <p className="text-[10px] opacity-70">{kpis.stale24h > 0 ? "⚠️ Requiere atención" : "✅ Todo al día"}</p>
        </div>
        <div className="rounded-xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/30 dark:to-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400"><AlertCircle className="w-5 h-5" /><span className="text-xs font-medium">Pendientes</span></div>
          <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{kpis.nuevo}</p>
        </div>
        <div className="rounded-xl border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/30 dark:to-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400"><Activity className="w-5 h-5" /><span className="text-xs font-medium">En Proceso</span></div>
          <p className="text-2xl font-bold text-sky-700 dark:text-sky-300">{kpis.enProceso}</p>
        </div>
        <div className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-5 h-5" /><span className="text-xs font-medium">Completadas</span></div>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{kpis.completado}</p>
        </div>
        <div className={`rounded-xl border-2 p-4 space-y-1 ${kpis.completionRate >= 80 ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-card' : kpis.completionRate >= 50 ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-card' : 'border-red-200 bg-gradient-to-br from-red-50 to-white dark:from-red-950/30 dark:to-card'}`}>
          <div className={`flex items-center gap-2 ${kpis.completionRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : kpis.completionRate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}><UserCheck className="w-5 h-5" /><span className="text-xs font-medium">Tasa Completado</span></div>
          <p className="text-2xl font-bold">{kpis.completionRate}%</p>
          <p className="text-[10px] opacity-70">{kpis.completionRate >= 80 ? "✅ Saludable" : "⚠️ Bajo"}</p>
        </div>
        <div className="rounded-xl border-2 border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-white dark:from-fuchsia-950/30 dark:to-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-fuchsia-600 dark:text-fuchsia-400"><BarChart3 className="w-5 h-5" /><span className="text-xs font-medium">Operadores activos</span></div>
          <p className="text-2xl font-bold text-fuchsia-700 dark:text-fuchsia-300">{opStats.filter(o => o.total > 0).length}</p>
        </div>
      </div>

      {/* ── Charts row 1 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Operator comparison bars */}
        <div className="rounded-xl border-2 border-cyan-100 dark:border-cyan-900/40 bg-gradient-to-br from-white to-cyan-50/50 dark:from-card dark:to-cyan-950/20 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">📊 Comparativa por operador (horas)</h3>
          {opComparisonData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={opComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cffafe" />
                <XAxis dataKey="nombre" fontSize={11} stroke="#0891b2" />
                <YAxis fontSize={11} stroke="#0891b2" unit="h" />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #a5f3fc", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="T. Toma (h)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="T. Resolución (h)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted-foreground text-center py-12">Sin datos suficientes</p>}
        </div>
      </div>

      {/* ── Charts row 2 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workload pie */}
        <div className="rounded-xl border-2 border-fuchsia-100 dark:border-fuchsia-900/40 bg-gradient-to-br from-white to-fuchsia-50/50 dark:from-card dark:to-fuchsia-950/20 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-fuchsia-700 dark:text-fuchsia-300">🥧 Distribución de carga de trabajo</h3>
          {workloadPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={workloadPie} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {workloadPie.map((_, i) => <Cell key={i} fill={["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#6366f1", "#ef4444", "#14b8a6"][i % 8]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #f0abfc", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted-foreground text-center py-12">Sin datos suficientes</p>}
        </div>

        {/* Day of week volume */}
        <div className="rounded-xl border-2 border-amber-100 dark:border-amber-900/40 bg-gradient-to-br from-white to-amber-50/50 dark:from-card dark:to-amber-950/20 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300">📅 Volumen por día de la semana</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dayVolume}>
              <CartesianGrid strokeDasharray="3 3" stroke="#fef3c7" />
              <XAxis dataKey="dia" fontSize={11} stroke="#d97706" />
              <YAxis fontSize={11} stroke="#d97706" />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #fcd34d", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="solicitudes" radius={[4, 4, 0, 0]}>
                {dayVolume.map((_, i) => <Cell key={i} fill={["#ef4444", "#f59e0b", "#10b981", "#06b6d4", "#8b5cf6", "#ec4899", "#6366f1"][i % 7]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Operator detail table ── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Detalle por operador</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operador</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Completadas</TableHead>
                <TableHead className="text-center">En Proceso</TableHead>
                <TableHead className="text-center">Pendientes</TableHead>
                <TableHead className="text-center">T. Prom. Toma</TableHead>
                <TableHead className="text-center">T. Prom. Resolución</TableHead>
                <TableHead className="text-center">T. Prom. Total</TableHead>
                <TableHead className="text-center">Más lenta</TableHead>
                <TableHead className="text-center">Semáforo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opStats.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No hay operadores con solicitudes</TableCell></TableRow>
              ) : opStats.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.nombre}</TableCell>
                  <TableCell className="text-center">{o.total}</TableCell>
                  <TableCell className="text-center">{o.completadas}</TableCell>
                  <TableCell className="text-center">{o.enProceso}</TableCell>
                  <TableCell className="text-center">{o.pendientes}</TableCell>
                  <TableCell className="text-center">{msToLabel(o.avgTakeMs)}</TableCell>
                  <TableCell className="text-center">{msToLabel(o.avgResolveMs)}</TableCell>
                  <TableCell className="text-center">{msToLabel(o.avgTotalMs)}</TableCell>
                  <TableCell className="text-center">{msToLabel(o.slowestMs)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={SEMAPHORE(o.avgResolveMs)}>
                      {o.avgResolveMs <= 0 ? "—" : o.avgResolveMs / 3_600_000 < 4 ? "🟢" : o.avgResolveMs / 3_600_000 < 12 ? "🟡" : "🔴"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Conclusions ── */}
      <div className="rounded-xl border-2 border-violet-100 dark:border-violet-900/40 bg-gradient-to-br from-white to-violet-50/50 dark:from-card dark:to-violet-950/20 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-2">
          <Activity className="w-4 h-4" /> Conclusiones y recomendaciones
        </h3>
        <ul className="space-y-2">
          {conclusions.map((msg, i) => (
            <li key={i} className={`text-sm leading-relaxed rounded-lg px-3 py-2 ${
              msg.startsWith("🔴") || msg.startsWith("⚠️") ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800" :
              msg.startsWith("🟡") ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800" :
              msg.startsWith("🟢") || msg.startsWith("✅") ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" :
              msg.startsWith("📊") ? "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800" :
              "bg-gray-50 dark:bg-gray-900/30 text-foreground/80 border border-gray-200 dark:border-gray-700"
            }`}>{msg}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default OpsEfficiencyReport;
