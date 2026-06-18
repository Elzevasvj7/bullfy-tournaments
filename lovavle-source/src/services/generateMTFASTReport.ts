import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { OnboardingFormData } from "@/stores/onboardingStore";

const BRAND = {
  darkBlue: [6, 43, 99] as [number, number, number],
  blue: [20, 110, 245] as [number, number, number],
  lightBlue: [131, 203, 255] as [number, number, number],
  gray: [160, 177, 189] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

export function generateMTFASTReportPDF(
  formData: OnboardingFormData,
  reportNumber: string,
  ibId: string,
  logoBase64?: string | null
): jsPDF {
  const doc = new jsPDF();
  const now = new Date();
  const L = logoBase64;

  // Header
  doc.setDrawColor(...BRAND.blue);
  doc.setLineWidth(0.8);
  doc.line(15, 28, 195, 28);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.darkBlue);
  doc.text("Report MTFAST", 15, 18);
  if (L) { try { doc.addImage(L, "PNG", 120, 2, 75, 36); } catch {} }

  doc.setFontSize(8);
  doc.setTextColor(...BRAND.gray);
  doc.text(`Report: ${reportNumber}`, 140, 42);
  doc.text(`Date: ${now.toLocaleDateString("es-CR")}`, 140, 47);

  let y = 58;

  // Section 1: Grupo a configurar
  doc.setFillColor(...BRAND.darkBlue);
  doc.rect(15, y, 180, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.white);
  doc.text("GRUPO A CONFIGURAR", 20, y + 5.5);
  y += 14;

  const nombreComunidad = (formData as any).nombre_comunidad || "No especificado";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...BRAND.darkBlue);
  doc.text(nombreComunidad, 105, y, { align: "center" });
  y += 12;

  // Section 2: Datos del IB
  doc.setFillColor(...BRAND.darkBlue);
  doc.rect(15, y, 180, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.white);
  doc.text("DATOS DEL IB", 20, y + 5.5);
  y += 14;

  // Name
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("Nombre del IB:", 20, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text(formData.nombre_ib, 110, y);
  y += 7;

  // Email
  doc.setFillColor(240, 244, 248);
  doc.rect(15, y - 3.5, 180, 7, "F");
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text("Correo del IB:", 20, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text(formData.correo_ib, 110, y);
  y += 12;

  // Section 3: Spread Config (only if exists)
  const showBrokeraje = formData.modelo_negocio === "Brokeraje" || formData.modelo_negocio === "Ambos";
  const isHybrid = showBrokeraje && formData.tipo_acuerdo_brokeraje === "Híbrido";
  const isRebates = showBrokeraje && formData.tipo_acuerdo_brokeraje === "Rebates";
  const showSpreads = (isRebates || isHybrid) && formData.spread_config.length > 0;

  if (showSpreads) {
    doc.setFillColor(...BRAND.darkBlue);
    doc.rect(15, y, 180, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.white);
    doc.text("CONFIGURACIÓN DE SPREAD", 20, y + 5.5);
    y += 12;

    const spreadData = formData.spread_config.map(s => {
      const baseDolar = s.dolares_ib_original;
      const nuevoIB = s.nuevo_dolar_ib ?? baseDolar;
      const dif = s.diferencia ?? (nuevoIB - baseDolar);
      const nuevoSpread = s.nuevo_spread_cliente ?? (s.spread_estandar + dif);
      return [s.symbol, s.raw.toString(), nuevoSpread.toString()];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: 15, right: 15 },
      head: [["Símbolo", "RAW Spread", "Spread Cliente Final"]],
      body: spreadData,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: BRAND.darkBlue, textColor: BRAND.white, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [240, 244, 248] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 } },
    });
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BRAND.blue);
    doc.setLineWidth(0.8);
    doc.line(15, 282, 195, 282);
    doc.setFontSize(7);
    doc.setTextColor(...BRAND.gray);
    doc.text("BULLFY — Report MTFAST | Confidential", 15, 288);
    doc.text(`Page ${i} of ${totalPages}`, 180, 288);
  }

  return doc;
}
