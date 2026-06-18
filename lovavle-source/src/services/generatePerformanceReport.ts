import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { OnboardingFormData } from "@/stores/onboardingStore";

const BRAND = {
  darkBlue: [6, 43, 99] as [number, number, number],
  blue: [20, 110, 245] as [number, number, number],
  lightBlue: [131, 203, 255] as [number, number, number],
  gray: [160, 177, 189] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  green: [34, 197, 94] as [number, number, number],
};

const PROPFIRM_PRICES: Record<string, number> = {
  "1 Fase - $5,000": 54, "1 Fase - $10,000": 113, "1 Fase - $25,000": 232,
  "1 Fase - $50,000": 422, "1 Fase - $100,000": 649, "1 Fase - $200,000": 1190,
  "2 Fases - $5,000": 45, "2 Fases - $10,000": 95, "2 Fases - $25,000": 195,
  "2 Fases - $50,000": 355, "2 Fases - $100,000": 545, "2 Fases - $200,000": 1000,
  "InstaFunded - $500": 45, "InstaFunded - $1,000": 85, "InstaFunded - $5,000": 415,
  "InstaFunded - $10,000": 800, "InstaFunded - $25,000": 1900, "InstaFunded - $50,000": 3700,
};

function addHeader(doc: jsPDF, title: string, logo?: string | null) {
  doc.setDrawColor(...BRAND.blue);
  doc.setLineWidth(0.8);
  doc.line(15, 28, 195, 28);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.darkBlue);
  doc.text(title, 15, 18);
  if (logo) { try { doc.addImage(logo, "PNG", 120, 2, 75, 36); } catch {} }
}

function addSectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setFillColor(...BRAND.darkBlue);
  doc.rect(15, y, 180, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.white);
  doc.text(title.toUpperCase(), 20, y + 5.5);
  return y + 12;
}

function addRow(doc: jsPDF, y: number, label: string, value: string, isAlt = false): number {
  if (isAlt) { doc.setFillColor(240, 244, 248); doc.rect(15, y - 3.5, 180, 7, "F"); }
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  doc.text(label, 20, y);
  doc.setFont("helvetica", "bold"); doc.setTextColor(20, 20, 20);
  doc.text(value, 110, y);
  return y + 7;
}

function cpb(doc: jsPDF, y: number, needed: number, logo?: string | null): number {
  if (y + needed > 275) { doc.addPage(); addHeader(doc, "IB Performance Report — Continued", logo); return 45; }
  return y;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function drawBarChart(doc: jsPDF, x: number, y: number, w: number, h: number, data: { label: string; value: number }[], title: string) {
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...BRAND.darkBlue);
  doc.text(title, x, y - 3);
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barW = (w - (data.length - 1) * 3) / data.length;
  const chartBottom = y + h;
  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3); doc.line(x, chartBottom, x + w, chartBottom);
  data.forEach((d, i) => {
    const barH = (d.value / maxVal) * (h - 5);
    const barX = x + i * (barW + 3);
    const barY = chartBottom - barH;
    doc.setFillColor(...BRAND.blue); doc.roundedRect(barX, barY, barW, barH, 1, 1, "F");
    doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(...BRAND.darkBlue);
    doc.text(`$${fmt(d.value)}`, barX + barW / 2, barY - 2, { align: "center" });
    doc.setFontSize(6); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
    doc.text(d.label, barX + barW / 2, chartBottom + 5, { align: "center" });
  });
}

interface RevenueBreakdown {
  rebatesMonthly: number; cpaMonthly: number; hybridCpaMonthly: number;
  hybridRebatesMonthly: number; propfirmMonthly: number; totalMonthly: number;
}

