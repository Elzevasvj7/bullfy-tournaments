import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { OnboardingFormData } from "@/stores/onboardingStore";
import { CPA_RULES } from "./cpaRules";

const BRAND = {
  darkBlue: [6, 43, 99] as [number, number, number],
  blue: [20, 110, 245] as [number, number, number],
  lightBlue: [131, 203, 255] as [number, number, number],
  gray: [160, 177, 189] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

function calculateIBScore(fd: OnboardingFormData): number {
  let score = 0;
  if (fd.modelo_negocio === "Ambos") score += 25;
  else if (fd.modelo_negocio === "Brokeraje") score += 20;
  else score += 15;
  if (fd.tiene_sub_ibs && fd.sub_ibs.length > 0) score += Math.min(fd.sub_ibs.length * 5, 15);
  if (!fd.usar_spreads_default && fd.spread_config.some(s => s.nuevo_dolar_ib !== null)) score += 10;
  if (fd.repartir_cpa) score += 10;
  if (fd.cuentas_marketing_tipo && fd.cuentas_marketing_tipo !== "No tiene") score += 10;
  if (fd.tiene_fondeo_regalo) score += 5;
  if (fd.tiene_fondeo_especial) score += 5;
  if (fd.generar_performance) score += 10;
  if (fd.lugar_operacion === "LATAM") score += 10;
  else score += 5;
  return Math.min(score, 100);
}

function getScoreAnalysis(fd: OnboardingFormData, score: number): string[] {
  const reasons: string[] = [];

  if (fd.modelo_negocio === "Ambos") reasons.push("Modelo diversificado (Brokeraje + PropFirm): +25 pts");
  else if (fd.modelo_negocio === "Brokeraje") reasons.push("Modelo Brokeraje: +20 pts");
  else reasons.push("Modelo PropFirm: +15 pts");

  if (fd.tiene_sub_ibs && fd.sub_ibs.length > 0) {
    const pts = Math.min(fd.sub_ibs.length * 5, 15);
    reasons.push(`Red de ${fd.sub_ibs.length} Sub IB(s): +${pts} pts`);
  }

  if (!fd.usar_spreads_default && fd.spread_config.some(s => s.nuevo_dolar_ib !== null))
    reasons.push("Spreads personalizados (negociación activa): +10 pts");

  if (fd.repartir_cpa) reasons.push("Distribución de CPA configurada: +10 pts");

  if (fd.cuentas_marketing_tipo && fd.cuentas_marketing_tipo !== "No tiene")
    reasons.push("Cuentas de marketing asignadas: +10 pts");

  if (fd.tiene_fondeo_regalo) reasons.push("Fondeo regalo otorgado: +5 pts");
  if (fd.tiene_fondeo_especial) reasons.push("Fondeo especial con retiro: +5 pts");

  if (fd.generar_performance) reasons.push("Performance estimado incluido: +10 pts");

  if (fd.lugar_operacion === "LATAM") reasons.push("Región LATAM (mercado prioritario): +10 pts");
  else if (fd.lugar_operacion) reasons.push(`Región ${fd.lugar_operacion}: +5 pts`);

  // Overall assessment
  let assessment: string;
  if (score >= 80) assessment = "IB de alto valor con configuración completa y diversificada.";
  else if (score >= 60) assessment = "IB con buen potencial y configuración sólida.";
  else if (score >= 40) assessment = "IB con configuración básica, potencial de crecimiento.";
  else assessment = "IB en etapa inicial con configuración mínima.";
  reasons.push(assessment);

  return reasons;
}

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
  if (isAlt) {
    doc.setFillColor(240, 244, 248);
    doc.rect(15, y - 3.5, 180, 7, "F");
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(label, 20, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text(value, 110, y);
  return y + 7;
}

function cpb(doc: jsPDF, y: number, needed: number, logo?: string | null): number {
  if (y + needed > 275) {
    doc.addPage();
    addHeader(doc, "IB Technical Report — Continued", logo);
    return 45;
  }
  return y;
}

export function generateTechnicalReportPDF(
  formData: OnboardingFormData,
  reportNumber: string,
  ibId: string,
  logoBase64?: string | null,
  isUpdate = false
): jsPDF {
  const doc = new jsPDF();
  const now = new Date();
  const L = logoBase64;

  addHeader(doc, "IB Technical Report for IT Department", L);

  doc.setFontSize(8);
  doc.setTextColor(...BRAND.gray);
  doc.text(`Report: ${reportNumber}`, 140, 42);
  doc.text(`Date: ${now.toLocaleDateString("es-CR")}`, 140, 47);
  doc.text(`IB ID: ${ibId.slice(0, 8)}...`, 140, 52);

  let y = 58;

  // Update banner
  if (isUpdate) {
    doc.setFillColor(255, 193, 7);
    doc.rect(15, y, 180, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text("ACTUALIZACIÓN DE ACUERDO — MODIFICADO POR BD", 105, y + 6.5, { align: "center" });
    y += 14;
  }

  // IB Score
  const score = calculateIBScore(formData);
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(15, y, 180, 22, 3, 3, "F");
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.darkBlue);
  doc.text("IB SCORE", 25, y + 10);
  const barX = 70, barW = 100, barH = 8;
  doc.setFillColor(220, 225, 230);
  doc.roundedRect(barX, y + 5, barW, barH, 2, 2, "F");
  const fillW = (score / 100) * barW;
  const scoreColor: [number, number, number] = score >= 70 ? [34, 197, 94] : score >= 40 ? BRAND.blue : [239, 68, 68];
  doc.setFillColor(...scoreColor);
  doc.roundedRect(barX, y + 5, fillW, barH, 2, 2, "F");
  doc.setFontSize(11);
  doc.setTextColor(...scoreColor);
  doc.text(`${score}/100`, barX + barW + 5, y + 12);
  y += 28;

  // Score Analysis
  const analysis = getScoreAnalysis(formData, score);
  doc.setFillColor(248, 250, 252);
  const analysisHeight = 6 + analysis.length * 4.5;
  doc.roundedRect(15, y, 180, analysisHeight, 2, 2, "F");
  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.3);
  doc.roundedRect(15, y, 180, analysisHeight, 2, 2, "S");
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...BRAND.darkBlue);
  doc.text("Análisis del Score:", 20, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(70, 70, 70);
  for (const line of analysis) {
    doc.text(`• ${line}`, 22, y);
    y += 4.5;
  }
  y += 5;

  // Section 1
  y = addSectionTitle(doc, y, "1. Información General");
  y = addRow(doc, y, "Tipo de Persona:", formData.tipo_persona, true);
  y = addRow(doc, y, "Business Developer:", formData.nombre_bd);
  y = addRow(doc, y, "Nombre del IB:", `${formData.nombre_ib} (${formData.correo_ib})`, true);
  y = addRow(doc, y, `ID (${formData.tipo_id}):`, formData.id_ib);
  y = addRow(doc, y, "Lugar de Operación:", formData.lugar_operacion, true);
  if ((formData as any).tipo_grupo_cuentas) {
    y = addRow(doc, y, "Tipo de Cuentas en Grupos:", (formData as any).tipo_grupo_cuentas);
  }
  if (formData.tipo_persona === "Empresa") {
    if (formData.direccion_empresa) y = addRow(doc, y, "Dirección Empresa:", formData.direccion_empresa);
    if (formData.contacto_corporativo) y = addRow(doc, y, "Contacto Corporativo:", formData.contacto_corporativo, true);
    if (formData.representante_legal) {
      y = addRow(doc, y, "Representante Legal:", formData.representante_legal);
      if (formData.tipo_id_representante && formData.id_representante) {
        y = addRow(doc, y, `ID Rep. Legal (${formData.tipo_id_representante}):`, formData.id_representante, true);
      }
    }
  }
  if (formData.nombre_comunidad) {
    y = addRow(doc, y, "Nombre Comunidad:", formData.nombre_comunidad, true);
  }
  y += 3;

  // Section 2: Sub IBs
  if (formData.tiene_sub_ibs && formData.sub_ibs.length > 0) {
    y = cpb(doc, y, 20 + formData.sub_ibs.length * 8, L);
    y = addSectionTitle(doc, y, "2. Sub IBs");
    autoTable(doc, {
      startY: y, margin: { left: 15, right: 15 },
      head: [["Nombre", "Correo", "Tipo ID", "Nº Documento"]],
      body: formData.sub_ibs.map(s => [s.nombre, s.correo, s.tipo_id, s.id_documento]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: BRAND.darkBlue, textColor: BRAND.white, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [240, 244, 248] },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Section 3
  y = cpb(doc, y, 30, L);
  y = addSectionTitle(doc, y, "3. Modelo de Negocio");
  const modeloLabel = formData.modelo_negocio === "Ambos" ? "Ambos (Brokeraje + PropFirm)" : formData.modelo_negocio;
  y = addRow(doc, y, "Modelo:", modeloLabel, true);
  const showBrokeraje = formData.modelo_negocio === "Brokeraje" || formData.modelo_negocio === "Ambos";
  if (showBrokeraje && formData.tipo_acuerdo_brokeraje) {
    y = addRow(doc, y, "Tipo de Acuerdo Brokeraje:", formData.tipo_acuerdo_brokeraje);
  }
  y += 3;

  // Section 4: Spreads (for Rebates or Híbrido ONLY — NOT for CPA)
  const isHybrid = showBrokeraje && formData.tipo_acuerdo_brokeraje === "Híbrido";
  const isRebates = showBrokeraje && formData.tipo_acuerdo_brokeraje === "Rebates";
  const showSpreads = (isRebates || isHybrid) && formData.spread_config.length > 0;
  if (showSpreads) {
    y = cpb(doc, y, 30, L);
    y = addSectionTitle(doc, y, "4. Configuración de Spreads");
    const modified = formData.spread_config.filter(s => s.nuevo_dolar_ib !== null && s.nuevo_dolar_ib !== s.dolares_ib_original);
    const spreadData = formData.spread_config.map(s => {
      const baseDolar = s.dolares_ib_original;
      const nuevoIB = s.nuevo_dolar_ib ?? baseDolar;
      const dif = s.diferencia ?? (nuevoIB - baseDolar);
      const nuevoSpread = s.nuevo_spread_cliente ?? (s.spread_estandar + dif);
      return [s.symbol, s.raw.toString(), s.spread_estandar.toString(), `$${baseDolar}`, s.nuevo_dolar_ib !== null ? `$${s.nuevo_dolar_ib}` : "—", dif !== 0 ? (dif > 0 ? `+${dif}` : dif.toString()) : "0", nuevoSpread.toString()];
    });
    autoTable(doc, {
      startY: y, margin: { left: 15, right: 15 },
      head: [["Symbol", "RAW", "Spread Std", "$/Lote Orig.", "$/Lote Nuevo", "Dif.", "Nuevo Spread"]],
      body: spreadData,
      styles: { fontSize: 6.5, cellPadding: 1.5 },
      headStyles: { fillColor: BRAND.darkBlue, textColor: BRAND.white, fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: [240, 244, 248] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 22 }, 4: { textColor: modified.length > 0 ? BRAND.blue : [20, 20, 20] } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    if (!isHybrid && formData.sub_ib_rebate_allocations.length > 0) {
      y = cpb(doc, y, 25, L);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...BRAND.darkBlue);
      doc.text("Distribución de Rebates por Sub IB:", 20, y); y += 5;
      autoTable(doc, {
        startY: y, margin: { left: 15, right: 15 },
        head: [["Nombre", "Correo", "$/Lote Asignado"]],
        body: formData.sub_ib_rebate_allocations.map(a => [a.nombre, a.correo, `$${a.dolares_asignados}`]),
        styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: BRAND.blue, textColor: BRAND.white },
      });
      y = (doc as any).lastAutoTable.finalY + 5;
      if (formData.dolares_ib_restante !== null) { y = addRow(doc, y, "$/Lote restante para IB principal:", `$${formData.dolares_ib_restante}`, true); }
      y += 3;
    }
  }

  // Section 4b: Comisión por Lote Operado
  if (showBrokeraje) {
    y = cpb(doc, y, 20, L);
    y = addSectionTitle(doc, y, "Comisión por Lote Operado");
    if ((formData as any).tiene_comision_por_lote) {
      y = addRow(doc, y, "¿Comisión por lote?", "Sí", true);
      y = addRow(doc, y, "Dólares por lote operado:", `$${(formData as any).comision_dolares_por_lote ?? 0}`);
    } else {
      y = addRow(doc, y, "¿Comisión por lote?", "No", true);
    }
    y += 3;
  }

  // Section 5: CPA
  if (showBrokeraje && formData.tipo_acuerdo_brokeraje === "CPA" && formData.cpa_config.length > 0) {
    y = cpb(doc, y, 25, L);
    y = addSectionTitle(doc, y, "5. Configuración CPA");
    autoTable(doc, {
      startY: y, margin: { left: 15, right: 15 },
      head: [["Rango de Depósito", "CPA a Pagar"]],
      body: formData.cpa_config.map(c => [c.rango_deposito, `$${c.cpa_pagar}`]),
      styles: { fontSize: 9, cellPadding: 2.5 }, headStyles: { fillColor: BRAND.darkBlue, textColor: BRAND.white },
      alternateRowStyles: { fillColor: [240, 244, 248] },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Section 5b: Hybrid
  if (showBrokeraje && formData.tipo_acuerdo_brokeraje === "Híbrido" && formData.hybrid_config.length > 0) {
    y = cpb(doc, y, 25, L);
    y = addSectionTitle(doc, y, "5. Configuración Híbrida (CPA + Rebates)");
    autoTable(doc, {
      startY: y, margin: { left: 15, right: 15 },
      head: [["Rango de Depósito", "CPA a Pagar", "$/Lote"]],
      body: formData.hybrid_config.map(h => [h.rango_deposito, `$${h.cpa_pagar}`, `$${h.dolares_por_lote}`]),
      styles: { fontSize: 9, cellPadding: 2.5 }, headStyles: { fillColor: BRAND.darkBlue, textColor: BRAND.white },
      alternateRowStyles: { fillColor: [240, 244, 248] },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Section 6: CPA Distribution
  if (formData.repartir_cpa && formData.cpa_distribution.length > 0) {
    y = cpb(doc, y, 30, L);
    y = addSectionTitle(doc, y, "6. Distribución de CPA");
    for (const dist of formData.cpa_distribution) {
      y = cpb(doc, y, 20, L);
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...BRAND.darkBlue);
      doc.text(`${dist.nombre} (${dist.correo})${dist.es_sub_ib ? " — Sub IB" : ""}`, 20, y); y += 5;
      autoTable(doc, {
        startY: y, margin: { left: 20, right: 20 },
        head: [["Rango de Depósito", "$ Asignados"]],
        body: dist.asignaciones.map(a => [a.rango_deposito, `$${a.dolares_asignados}`]),
        styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: BRAND.blue, textColor: BRAND.white },
      });
      y = (doc as any).lastAutoTable.finalY + 5;
    }
    y += 3;
  }

  // Section 7: PropFirm
  const showPropFirm = formData.modelo_negocio === "PropFirm" || formData.modelo_negocio === "Ambos";
  if (showPropFirm && formData.propfirm_config.length > 0) {
    y = cpb(doc, y, 25, L);
    y = addSectionTitle(doc, y, "7. Comisiones PropFirm");
    autoTable(doc, {
      startY: y, margin: { left: 15, right: 15 },
      head: [["Rango de Ventas", "Comisión (%)"]],
      body: formData.propfirm_config.map(p => [p.rango_ventas, `${p.porcentaje_comision}%`]),
      styles: { fontSize: 9, cellPadding: 2.5 }, headStyles: { fillColor: BRAND.darkBlue, textColor: BRAND.white },
      alternateRowStyles: { fillColor: [240, 244, 248] },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Section 8: Cuentas
  y = cpb(doc, y, 40, L);
  y = addSectionTitle(doc, y, "8. Cuentas y Fondeos");
  y = addRow(doc, y, "Cuentas Marketing:", formData.cuentas_marketing_tipo || "No tiene", true);
  if (formData.cuentas_marketing_tipo && formData.cuentas_marketing_tipo !== "No tiene") {
    y = addRow(doc, y, "  Cantidad:", formData.cuentas_marketing_cantidad.toString());
    y = addRow(doc, y, "  Balance:", `$${formData.cuentas_marketing_balance.toLocaleString()}`, true);
  }
  y = addRow(doc, y, "Fondeo Regalo:", formData.tiene_fondeo_regalo ? "Sí" : "No");
  if (formData.tiene_fondeo_regalo) {
    y = addRow(doc, y, "  Cantidad:", formData.fondeo_regalo_cantidad.toString(), true);
    y = addRow(doc, y, "  Balance:", `$${formData.fondeo_regalo_balance.toLocaleString()}`);
  }
  y = addRow(doc, y, "Fondeo Especial:", formData.tiene_fondeo_especial ? "Sí" : "No", true);
  if (formData.tiene_fondeo_especial) {
    y = addRow(doc, y, "  Balance:", `$${formData.fondeo_especial_balance.toLocaleString()}`);
  }
  y += 3;

  // Section 9: Performance (lotes always shown here since this is internal report for IT/Bullfy)
  if (formData.generar_performance) {
    y = cpb(doc, y, 30, L);
    y = addSectionTitle(doc, y, "9. Performance Estimado");
    y = addRow(doc, y, "Clientes/mes:", formData.clientes_por_mes.toString(), true);
    y = addRow(doc, y, "Depósitos/mes:", `$${formData.depositos_por_mes.toLocaleString()}`);
    y = addRow(doc, y, "Lotes/mes:", formData.lotes_por_mes.toString(), true);
    if (showBrokeraje && formData.tipo_acuerdo_brokeraje === "CPA") {
      y = addRow(doc, y, "", "(Dato interno — no aplica para compensación del IB)");
    }
    if (showPropFirm) {
      y = addRow(doc, y, "Cuentas fondeo vendidas:", formData.cuentas_fondeo_vendidas.toString());
      if (formData.tipo_cuenta_fondeo) { y = addRow(doc, y, "Tipo cuenta fondeo:", formData.tipo_cuenta_fondeo, true); }
    }
  }

  // Section 10: Resumen para IT — condensed config on new page
  doc.addPage();
  addHeader(doc, "IB Technical Report — IT Summary", L);
  y = 45;
  y = addSectionTitle(doc, y, "RESUMEN PARA IT");

  // Config rows
  const itRows: [string, string][] = [];
  itRows.push(["IB:", `${formData.nombre_ib} (${formData.correo_ib})`]);
  if ((formData as any).nombre_comunidad) itRows.push(["Nombre Comunidad:", (formData as any).nombre_comunidad]);
  itRows.push(["Tipo Persona:", formData.tipo_persona]);
  itRows.push(["ID:", `${formData.tipo_id}: ${formData.id_ib}`]);
  if (formData.tipo_persona === "Empresa") {
    if (formData.direccion_empresa) itRows.push(["Dir. Empresa:", formData.direccion_empresa]);
    if (formData.contacto_corporativo) itRows.push(["Contacto Corp.:", formData.contacto_corporativo]);
    if (formData.representante_legal) itRows.push(["Rep. Legal:", `${formData.representante_legal}${formData.tipo_id_representante && formData.id_representante ? ` (${formData.tipo_id_representante}: ${formData.id_representante})` : ""}`]);
  }
  itRows.push(["Modelo:", modeloLabel]);
  if (showBrokeraje && formData.tipo_acuerdo_brokeraje) itRows.push(["Tipo Acuerdo:", formData.tipo_acuerdo_brokeraje]);
  itRows.push(["Región:", formData.lugar_operacion]);

  // Spreads summary (no full table)
  if (showSpreads) {
    const customSpreads = formData.spread_config.filter(s => s.nuevo_dolar_ib !== null && s.nuevo_dolar_ib !== (isHybrid ? 4 : s.dolares_ib_original));
    if (customSpreads.length > 0) {
      itRows.push(["Spreads:", `${customSpreads.length} de ${formData.spread_config.length} personalizados (ver Sección 4)`]);
    } else {
      itRows.push(["Spreads:", `${formData.spread_config.length} activos — valores por defecto${isHybrid ? " (base $4/lote)" : ""}`]);
    }
  }

  // CPA config — show ALL ranges
  if (showBrokeraje && formData.tipo_acuerdo_brokeraje === "CPA" && formData.cpa_config.length > 0) {
    itRows.push(["— CPA RANGOS —", ""]);
    for (const c of formData.cpa_config) {
      itRows.push(["  " + c.rango_deposito + ":", `$${c.cpa_pagar}`]);
    }
  }

  // Hybrid config — show ALL ranges
  if (showBrokeraje && formData.tipo_acuerdo_brokeraje === "Híbrido" && formData.hybrid_config.length > 0) {
    itRows.push(["— HÍBRIDO RANGOS —", ""]);
    for (const h of formData.hybrid_config) {
      itRows.push(["  " + h.rango_deposito + ":", `CPA $${h.cpa_pagar} | $/Lote $${h.dolares_por_lote}`]);
    }
  }

  // CPA/Hybrid activation rules for IT
  if (showBrokeraje && (formData.tipo_acuerdo_brokeraje === "CPA" || formData.tipo_acuerdo_brokeraje === "Híbrido")) {
    itRows.push(["— REGLAS CPA —", ""]);
    for (const regla of CPA_RULES) {
      itRows.push([regla.titulo + ":", regla.items.join(" | ")]);
    }
  }

  // PropFirm
  if (showPropFirm && formData.propfirm_config.length > 0) {
    itRows.push(["PropFirm:", `${formData.propfirm_config.length} niveles de comisión`]);
    for (const p of formData.propfirm_config) {
      itRows.push(["  " + p.rango_ventas + ":", `${p.porcentaje_comision}%`]);
    }
  }

  // Accounts
  itRows.push(["— CUENTAS —", ""]);
  itRows.push(["Marketing:", formData.cuentas_marketing_tipo || "No tiene"]);
  if (formData.cuentas_marketing_tipo && formData.cuentas_marketing_tipo !== "No tiene") {
    itRows.push(["  Cantidad:", formData.cuentas_marketing_cantidad.toString()]);
    itRows.push(["  Balance:", `$${formData.cuentas_marketing_balance.toLocaleString()}`]);
  }
  itRows.push(["Fondeo Regalo:", formData.tiene_fondeo_regalo ? `Sí — ${formData.fondeo_regalo_cantidad} ctas × $${formData.fondeo_regalo_balance.toLocaleString()}` : "No"]);
  itRows.push(["Fondeo Especial:", formData.tiene_fondeo_especial ? `Sí — $${formData.fondeo_especial_balance.toLocaleString()}` : "No"]);

  // Sub IBs
  if (formData.tiene_sub_ibs && formData.sub_ibs.length > 0) {
    itRows.push(["— SUB IBs —", ""]);
    for (const s of formData.sub_ibs) {
      itRows.push([`  ${s.nombre}:`, `${s.correo} | ${s.tipo_id}: ${s.id_documento}`]);
    }
  }

  autoTable(doc, {
    startY: y, margin: { left: 15, right: 15 },
    body: itRows,
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 45, textColor: BRAND.darkBlue },
      1: { textColor: [20, 20, 20] as any },
    },
    theme: "plain",
    alternateRowStyles: { fillColor: [245, 247, 250] },
    didParseCell: (data) => {
      const val = data.cell.raw as string;
      if (val === "— CUENTAS —" || val === "— SUB IBs —" || val === "— CPA RANGOS —" || val === "— HÍBRIDO RANGOS —" || val === "— REGLAS CPA —") {
        data.cell.styles.fillColor = BRAND.darkBlue as any;
        data.cell.styles.textColor = BRAND.white as any;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BRAND.blue);
    doc.setLineWidth(0.8);
    doc.line(15, 282, 195, 282);
    doc.setFontSize(7);
    doc.setTextColor(...BRAND.gray);
    doc.text("BULLFY — IB Automated System | Confidential", 15, 288);
    doc.text(`Page ${i} of ${totalPages}`, 180, 288);
  }

  return doc;
}

export { calculateIBScore };
