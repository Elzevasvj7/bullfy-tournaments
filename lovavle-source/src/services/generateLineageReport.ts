import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getLogoBase64 } from "./pdfLogoHelper";

const BRAND = {
  darkBlue: [6, 43, 99] as [number, number, number],
  blue: [20, 110, 245] as [number, number, number],
  lightBlue: [131, 203, 255] as [number, number, number],
  gray: [160, 177, 189] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

interface LineageEntry {
  nombre: string;
  correo: string;
  rol: string; // "IB Principal (Master IB1)", "Master IB2", "Sub IB"
  dolares_por_lote: number | null;
  depth: number; // indentation level
}

interface LineageReportData {
  ib_nombre: string;
  ib_correo: string;
  nombre_bd: string;
  modelo_negocio: string;
  ib_id: string;
  total_dolares_lote: number; // root $/lote from spread config
  entries: LineageEntry[];
}

export async function generateLineageReportPDF(data: LineageReportData): Promise<jsPDF> {
  const doc = new jsPDF("p", "mm", "a4");
  const logo = await getLogoBase64();
  const now = new Date();
  const reportId = `LIN-${now.getTime().toString(36).toUpperCase()}`;

  // ─── Header ───
  if (logo) {
    try {
      doc.addImage(logo, "PNG", 120, 2, 75, 36);
    } catch {}
  }

  // Metadata below logo
  doc.setFontSize(7);
  doc.setTextColor(...BRAND.gray);
  doc.text(`Report: ${reportId}`, 140, 42);
  doc.text(`Date: ${now.toLocaleDateString("es-CR")}`, 140, 47);
  doc.text(`IB ID: ${data.ib_id.slice(0, 8)}...`, 140, 52);

  // Top blue line
  doc.setDrawColor(...BRAND.blue);
  doc.setLineWidth(0.8);
  doc.line(15, 28, 115, 28);

  let y = 58;

  // ─── Title ───
  doc.setFontSize(16);
  doc.setTextColor(...BRAND.darkBlue);
  doc.text("Distribución $/Lote — Línea Descendente", 15, y);
  y += 10;

  // ─── IB Info ───
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.darkBlue);
  const infoLines = [
    `IB: ${data.ib_nombre}`,
    `Correo: ${data.ib_correo}`,
    `BD Asignado: ${data.nombre_bd}`,
    `Modelo: ${data.modelo_negocio}`,
  ];
  for (const line of infoLines) {
    doc.text(line, 15, y);
    y += 5;
  }
  y += 5;

  // ─── Tree Section ───
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.darkBlue);
  doc.text("Árbol de Distribución", 15, y);
  y += 7;

  doc.setFontSize(9);
  for (const entry of data.entries) {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    const indent = 15 + entry.depth * 8;
    const prefix = entry.depth === 0 ? "RAIZ-" : "SUB-";
    const loteStr = entry.dolares_por_lote !== null ? `$${entry.dolares_por_lote.toFixed(2)}/lote` : "N/A";

    // Line 1: name in bold
    doc.setTextColor(...BRAND.darkBlue);
    doc.setFont("helvetica", "bold");
    doc.text(`${prefix} ${entry.nombre}`, indent, y);
    y += 5;

    // Line 2: role + $/lote in normal, indented further
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.gray);
    doc.text(`(${entry.rol}) — ${loteStr}`, indent + 6, y);
    y += 7;
  }

  y += 8;

  // ─── Summary Table ───
  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(11);
  doc.setTextColor(...BRAND.darkBlue);
  doc.text("Tabla Resumen", 15, y);
  y += 5;

  const tableBody = data.entries.map((e) => [
    e.nombre,
    e.rol,
    e.dolares_por_lote !== null ? `$${e.dolares_por_lote.toFixed(2)}` : "N/A",
    e.correo,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Nombre", "Rol", "$/Lote", "Correo"]],
    body: tableBody,
    styles: { fontSize: 8, cellPadding: 2.5, textColor: BRAND.darkBlue },
    headStyles: {
      fillColor: BRAND.blue,
      textColor: BRAND.white,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [240, 247, 255] },
    margin: { left: 15, right: 15 },
  });

  // ─── Footer ───
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BRAND.blue);
    doc.setLineWidth(0.8);
    doc.line(15, 285, 195, 285);
    doc.setFontSize(7);
    doc.setTextColor(...BRAND.gray);
    doc.text(`Bullfy IB System — ${reportId} — ${now.toLocaleDateString("es-CR")}`, 15, 290);
    doc.text(`Página ${i} de ${pageCount}`, 180, 290);
  }

  return doc;
}