function calculateRevenue(fd: OnboardingFormData): RevenueBreakdown {
  let rebatesMonthly = 0, cpaMonthly = 0, hybridCpaMonthly = 0, hybridRebatesMonthly = 0, propfirmMonthly = 0;
  const showBrokeraje = fd.modelo_negocio === "Brokeraje" || fd.modelo_negocio === "Ambos";
  const showPropFirm = fd.modelo_negocio === "PropFirm" || fd.modelo_negocio === "Ambos";
  if (showBrokeraje) {
    if (fd.tipo_acuerdo_brokeraje === "Rebates" && fd.spread_config.length > 0) {
      const avgDolarIB = fd.spread_config.reduce((sum, s) => sum + (s.nuevo_dolar_ib ?? s.dolares_ib_original), 0) / fd.spread_config.length;
      rebatesMonthly = avgDolarIB * fd.lotes_por_mes;
    }
    if (fd.tipo_acuerdo_brokeraje === "CPA" && fd.cpa_config.length > 0) {
      const midIdx = Math.floor(fd.cpa_config.length / 2);
      cpaMonthly = fd.cpa_config[midIdx].cpa_pagar * fd.clientes_por_mes;
    }
    if (fd.tipo_acuerdo_brokeraje === "Híbrido" && fd.hybrid_config.length > 0) {
      const midIdx = Math.floor(fd.hybrid_config.length / 2);
      hybridCpaMonthly = fd.hybrid_config[midIdx].cpa_pagar * fd.clientes_por_mes;
      hybridRebatesMonthly = fd.hybrid_config[midIdx].dolares_por_lote * fd.lotes_por_mes;
    }
  }
  if (showPropFirm && fd.propfirm_config.length > 0 && fd.cuentas_fondeo_vendidas > 0) {
    const tier = fd.propfirm_config[0];
    const price = PROPFIRM_PRICES[fd.tipo_cuenta_fondeo] || 200;
    propfirmMonthly = fd.cuentas_fondeo_vendidas * price * (tier.porcentaje_comision / 100);
  }
  const totalMonthly = rebatesMonthly + cpaMonthly + hybridCpaMonthly + hybridRebatesMonthly + propfirmMonthly;
  return { rebatesMonthly, cpaMonthly, hybridCpaMonthly, hybridRebatesMonthly, propfirmMonthly, totalMonthly };
}

export function generatePerformanceReportPDF(
  formData: OnboardingFormData,
  reportNumber: string,
  ibId: string,
  logoBase64?: string | null
): jsPDF {
  const doc = new jsPDF();
  const now = new Date();
  const rev = calculateRevenue(formData);
  const L = logoBase64;

  addHeader(doc, "IB Performance Report — Financial Projections", L);

  doc.setFontSize(8); doc.setTextColor(...BRAND.gray);
  doc.text(`Report: ${reportNumber}`, 140, 42);
  doc.text(`Date: ${now.toLocaleDateString("es-CR")}`, 140, 47);
  doc.text(`IB ID: ${ibId.slice(0, 8)}...`, 140, 52);

  let y = 58;

  // KPI Summary Cards
  const kpis = [
    { label: "Ingreso Mensual", value: `$${fmt(rev.totalMonthly)}` },
    { label: "Ingreso Trimestral", value: `$${fmt(rev.totalMonthly * 3)}` },
    { label: "Ingreso Anual", value: `$${fmt(rev.totalMonthly * 12)}` },
  ];
  const cardW = 56, cardGap = 6, cardStartX = 15;
  kpis.forEach((kpi, i) => {
    const cx = cardStartX + i * (cardW + cardGap);
    doc.setFillColor(245, 247, 250); doc.roundedRect(cx, y, cardW, 22, 3, 3, "F");
    doc.setFillColor(...BRAND.blue); doc.roundedRect(cx, y, cardW, 3, 3, 3, "F");
    doc.rect(cx, y + 1.5, cardW, 1.5, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...BRAND.gray);
    doc.text(kpi.label, cx + cardW / 2, y + 10, { align: "center" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(...BRAND.darkBlue);
    doc.text(kpi.value, cx + cardW / 2, y + 19, { align: "center" });
  });
  y += 30;

  // Section 1: Input Parameters
  const isCPAOnly = (formData.modelo_negocio === "Brokeraje" || formData.modelo_negocio === "Ambos") && formData.tipo_acuerdo_brokeraje === "CPA";
  y = addSectionTitle(doc, y, "1. Parámetros de Entrada");
  y = addRow(doc, y, "IB:", `${formData.nombre_ib} (${formData.correo_ib})`, true);
  const modeloLabel = formData.modelo_negocio === "Ambos" ? "Ambos (Brokeraje + PropFirm)" : formData.modelo_negocio;
  y = addRow(doc, y, "Modelo de Negocio:", modeloLabel);
  if (formData.tipo_acuerdo_brokeraje) y = addRow(doc, y, "Tipo de Acuerdo:", formData.tipo_acuerdo_brokeraje, true);
  y = addRow(doc, y, "Clientes estimados/mes:", formData.clientes_por_mes.toString());
  y = addRow(doc, y, "Depósitos estimados/mes:", `$${fmt(formData.depositos_por_mes)}`, true);
  if (!isCPAOnly) {
    y = addRow(doc, y, "Lotes estimados/mes:", formData.lotes_por_mes.toString());
  }
  const showPropFirm = formData.modelo_negocio === "PropFirm" || formData.modelo_negocio === "Ambos";
  if (showPropFirm) {
    y = addRow(doc, y, "Cuentas fondeo vendidas/mes:", formData.cuentas_fondeo_vendidas.toString(), true);
    if (formData.tipo_cuenta_fondeo) y = addRow(doc, y, "Tipo cuenta fondeo:", formData.tipo_cuenta_fondeo);
  }
  y += 5;

  // Section 2: Revenue Breakdown
  y = cpb(doc, y, 60, L);
  y = addSectionTitle(doc, y, "2. Desglose de Ingresos Mensuales");
  const revenueRows: [string, string][] = [];
  if (rev.rebatesMonthly > 0) revenueRows.push(["Rebates ($/Lote × Lotes)", `$${fmt(rev.rebatesMonthly)}`]);
  if (rev.cpaMonthly > 0) revenueRows.push(["CPA (Comisión × Clientes)", `$${fmt(rev.cpaMonthly)}`]);
  if (rev.hybridCpaMonthly > 0) revenueRows.push(["Híbrido — CPA", `$${fmt(rev.hybridCpaMonthly)}`]);
  if (rev.hybridRebatesMonthly > 0) revenueRows.push(["Híbrido — Rebates ($/Lote)", `$${fmt(rev.hybridRebatesMonthly)}`]);
  if (rev.propfirmMonthly > 0) revenueRows.push(["PropFirm (Comisión %)", `$${fmt(rev.propfirmMonthly)}`]);
  revenueRows.push(["TOTAL MENSUAL", `$${fmt(rev.totalMonthly)}`]);
  autoTable(doc, {
    startY: y, margin: { left: 15, right: 15 },
    head: [["Concepto", "Ingreso Mensual"]], body: revenueRows,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: BRAND.darkBlue, textColor: BRAND.white, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [240, 244, 248] },
    didParseCell: (data) => {
      if (data.row.index === revenueRows.length - 1) {
        data.cell.styles.fontStyle = "bold"; data.cell.styles.fillColor = [230, 240, 255]; data.cell.styles.textColor = BRAND.darkBlue;
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Section 3: Projections
  y = cpb(doc, y, 50, L);
  y = addSectionTitle(doc, y, "3. Proyección a 12 Meses");
  const months = ["Mes 1","Mes 2","Mes 3","Mes 4","Mes 5","Mes 6","Mes 7","Mes 8","Mes 9","Mes 10","Mes 11","Mes 12"];
  const growthRate = 0.05;
  const projectionData = months.map((m, i) => {
    const factor = Math.pow(1 + growthRate, i);
    const monthly = rev.totalMonthly * factor;
    return [m, `$${fmt(monthly)}`, `$${fmt(monthly * 12)}`];
  });
  autoTable(doc, {
    startY: y, margin: { left: 15, right: 15 },
    head: [["Período", "Ingreso Mensual", "Proyección Anual"]], body: projectionData,
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: BRAND.darkBlue, textColor: BRAND.white, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [240, 244, 248] },
    columnStyles: { 1: { fontStyle: "bold" }, 2: { textColor: BRAND.blue } },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Section 4: Chart
  y = cpb(doc, y, 75, L);
  y = addSectionTitle(doc, y, "4. Gráfico de Ingresos Proyectados");
  const chartData = [
    { label: "Mes 1", value: rev.totalMonthly },
    { label: "Mes 3", value: rev.totalMonthly * Math.pow(1.05, 2) },
    { label: "Mes 6", value: rev.totalMonthly * Math.pow(1.05, 5) },
    { label: "Mes 9", value: rev.totalMonthly * Math.pow(1.05, 8) },
    { label: "Mes 12", value: rev.totalMonthly * Math.pow(1.05, 11) },
  ];
  drawBarChart(doc, 20, y + 5, 170, 50, chartData, "Evolución de Ingresos Mensuales (crecimiento 5% mensual)");
  y += 65;

  // Section 5: Sources
  const sources = [
    { label: "Rebates", value: rev.rebatesMonthly },
    { label: "CPA", value: rev.cpaMonthly + rev.hybridCpaMonthly },
    { label: "Híbrido Reb.", value: rev.hybridRebatesMonthly },
    { label: "PropFirm", value: rev.propfirmMonthly },
  ].filter(s => s.value > 0);
  if (sources.length > 1) {
    y = cpb(doc, y, 75, L);
    y = addSectionTitle(doc, y, "5. Distribución por Fuente de Ingreso");
    drawBarChart(doc, 20, y + 5, 170, 50, sources, "Ingreso Mensual por Canal");
    y += 65;
  }

  // Summary
  y = cpb(doc, y, 50, L);
  y = addSectionTitle(doc, y, sources.length > 1 ? "6. Resumen Ejecutivo" : "5. Resumen Ejecutivo");
  doc.setFillColor(245, 247, 250); doc.roundedRect(15, y, 180, 42, 3, 3, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(60, 60, 60);
  const summaryLines = [
    `• Ingreso mensual estimado: $${fmt(rev.totalMonthly)}`,
    `• Ingreso trimestral estimado: $${fmt(rev.totalMonthly * 3)}`,
    `• Ingreso anual estimado (sin crecimiento): $${fmt(rev.totalMonthly * 12)}`,
    `• Ingreso anual proyectado (5% crecimiento mensual): $${fmt(rev.totalMonthly * ((Math.pow(1.05, 12) - 1) / 0.05))}`,
    `• Modelo de negocio: ${formData.modelo_negocio === "Ambos" ? "Ambos (Brokeraje + PropFirm)" : formData.modelo_negocio}${formData.tipo_acuerdo_brokeraje ? ` — ${formData.tipo_acuerdo_brokeraje}` : ""}`,
    `• Región: ${formData.lugar_operacion}`,
  ];
  summaryLines.forEach((line, i) => { doc.text(line, 20, y + 6 + i * 6); });
  y += 48;

  // Disclaimer
  y = cpb(doc, y, 15, L);
  doc.setFontSize(7); doc.setTextColor(...BRAND.gray);
  doc.text("Nota: Las proyecciones se basan en los datos proporcionados y un crecimiento estimado del 5% mensual.", 15, y);
  doc.text("Los resultados reales pueden variar según condiciones de mercado y desempeño del IB.", 15, y + 4);

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BRAND.blue);
    doc.setLineWidth(0.8);
    doc.line(15, 282, 195, 282);
    doc.setFontSize(7); doc.setTextColor(...BRAND.gray);
    doc.text("BULLFY — IB Automated System | Confidential", 15, 288);
    doc.text(`Page ${i} of ${totalPages}`, 180, 288);
  }

  return doc;
}
