import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { OnboardingFormData, SubIB } from "@/stores/onboardingStore";
import { CPA_RULES } from "./cpaRules";

const BRAND = {
  darkBlue: [6, 43, 99] as [number, number, number],
  blue: [20, 110, 245] as [number, number, number],
  lightBlue: [131, 203, 255] as [number, number, number],
  gray: [160, 177, 189] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  black: [20, 20, 20] as [number, number, number],
};

const BULLFY_LEGAL = {
  name: "Bullfy Limited",
  id: "2025-00353",
  phone: "+971 52 6796350",
  email: "info@bullfy.com",
  address: "Ground Floor, The Sotheby Building, Rodney Village, Rodney Bay Gros-Islet, Saint Lucia",
};

/* ── Layout helpers ── */

function addHeader(doc: jsPDF, logo?: string | null) {
  doc.setDrawColor(...BRAND.blue);
  doc.setLineWidth(0.8);
  doc.line(15, 25, 195, 25);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.darkBlue);
  doc.text("Acuerdo de Introducing Broker — Bullfy Limited", 15, 18);
  if (logo) { try { doc.addImage(logo, "PNG", 120, 2, 75, 36); } catch {} }
}

function addFooter(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BRAND.blue);
    doc.setLineWidth(0.8);
    doc.line(15, 282, 195, 282);
    doc.setFontSize(7);
    doc.setTextColor(...BRAND.gray);
    doc.text("BULLFY — IB Automated System | Confidencial y Legalmente Vinculante", 15, 288);
    doc.text(`Página ${i} de ${total}`, 178, 288);
  }
}

function cp(doc: jsPDF, y: number, needed: number, logo?: string | null): number {
  if (y + needed > 275) {
    doc.addPage();
    addHeader(doc, logo);
    return 42;
  }
  return y;
}

function clauseTitle(doc: jsPDF, y: number, num: string, title: string, logo?: string | null): number {
  y = cp(doc, y, 14, logo);
  doc.setFillColor(235, 240, 248);
  doc.rect(15, y - 4, 180, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.darkBlue);
  doc.text(`${num}. ${title}`, 20, y + 1);
  return y + 10;
}

function subClause(doc: jsPDF, y: number, num: string, text: string, logo?: string | null): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);
  const lines = doc.splitTextToSize(`${num} ${text}`, 165);
  for (const line of lines) {
    y = cp(doc, y, 5, logo);
    doc.text(line, 22, y);
    y += 4;
  }
  return y + 1.5;
}

function para(doc: jsPDF, y: number, text: string, logo?: string | null, indent = 20): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);
  const lines = doc.splitTextToSize(text, 170);
  for (const line of lines) {
    y = cp(doc, y, 5, logo);
    doc.text(line, indent, y);
    y += 4;
  }
  return y + 1.5;
}

function bullet(doc: jsPDF, y: number, text: string, logo?: string | null): number {
  y = cp(doc, y, 5, logo);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);
  doc.text("•", 25, y);
  const lines = doc.splitTextToSize(text, 155);
  for (const line of lines) {
    y = cp(doc, y, 4.5, logo);
    doc.text(line, 30, y);
    y += 4;
  }
  return y;
}

/* ── Main generator ── */

export function generateAgreementPDF(
  formData: OnboardingFormData,
  reportNumber: string,
  ibId: string,
  logoBase64?: string | null
): jsPDF {
  const doc = new jsPDF();
  const now = new Date();
  const dateStr = now.toLocaleDateString("es-CR", { year: "numeric", month: "long", day: "numeric" });
  const logo = logoBase64;

  addHeader(doc, logo);

  // Report info
  doc.setFontSize(7.5);
  doc.setTextColor(...BRAND.gray);
  doc.text(`Acuerdo: ${reportNumber}`, 140, 14);
  doc.text(`Fecha: ${dateStr}`, 140, 18);

  let y = 42;

  // ─── Title ───
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...BRAND.darkBlue);
  doc.text("ACUERDO DE INTRODUCING BROKER", 105, y, { align: "center" });
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text(`Fecha de emisión: ${dateStr}`, 105, y, { align: "center" });
  y += 10;

  // ─── Parties preamble ───
  const isEmpresa = formData.tipo_persona === "Empresa";
  const ibName = formData.nombre_ib;

  y = para(doc, y, `ENTRE:`, logo);
  y = para(doc, y, `1. ${BULLFY_LEGAL.name} (la "Empresa"), y`, logo);
  y = para(doc, y, `2. ${ibName} (el "Introductor").`, logo);
  y += 2;
  y = para(doc, y, `La Empresa y el Introductor serán referidos colectivamente como las "Partes", y cada uno como la "Parte".`, logo);
  y += 2;
  y = para(doc, y, `CONSIDERANDO QUE:`, logo);
  y = bullet(doc, y, `(A) La Empresa proporciona a sus clientes la capacidad de operar, entre otros, instrumentos financieros como contratos por diferencia ("CFDs"), así como participar en trading propietario (es decir, trading con fondos demo) a través de la plataforma de la Empresa.`, logo);
  y = bullet(doc, y, `(B) El Introductor ha declarado y garantizado a la Empresa que tiene la experiencia suficiente para prestar los servicios de intermediación prescritos en el presente, mediante los cuales el Introductor presentará Clientes Potenciales de su red a la Empresa, con el objetivo de que dichos Clientes Potenciales celebren un Acuerdo Operativo con la Empresa.`, logo);
  y += 3;

  // ─── Parties table ───
  doc.setFillColor(...BRAND.darkBlue);
  doc.rect(15, y, 180, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.white);
  doc.text("DATOS DE LAS PARTES", 20, y + 5);
  y += 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.darkBlue);
  doc.text("PARTE A — LA EMPRESA:", 20, y);
  y += 5;

  autoTable(doc, {
    startY: y, margin: { left: 20, right: 20 },
    body: [
      ["Razón social:", BULLFY_LEGAL.name],
      ["ID:", BULLFY_LEGAL.id],
      ["Teléfono:", BULLFY_LEGAL.phone],
      ["Correo:", BULLFY_LEGAL.email],
      ["Dirección:", BULLFY_LEGAL.address],
    ],
    styles: { fontSize: 8.5, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 35, textColor: BRAND.darkBlue }, 1: { textColor: BRAND.black } },
    theme: "plain",
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  y = cp(doc, y, 40, logo);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.darkBlue);
  doc.text("PARTE B — EL INTRODUCING BROKER (IB):", 20, y);
  y += 5;

  const ibRows: string[][] = [
    ["Tipo de persona:", formData.tipo_persona],
    [isEmpresa ? "Razón social:" : "Nombre completo:", formData.nombre_ib],
    ["Correo electrónico:", formData.correo_ib],
    [`Identificación (${formData.tipo_id}):`, formData.id_ib],
    ["Región de operación:", formData.lugar_operacion],
    ["Business Developer:", formData.nombre_bd],
  ];
  if (isEmpresa) {
    if (formData.direccion_empresa) ibRows.push(["Dirección empresa:", formData.direccion_empresa]);
    if (formData.contacto_corporativo) ibRows.push(["Contacto corporativo:", formData.contacto_corporativo]);
    if (formData.representante_legal) {
      ibRows.push(["Representante legal:", formData.representante_legal]);
      if (formData.tipo_id_representante && formData.id_representante)
        ibRows.push([`ID Representante (${formData.tipo_id_representante}):`, formData.id_representante]);
    }
  }

  autoTable(doc, {
    startY: y, margin: { left: 20, right: 20 },
    body: ibRows,
    styles: { fontSize: 8.5, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 55, textColor: BRAND.darkBlue }, 1: { textColor: BRAND.black } },
    theme: "plain",
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Sub-IBs table
  if (formData.tiene_sub_ibs && formData.sub_ibs.length > 0) {
    y = cp(doc, y, 20, logo);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...BRAND.darkBlue);
    doc.text("Sub-Introductores bajo este acuerdo:", 20, y);
    y += 4;
    autoTable(doc, {
      startY: y, margin: { left: 20, right: 20 },
      head: [["#", "Nombre", "Correo", "ID"]],
      body: formData.sub_ibs.map((s, i) => [(i + 1).toString(), s.nombre, s.correo, `${s.tipo_id}: ${s.id_documento}`]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: BRAND.blue, textColor: BRAND.white },
      alternateRowStyles: { fillColor: [240, 244, 248] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ═══════════════════════════════════════
  // CLAUSE 1: INTERPRETACIÓN
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "1", "INTERPRETACIÓN", logo);
  y = para(doc, y, "Los siguientes términos tendrán los significados que se les asignan a continuación, salvo que el contexto requiera lo contrario:", logo);

  const definitions: [string, string][] = [
    ["Leyes y Regulaciones Aplicables", "Todas las leyes, regulaciones, directivas, circulares, decisiones administrativas regulatorias y reglas de cualquier mercado regulado o bolsa a los que la Empresa y/o el Introductor estén o puedan estar sujetos."],
    ["Canal(es)", "Fuente de tráfico del Introductor en forma de sitios web, blogs, perfiles de redes sociales u otras plataformas o canales utilizados para prestar los Servicios. Incluye presentaciones, seminarios educativos, campañas y otros eventos."],
    ["Comisión", "La tarifa a la que el Introductor tendrá derecho por la prestación de sus servicios conforme a la Cláusula 7 del Acuerdo."],
    ["CFD", "Un acuerdo entre un 'comprador' y un 'vendedor' para intercambiar la diferencia entre el precio actual de un activo subyacente y su precio al momento del cierre del contrato, sin propiedad ni entrega real del activo."],
    ["Fecha Efectiva", "La fecha en que la Empresa confirme por escrito al Introductor que su proceso de verificación ha concluido satisfactoriamente."],
    ["Cliente", "Persona natural o jurídica que: (A) es referida exclusivamente por el Introductor, (B) no es cliente actual de la Empresa, (C) es incorporada incondicionalmente, (D) celebra un Acuerdo Operativo, (E) deposita el monto mínimo de fondos reales, y (F) cumple con las Leyes Aplicables."],
    ["Cliente Potencial", "Individuo o entidad identificada por el Introductor como oportunidad de negocio para la Empresa, que no tiene cuenta con la Empresa."],
    ["Información Confidencial", "Toda información tangible e intangible divulgada al Introductor en conexión con el Acuerdo, incluyendo la existencia y contenido del Acuerdo, información comercial, operaciones, know-how y secretos comerciales."],
    ["Evento de Fuerza Mayor", "Tiene el significado establecido en la Cláusula 19 del Acuerdo."],
    ["Grupo", "Cualquier entidad que controle a la Empresa o sea controlada por ella, o bajo control común, donde 'control' significa control directo o indirecto de al menos 10% de los derechos de voto."],
    ["Acuerdo Operativo", "Los acuerdos de cliente aplicables que la Empresa celebra con sus Clientes, disponibles en el sitio web de la Empresa."],
    ["URL de Seguimiento", "Hipervínculo único proporcionado por la Empresa al Introductor para referir Clientes Potenciales y calcular la Comisión."],
    ["Sitio Web", "www.bullfy.com, a través del cual opera la Empresa."],
  ];

  y = cp(doc, y, 20, logo);
  autoTable(doc, {
    startY: y, margin: { left: 20, right: 20 },
    head: [["Término", "Definición"]],
    body: definitions,
    styles: { fontSize: 7.5, cellPadding: 2.5, overflow: "linebreak" },
    headStyles: { fillColor: BRAND.darkBlue, textColor: BRAND.white, fontSize: 8 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 40, textColor: BRAND.darkBlue }, 1: { textColor: BRAND.black } },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ═══════════════════════════════════════
  // CLAUSE 2: SERVICIOS
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "2", "SERVICIOS", logo);
  y = subClause(doc, y, "2.1.", "Tras la aprobación escrita de la solicitud del Introductor y la conclusión del Acuerdo, el Introductor prestará los siguientes servicios (los \"Servicios\"):", logo);
  y = bullet(doc, y, "2.1.1. Identificar Clientes Potenciales para la Empresa.", logo);
  y = bullet(doc, y, "2.1.2. Con el consentimiento previo y por escrito de la Empresa, distribuir a Clientes Potenciales información sobre la Empresa a través de los Canales, mostrando la URL de Seguimiento.", logo);
  y = subClause(doc, y, "2.2.", "Al prestar los Servicios, el Introductor se compromete a revelar la capacidad en la que actúa al contactar a cualquier Cliente Potencial y/o Cliente.", logo);
  y = subClause(doc, y, "2.3.", "El Introductor no distribuirá documentación o información relativa a la Empresa, salvo que haya sido aprobada por escrito por la Empresa.", logo);
  y = subClause(doc, y, "2.4.", "El Introductor se compromete a prestar los Servicios de manera diligente, fiel y profesional.", logo);
  y = subClause(doc, y, "2.5.", "El Introductor informará a todos los Clientes Potenciales que su relación con el Cliente será mantenida únicamente con la Empresa.", logo);
  y = subClause(doc, y, "2.6.", "Cuando un Cliente comunique a la Empresa que desea desvincularse del Introductor, la Empresa cesará el pago de Comisiones respecto al Cliente Desvinculado.", logo);
  y = subClause(doc, y, "2.7.", "En caso de que una cuenta archivada de un Cliente sea restaurada, el Introductor no tendrá derecho automático a Comisiones. Puede presentar solicitud escrita a support@bullfy.com.", logo);
  y = subClause(doc, y, "2.8.", "El Introductor será el único responsable de todos los costos incurridos para la prestación de los Servicios.", logo);
  y = subClause(doc, y, "2.9.", "El Introductor se compromete a no solicitar ni atraer de la Empresa empleados, proveedores, afiliados, clientes u otros, durante la vigencia del Acuerdo y por un período de diez (10) años después de su terminación.", logo);
  y = subClause(doc, y, "2.10.", "El Introductor no participará en las Transacciones entre los Clientes y la Empresa. La Empresa es la única Parte elegible para aceptar y salvaguardar los fondos de los Clientes.", logo);

  // ═══════════════════════════════════════
  // CLAUSE 3: DECLARACIONES Y GARANTÍAS
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "3", "DECLARACIONES Y GARANTÍAS", logo);
  y = subClause(doc, y, "3.1.", "El Introductor reconoce que conoce y comprende las políticas y procedimientos de la Empresa (incluyendo políticas anti-lavado de dinero) y acepta conducir su negocio conforme a ellas.", logo);
  y = subClause(doc, y, "3.2.", "El Introductor declara y garantiza que todas las acciones realizadas bajo el Acuerdo cumplirán con las Leyes y Regulaciones Aplicables.", logo);
  y = subClause(doc, y, "3.3.", "El Introductor representa y garantiza que tiene plena capacidad legal para celebrar y cumplir el Acuerdo.", logo);
  y = subClause(doc, y, "3.4.", "El Introductor garantiza que sus operaciones no violarán ninguna ley o regulación aplicable.", logo);
  y = subClause(doc, y, "3.5.", "El Introductor no asesorará a Clientes Potenciales sobre la idoneidad de inversiones financieras.", logo);
  y = subClause(doc, y, "3.6.", "El Introductor no actuará como agente, empleado o representante de la Empresa ante terceros.", logo);
  y = subClause(doc, y, "3.7.", "El Introductor no ofrecerá incentivos prohibidos por las Leyes Aplicables.", logo);
  y = subClause(doc, y, "3.8.", "El Introductor tomará todas las medidas necesarias para garantizar el cumplimiento anti-lavado de dinero.", logo);
  y = subClause(doc, y, "3.9.", "El Introductor representará que dispone de los recursos técnicos y financieros para cumplir con sus obligaciones.", logo);
  y = subClause(doc, y, "3.10.", "El Introductor reportará inmediatamente cualquier sospecha de actividad ilícita.", logo);
  y = subClause(doc, y, "3.11.", "El Introductor no proporcionará a los Clientes acceso a la plataforma de la Empresa sin la aprobación escrita de la Empresa.", logo);
  y = subClause(doc, y, "3.12.", "El Introductor no operará en nombre de los Clientes ni gestionará sus cuentas.", logo);
  y = subClause(doc, y, "3.13.", "El Introductor cumplirá con las instrucciones escritas de la Empresa en todo momento.", logo);
  y = subClause(doc, y, "3.14.", "El Introductor se asegurará de que sus representantes cumplan con las obligaciones de confidencialidad.", logo);
  y = subClause(doc, y, "3.15.", "El Introductor no prestará servicios no contemplados en el Acuerdo, incluyendo asesoría de inversiones o gestión de carteras.", logo);
  y = subClause(doc, y, "3.16.", "El Introductor no permitirá que sus intereses entren en conflicto con sus deberes bajo el Acuerdo.", logo);

  // ═══════════════════════════════════════
  // CLAUSE 4: CONDUCTA DEL INTRODUCTOR
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "4", "CONDUCTA DEL INTRODUCTOR", logo);
  y = subClause(doc, y, "4.1.", "El Introductor será el único responsable de la operación y contenido de sus sitios web y otros canales de marketing. El Introductor NO deberá:", logo);
  y = bullet(doc, y, "(A) Usar técnicas de malware, spyware u otros métodos agresivos de publicidad.", logo);
  y = bullet(doc, y, "(B) Usar scumware u otros métodos predatorios de marketing.", logo);
  y = bullet(doc, y, "(C) Hacer declaraciones falsas, engañosas o despectivas.", logo);
  y = bullet(doc, y, "(D) Participar en prácticas que afecten adversamente la imagen, credibilidad y reputación de la Empresa.", logo);
  y = subClause(doc, y, "4.2.", "Las campañas de pago por clic usando palabras clave asociadas con la Empresa no están permitidas.", logo);
  y = subClause(doc, y, "4.3.", "El Introductor no participará, permitirá ni promoverá ningún acto o tráfico que implique fraude.", logo);
  y = subClause(doc, y, "4.4.", "El Introductor divulgará desde el inicio todos los canales donde publicará material sobre la Empresa.", logo);

  // ═══════════════════════════════════════
  // CLAUSE 5: DIRECTRICES DE PUBLICIDAD
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "5", "DIRECTRICES DE PUBLICIDAD", logo);
  y = subClause(doc, y, "5.1.", "Todo material promocional debe ser aprobado por la Empresa por escrito y cumplir con las Leyes Aplicables.", logo);
  y = subClause(doc, y, "5.2.", "Las siguientes prácticas están prohibidas:", logo);
  y = bullet(doc, y, "(A) Rendimientos prometidos/garantizados.", logo);
  y = bullet(doc, y, "(B) Declaraciones que induzcan a pensar que operar CFDs no conlleva riesgo.", logo);
  y = bullet(doc, y, "(C) Testimonios de cualquier tipo.", logo);
  y = bullet(doc, y, "(D) Publicidad en sitios de apuestas y/o adultos.", logo);
  y = bullet(doc, y, "(E) Marketing tipo spam.", logo);
  y = subClause(doc, y, "5.3.", "Si la Empresa exige (por escrito) que el Introductor deje de usar ciertos materiales de marketing, el Introductor debe cumplir dentro de 24 horas.", logo);

  // ═══════════════════════════════════════
  // CLAUSE 6: DIVULGACIÓN DE RIESGOS
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "6", "DIVULGACIÓN DE RIESGOS Y PROHIBICIÓN DE PROMESAS DE RENDIMIENTO", logo);
  y = subClause(doc, y, "6.1.", "El Introductor debe informar a los Clientes Potenciales por escrito que operar conlleva el riesgo de pérdida de capital.", logo);
  y = subClause(doc, y, "6.2.", "El Introductor no garantizará ni prometerá rendimientos garantizados, exagerados, libres de riesgo o similares.", logo);
  y = subClause(doc, y, "6.3.", "Para una ilustración indicativa de los riesgos, el Introductor referirá a los Clientes Potenciales a la divulgación de riesgos disponible en el Sitio Web de la Empresa.", logo);

  // ═══════════════════════════════════════
  // CLAUSE 7: PROGRAMA DE COMISIONES (Schedule 1) — DYNAMIC
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "7", "PROGRAMA DE COMISIONES (ANEXO 1)", logo);
  y = subClause(doc, y, "7.1.", "En consideración de los servicios prestados por el Introductor, este tendrá derecho a las comisiones detalladas en el \"Anexo 1\" del Acuerdo, sujeto a la reserva de que dichas comisiones están sujetas a pérdida si el Introductor y/o el Cliente introducido incumplen alguna obligación.", logo);
  y = subClause(doc, y, "7.2.", "La Empresa tiene el derecho de disminuir la Comisión en cualquier momento, proporcionando aviso previo por escrito al Introductor.", logo);

  const modeloLabel = formData.modelo_negocio === "Ambos" ? "Ambos (Brokeraje + PropFirm)" : formData.modelo_negocio;
  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.darkBlue);
  y = cp(doc, y, 8, logo);
  doc.text(`Modelo de negocio acordado: ${modeloLabel}`, 22, y);
  y += 6;
  if (formData.tipo_acuerdo_brokeraje) {
    doc.text(`Tipo de acuerdo brokeraje: ${formData.tipo_acuerdo_brokeraje}`, 22, y);
    y += 6;
  }

  const showBrokeraje = formData.modelo_negocio === "Brokeraje" || formData.modelo_negocio === "Ambos";
  const showPropFirm = formData.modelo_negocio === "PropFirm" || formData.modelo_negocio === "Ambos";

  // Rebates info
  if (showBrokeraje && formData.tipo_acuerdo_brokeraje === "Rebates" && formData.spread_config.length > 0) {
    y = cp(doc, y, 15, logo);
    y = para(doc, y, "Modelo Rebates — Compensación por lote operado:", logo);

    const ibLote = formData.nuevo_dolar_ib_global ?? formData.spread_config[0]?.dolares_ib_original ?? 0;
    y = cp(doc, y, 8, logo);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...BRAND.darkBlue);
    doc.text(`Dólares por Lote asignados: $${ibLote}`, 25, y);
    y += 6;
    doc.setFont("helvetica", "normal");
  }

  // CPA table
  if (showBrokeraje && formData.tipo_acuerdo_brokeraje === "CPA" && formData.cpa_config.length > 0) {
    y = cp(doc, y, 15, logo);
    y = para(doc, y, "Modelo CPA (Costo Por Adquisición) — Pago único por depósito de cliente:", logo);
    autoTable(doc, {
      startY: y, margin: { left: 25, right: 25 },
      head: [["Rango de Depósito", "CPA a Pagar"]],
      body: formData.cpa_config.map(c => [c.rango_deposito, `$${c.cpa_pagar}`]),
      styles: { fontSize: 8.5, cellPadding: 2.5 }, headStyles: { fillColor: BRAND.darkBlue, textColor: BRAND.white },
      alternateRowStyles: { fillColor: [240, 244, 248] },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }

  // Hybrid tables
  if (showBrokeraje && formData.tipo_acuerdo_brokeraje === "Híbrido" && formData.hybrid_config.length > 0) {
    y = cp(doc, y, 15, logo);
    y = para(doc, y, "Modelo Híbrido (CPA + Rebates) — Pago CPA por cliente más compensación por lote:", logo);
    autoTable(doc, {
      startY: y, margin: { left: 25, right: 25 },
      head: [["Rango de Depósito", "CPA", "$/Lote"]],
      body: formData.hybrid_config.map(h => [h.rango_deposito, `$${h.cpa_pagar}`, `$${h.dolares_por_lote}`]),
      styles: { fontSize: 8.5, cellPadding: 2.5 }, headStyles: { fillColor: BRAND.darkBlue, textColor: BRAND.white },
      alternateRowStyles: { fillColor: [240, 244, 248] },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

  }

  // PropFirm table
  if (showPropFirm && formData.propfirm_config.length > 0) {
    y = cp(doc, y, 15, logo);
    y = para(doc, y, "Comisiones PropFirm — Porcentaje de ventas de cuentas de fondeo referidas:", logo);
    autoTable(doc, {
      startY: y, margin: { left: 25, right: 25 },
      head: [["Rango de Ventas", "Comisión"]],
      body: formData.propfirm_config.map(p => [p.rango_ventas, `${p.porcentaje_comision}%`]),
      styles: { fontSize: 8.5, cellPadding: 2.5 }, headStyles: { fillColor: BRAND.darkBlue, textColor: BRAND.white },
      alternateRowStyles: { fillColor: [240, 244, 248] },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }

  // CPA/Hybrid activation rules
  if (showBrokeraje && (formData.tipo_acuerdo_brokeraje === "CPA" || formData.tipo_acuerdo_brokeraje === "Híbrido")) {
    y = cp(doc, y, 15, logo);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.darkBlue);
    y = cp(doc, y, 8, logo);
    doc.text("REGLAS DE ACTIVACIÓN CPA", 22, y);
    y += 6;
    y = para(doc, y, "Las siguientes reglas aplican al modelo CPA y/o Híbrido acordado en este contrato:", logo);
    for (const regla of CPA_RULES) {
      y = cp(doc, y, 12, logo);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(50, 50, 50);
      doc.text(regla.titulo, 25, y);
      y += 4.5;
      if (regla.desc) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        doc.text(regla.desc, 30, y);
        y += 4;
      }
      for (const item of regla.items) {
        y = bullet(doc, y, item, logo);
      }
      y += 1.5;
    }
  }

  // Accounts & benefits
  const hasAccounts = (formData.cuentas_marketing_tipo && formData.cuentas_marketing_tipo !== "No tiene") || formData.tiene_fondeo_regalo || formData.tiene_fondeo_especial;
  if (hasAccounts) {
    y = cp(doc, y, 15, logo);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.darkBlue);
    doc.text("CUENTAS Y BENEFICIOS ADICIONALES", 22, y);
    y += 6;
    if (formData.cuentas_marketing_tipo && formData.cuentas_marketing_tipo !== "No tiene") {
      y = bullet(doc, y, `Cuentas de Marketing (${formData.cuentas_marketing_tipo}): ${formData.cuentas_marketing_cantidad} cuentas con balance de $${formData.cuentas_marketing_balance.toLocaleString()}.`, logo);
    }
    if (formData.tiene_fondeo_regalo) {
      y = bullet(doc, y, `Cuentas de Fondeo Regalo: ${formData.fondeo_regalo_cantidad} cuentas con balance de $${formData.fondeo_regalo_balance.toLocaleString()}.`, logo);
    }
    if (formData.tiene_fondeo_especial) {
      y = bullet(doc, y, `Cuenta de Fondeo con Retiro Especial: Balance de $${formData.fondeo_especial_balance.toLocaleString()}.`, logo);
    }
  }

  // ═══════════════════════════════════════
  // CLAUSE 8: TRADING PROHIBIDO
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "8", "TRADING PROHIBIDO", logo);
  y = para(doc, y, "Si la Empresa sospecha o tiene razones para creer que un Cliente está involucrado en cualquier forma de trading prohibido (arbitraje, picking/sniping, scalping, expert advisors, estrategias abusivas, churning), la Empresa se reserva el derecho de:", logo);
  y = bullet(doc, y, "(A) Retrasar el pago de la Comisión hasta que la Empresa investigue el asunto.", logo);
  y = bullet(doc, y, "(B) Terminar el Acuerdo con aviso escrito inmediato y eliminar cualquier Comisión vinculada.", logo);
  y = bullet(doc, y, "(C) Terminar los Acuerdos Operativos con aviso inmediato.", logo);
  y = bullet(doc, y, "(D) Cerrar la cuenta del Introductor y/o suspenderla indefinidamente.", logo);
  y = bullet(doc, y, "(E) Cerrar la cuenta del Cliente y/o suspenderla indefinidamente.", logo);
  y = bullet(doc, y, "(F) Cobrar una penalización al Introductor.", logo);
  y = bullet(doc, y, "(G) Cerrar la(s) cuenta(s) del Cliente, confiscar ganancias del trading prohibido y devolver los depósitos originales.", logo);

  // ═══════════════════════════════════════
  // CLAUSE 9: PAGOS
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "9", "PAGOS", logo);
  y = subClause(doc, y, "9.1.", "Todos los pagos de Comisión se realizarán en la moneda acordada entre las Partes por escrito, conforme al Anexo 1.", logo);
  y = subClause(doc, y, "9.2.", "Salvo acuerdo en contrario, los pagos de Comisión se realizarán dentro de los quince (15) días calendario del final de cada mes.", logo);
  y = subClause(doc, y, "9.3.", "Los pagos se transferirán a la cuenta bancaria del Introductor, salvo acuerdo en contrario.", logo);
  y = subClause(doc, y, "9.4.", "La Empresa se reserva el derecho de anular cualquier Comisión pendiente que haya permanecido impaga por más de trescientos sesenta y cinco (365) días.", logo);
  y = subClause(doc, y, "9.5.", "En caso de contracargo de tarjeta de crédito por un Cliente, todas las Comisiones generadas por esa cuenta serán canceladas.", logo);
  y = subClause(doc, y, "9.6.", "Si la Empresa sospecha abuso o mala fe de un Cliente (apertura/cierre instantáneo de trades para generar Comisiones), se reserva el derecho de suspender el pago.", logo);

  // ═══════════════════════════════════════
  // CLAUSE 10: MODIFICACIONES AL ACUERDO
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "10", "MODIFICACIONES AL ACUERDO", logo);
  y = para(doc, y, "La Empresa retiene el derecho de modificar las disposiciones del presente en cualquier momento mediante aviso escrito al Introductor. Dicha modificación entrará en vigor en la fecha especificada en el aviso. Si el Introductor continúa prestando servicios después de dicha fecha, se considerará que ha aceptado la modificación por conducta.", logo);

  // ═══════════════════════════════════════
  // CLAUSE 11: MODIFICACIONES A LOS SERVICIOS
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "11", "MODIFICACIONES A LOS SERVICIOS DEL INTRODUCTOR", logo);
  y = subClause(doc, y, "11.1.", "Cuando la Empresa considere necesaria alguna modificación a los servicios del Introductor, este acepta efectuar dichas modificaciones dentro del plazo establecido por la Empresa.", logo);
  y = subClause(doc, y, "11.2.", "Si el Introductor no acepta la modificación en el período establecido, la Empresa podrá terminar el Acuerdo de inmediato.", logo);

  // ═══════════════════════════════════════
  // CLAUSE 12: INICIO Y DURACIÓN
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "12", "INICIO Y DURACIÓN", logo);
  y = para(doc, y, "El Acuerdo entrará en vigor en la Fecha Efectiva y continuará vigente hasta su terminación conforme a la Cláusula 13 u otra cláusula que permita la terminación.", logo);

  // ═══════════════════════════════════════
  // CLAUSE 13: TERMINACIÓN
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "13", "TERMINACIÓN", logo);
  y = subClause(doc, y, "13.1.", "Cualquiera de las Partes puede terminar el Acuerdo por cualquier razón con cinco (5) Días Hábiles de aviso previo por escrito.", logo);
  y = subClause(doc, y, "13.2.", "La Empresa puede terminar el Acuerdo con efecto inmediato en caso de:", logo);
  y = bullet(doc, y, "(i) Incumplimiento del Acuerdo por el Introductor.", logo);
  y = bullet(doc, y, "(ii) Uso de materiales de marketing no autorizados.", logo);
  y = bullet(doc, y, "(iii) Alteración de materiales de la Empresa o representación engañosa.", logo);
  y = bullet(doc, y, "(iv) Rechazo de cambios en la Comisión comunicados por la Empresa.", logo);
  y = bullet(doc, y, "(v) Incumplimiento irreparable a criterio de la Empresa.", logo);
  y = bullet(doc, y, "(vi) Incumplimiento del Cliente del Acuerdo Operativo.", logo);
  y = bullet(doc, y, "(vii) Documentación falsa o engañosa por parte del Cliente.", logo);
  y = bullet(doc, y, "(viii) Insolvencia del Introductor.", logo);
  y = bullet(doc, y, "(ix) Fallecimiento o incapacidad del Introductor (persona natural).", logo);
  y = bullet(doc, y, "(x) El Introductor no actúa de buena fe.", logo);
  y = bullet(doc, y, "(xi) Incapacidad del Introductor para cumplir sus obligaciones.", logo);
  y = bullet(doc, y, "(xii) Incumplimiento de las políticas de la Empresa.", logo);
  y = bullet(doc, y, "(xiii) Referir menos de 3 Clientes Potenciales en 30 días desde la Fecha Efectiva.", logo);
  y = bullet(doc, y, "(xiv) Ningún Cliente opera durante 30 días consecutivos.", logo);
  y = bullet(doc, y, "(xv) La comisión impaga no supera USD 50 en los últimos 6 meses.", logo);
  y = subClause(doc, y, "13.3.", "Todos los Clientes y Clientes Potenciales serán y permanecerán en todo momento propiedad de la Empresa, independientemente de la terminación.", logo);
  y = subClause(doc, y, "13.4.", "Si la Empresa sospecha fraude, se reserva el derecho de investigar, terminar el Acuerdo, terminar acuerdos con Clientes, iniciar acciones legales y eliminar Comisiones.", logo);
  y = subClause(doc, y, "13.5.", "Tras la terminación, el Introductor devolverá todo Material Promocional y retirará cualquier material publicado.", logo);
  y = subClause(doc, y, "13.6.", "Tras la terminación, la Empresa pagará al Introductor cualquier Comisión pendiente legítimamente generada.", logo);
  y = subClause(doc, y, "13.7.", "Cada Parte pagará sus propios impuestos y aranceles.", logo);
  y = subClause(doc, y, "13.8.", "Registros y Reportes: Es responsabilidad exclusiva del Introductor asociar la URL de Seguimiento con los Clientes. La Empresa proporcionará un informe mensual de Comisiones.", logo);
  y = subClause(doc, y, "13.9.", "Cada Parte declara que tiene el derecho, poder y capacidad legal para celebrar y cumplir el Acuerdo.", logo);

  // ═══════════════════════════════════════
  // CLAUSE 14: CONSECUENCIAS DE LA TERMINACIÓN
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "14", "CONSECUENCIAS DE LA TERMINACIÓN", logo);
  y = subClause(doc, y, "14.1.", "Las Partes acuerdan que la Cláusula 1 (Interpretación), Cláusula 17 (Confidencialidad), Cláusula 21 (Indemnización) sobrevivirán la terminación del Acuerdo.", logo);
  y = subClause(doc, y, "14.2.", "La terminación no afectará derechos, recursos, obligaciones o responsabilidades acumulados hasta la fecha de terminación.", logo);

  // ═══════════════════════════════════════
  // CLAUSE 15: NOTIFICACIÓN ESCRITA
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "15", "NOTIFICACIÓN ESCRITA", logo);
  y = subClause(doc, y, "15.1.", "Toda notificación escrita podrá realizarse por: correo electrónico, courier o publicación en el Sitio Web de la Empresa.", logo);
  y = subClause(doc, y, "15.2.", "Se utilizarán los datos de contacto proporcionados por el Introductor.", logo);
  y = subClause(doc, y, "15.3.", "La notificación se considerará entregada: por email, dentro de una hora; por courier, al recibir prueba escrita; por sitio web, al momento de publicación.", logo);

  // ═══════════════════════════════════════
  // CLAUSE 16: DATOS PERSONALES
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "16", "DATOS PERSONALES Y GRABACIÓN DE LLAMADAS", logo);
  y = subClause(doc, y, "16.1.", "La Empresa puede usar, almacenar o procesar datos personales proporcionados por el Introductor.", logo);
  y = subClause(doc, y, "16.2.", "Al celebrar el Acuerdo, el Introductor consiente la transmisión de sus datos personales.", logo);
  y = subClause(doc, y, "16.3.", "La Empresa puede compartir información del Introductor con terceros para cumplir sus obligaciones.", logo);
  y = subClause(doc, y, "16.4.", "Los datos personales podrán usarse con fines de marketing o investigación de mercado.", logo);
  y = subClause(doc, y, "16.5.", "El Introductor notificará inmediatamente a la Empresa cualquier queja relacionada con protección de datos.", logo);
  y = subClause(doc, y, "16.6.", "Las conversaciones telefónicas podrán ser grabadas y serán propiedad exclusiva de la Empresa.", logo);

  // ═══════════════════════════════════════
  // CLAUSE 17: CONFIDENCIALIDAD
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "17", "CONFIDENCIALIDAD", logo);
  y = subClause(doc, y, "17.1.", "Cada Parte reconoce que toda información no pública asociada con el negocio de la otra Parte constituye Información Confidencial.", logo);
  y = subClause(doc, y, "17.2.", "El Introductor usará la Información Confidencial únicamente para cumplir sus obligaciones. No será divulgada a terceros sin consentimiento escrito de la Empresa.", logo);
  y = subClause(doc, y, "17.3.", "La Información Confidencial no incluirá información que la Empresa confirme por escrito como no confidencial.", logo);
  y = subClause(doc, y, "17.4.", "El Introductor deberá: (A) mantener en confianza estricta toda Información Confidencial; (B) no divulgar ni reproducir; (C) compartir solo con representantes bajo obligación de confidencialidad; (D) usar el mismo cuidado que con su propia información; (E) mantener separada toda Información Confidencial; (F) no usar para beneficio propio o de terceros; (G) notificar inmediatamente cualquier violación.", logo);
  y = subClause(doc, y, "17.5.", "El Introductor será responsable del cumplimiento de las obligaciones de confidencialidad por parte de sus Representantes.", logo);
  y = subClause(doc, y, "17.6.", "LA INFORMACIÓN CONFIDENCIAL SE PROPORCIONA \"TAL CUAL\", SIN GARANTÍA ALGUNA EN CUANTO A SU EXACTITUD O INTEGRIDAD.", logo);

  // ═══════════════════════════════════════
  // CLAUSE 18: PROPIEDAD INTELECTUAL
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "18", "PROPIEDAD INTELECTUAL", logo);
  y = subClause(doc, y, "18.1.", "La Empresa otorga al Introductor una licencia no exclusiva y revocable para usar la Propiedad durante la vigencia del Acuerdo.", logo);
  y = subClause(doc, y, "18.2.", "La Propiedad permanecerá como propiedad exclusiva de la Empresa y deberá ser devuelta a solicitud.", logo);
  y = subClause(doc, y, "18.3.", "Tras la terminación, el Introductor entregará toda la Propiedad, incluyendo materiales, documentos y datos.", logo);
  y = subClause(doc, y, "18.4.", "El Introductor indemnizará a la Empresa contra cualquier reclamo de infracción de propiedad intelectual.", logo);

  // ═══════════════════════════════════════
  // CLAUSE 19: FUERZA MAYOR
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "19", "FUERZA MAYOR", logo);
  y = subClause(doc, y, "19.1.", "Ninguna Parte será responsable por incumplimiento debido a causas fuera de su control razonable, incluyendo:", logo);
  y = bullet(doc, y, "Acciones gubernamentales, guerra, terrorismo, emergencias nacionales, disturbios civiles.", logo);
  y = bullet(doc, y, "Actos de Dios, terremotos, tsunamis, huracanes, incendios, epidemias.", logo);
  y = bullet(doc, y, "Disputas laborales y paros.", logo);
  y = bullet(doc, y, "Suspensión de operaciones en mercados o prohibiciones regulatorias.", logo);
  y = bullet(doc, y, "Moratorias de servicios financieros declaradas por autoridades regulatorias.", logo);
  y = bullet(doc, y, "Fallas de redes electrónicas y líneas de comunicación.", logo);
  y = subClause(doc, y, "19.2.", "Si la Empresa determina que existe un Evento de Fuerza Mayor, podrá tomar las acciones que considere razonablemente apropiadas.", logo);
  y = subClause(doc, y, "19.3.", "Ninguna Parte tendrá responsabilidad ante la otra por la terminación del Acuerdo como resultado de un Evento de Fuerza Mayor.", logo);

  // ═══════════════════════════════════════
  // CLAUSE 20: EXCLUSIÓN DE RESPONSABILIDAD
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "20", "EXCLUSIÓN DE RESPONSABILIDAD", logo);
  y = subClause(doc, y, "20.1.", "La Empresa no será responsable por: (i) pérdidas del Introductor salvo por negligencia grave o fraude de la Empresa; (ii) pérdidas de Clientes introducidos por negligencia del Introductor; (iii) obligaciones bajo cualquier término implícito.", logo);
  y = subClause(doc, y, "20.2.", "La responsabilidad de la Empresa bajo el Acuerdo no excederá diez mil Dólares Estadounidenses (USD 10,000).", logo);

  // ═══════════════════════════════════════
  // CLAUSE 21: INDEMNIZACIÓN
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "21", "INDEMNIZACIÓN", logo);
  y = para(doc, y, "El Introductor acepta indemnizar y mantener indemne a la Empresa contra todas las violaciones, acciones, demandas, reclamos, costos y gastos que puedan surgir directa o indirectamente de las acciones, omisiones, falsas declaraciones o negligencia del Introductor.", logo);

  // ═══════════════════════════════════════
  // CLAUSE 22: DISPOSICIONES GENERALES
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "22", "DISPOSICIONES GENERALES", logo);
  y = subClause(doc, y, "22.1.", "El Acuerdo y el Anexo 1 constituyen la totalidad del acuerdo entre las Partes y reemplazan todos los acuerdos previos.", logo);
  y = subClause(doc, y, "22.2.", "Cada Parte acepta que no se basa en ninguna declaración o garantía que no forme parte del Acuerdo.", logo);
  y = subClause(doc, y, "22.3.", "El Introductor no se describirá como agente de la Empresa.", logo);
  y = subClause(doc, y, "22.4.", "Todas las referencias a disposiciones legales incluyen modificaciones, consolidaciones y re-promulgaciones.", logo);
  y = subClause(doc, y, "22.5.", "Las palabras en singular incluyen el plural y viceversa; cualquier género incluye todos los géneros.", logo);
  y = subClause(doc, y, "22.6.", "Nada en el Acuerdo creará una relación laboral, sociedad o empresa conjunta entre las Partes.", logo);
  y = subClause(doc, y, "22.7.", "El Introductor acepta que el Acuerdo es legalmente vinculante.", logo);

  // ═══════════════════════════════════════
  // CLAUSE 23: CESIÓN
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "23", "CESIÓN", logo);
  y = subClause(doc, y, "23.1.", "Ninguna Parte cederá, transferirá o subcontratará sus derechos u obligaciones sin consentimiento.", logo);
  y = subClause(doc, y, "23.2.", "La Empresa puede, con cinco (5) Días Hábiles de aviso, ceder sus derechos a cualquier miembro de su Grupo.", logo);

  // ═══════════════════════════════════════
  // CLAUSE 24: SUBCONTRATACIÓN
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "24", "SUBCONTRATACIÓN", logo);
  y = para(doc, y, "El Introductor no podrá utilizar ningún tipo de subcontratación o externalización en la prestación de los servicios sin la aprobación previa y por escrito de la Empresa.", logo);

  // ═══════════════════════════════════════
  // CLAUSE 25: SUB-INTRODUCTORES
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "25", "SUB-INTRODUCTORES", logo);
  y = subClause(doc, y, "25.1.", "Esta Cláusula aplica al Introductor solo si ha sido notificado por escrito que ha sido categorizado como Introductor Maestro. Un \"Introductor Maestro\" es un Introductor que ha presentado potenciales introductores a la Empresa, quienes han celebrado acuerdos de introducción con la Empresa (cada uno, un \"Sub-Introductor\").", logo);
  y = subClause(doc, y, "25.2.", "El Introductor Maestro tendrá derecho a una porción de las comisiones de cada Acuerdo de Sub-Introductor, según se acuerde por escrito.", logo);
  y = subClause(doc, y, "25.3.", "La Empresa no es ni será responsable de consejos o decisiones del Introductor Maestro hacia un Sub-Introductor.", logo);
  y = subClause(doc, y, "25.4.", "Se especifica que:", logo);
  y = bullet(doc, y, "(A) La Empresa puede aceptar o rechazar un Sub-Introductor a su discreción.", logo);
  y = bullet(doc, y, "(B) El Introductor Maestro no actuará como empleado o agente de la Empresa ante el Sub-Introductor.", logo);
  y = bullet(doc, y, "(C) El Introductor Maestro informará claramente que la relación comercial es entre el Sub-Introductor y la Empresa.", logo);
  y = bullet(doc, y, "(D) Los pagos al Introductor Maestro se realizarán después del pago de cada Sub-Introductor.", logo);
  y = bullet(doc, y, "(E) Tras la terminación, el Introductor Maestro no tendrá derecho a comisiones del Sub-Introductor.", logo);

  // ═══════════════════════════════════════
  // CLAUSE 26: LEY APLICABLE Y JURISDICCIÓN
  // ═══════════════════════════════════════
  y = clauseTitle(doc, y, "26", "LEY APLICABLE Y JURISDICCIÓN", logo);
  y = subClause(doc, y, "26.1.", "El Acuerdo se regirá e interpretará de conformidad con las leyes de Santa Lucía.", logo);
  y = subClause(doc, y, "26.2.", "Los tribunales de Santa Lucía tendrán jurisdicción exclusiva para resolver cualquier disputa entre las Partes.", logo);

  // ─── Negociaciones Especiales (conditional) ───
  if (formData.negociaciones_especiales?.trim()) {
    y = cp(doc, y, 15, logo);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.darkBlue);
    y = cp(doc, y, 8, logo);
    doc.text("NEGOCIACIONES ESPECIALES", 22, y);
    y += 6;
    y = para(doc, y, "Las Partes han acordado las siguientes condiciones especiales que complementan los términos generales del presente Acuerdo:", logo);
    y = para(doc, y, formData.negociaciones_especiales!.trim(), logo);
  }

  // ─── Signature block ───
  y = cp(doc, y, 70, logo);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.darkBlue);
  y = cp(doc, y, 8, logo);
  doc.text("EN FE DE LO CUAL, LAS PARTES HAN FIRMADO EL ACUERDO EN LA FECHA INDICADA:", 20, y);
  y += 10;

  doc.setFillColor(245, 247, 250);
  doc.roundedRect(15, y, 180, 55, 3, 3, "F");
  doc.setDrawColor(...BRAND.darkBlue);
  doc.setLineWidth(0.5);
  doc.roundedRect(15, y, 180, 55, 3, 3, "S");
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.darkBlue);
  doc.text("FIRMAS", 105, y, { align: "center" });
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text("Por La Empresa:", 30, y);
  doc.text("Por El Introductor:", 130, y);
  y += 14;
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.line(25, y, 90, y);
  doc.line(120, y, 185, y);
  y += 5;
  doc.setFontSize(8);
  doc.text(BULLFY_LEGAL.name, 30, y);
  doc.text(formData.nombre_ib, 130, y);
  y += 4;
  doc.text("Representante Autorizado", 30, y);
  if (isEmpresa && formData.representante_legal) {
    doc.text(`Rep. Legal: ${formData.representante_legal}`, 130, y);
  } else {
    doc.text(formData.correo_ib, 130, y);
  }
  y += 4;
  doc.text(`ID: ${BULLFY_LEGAL.id}`, 30, y);
  if (isEmpresa && formData.tipo_id_representante && formData.id_representante) {
    doc.text(`ID Rep.: ${formData.id_representante}`, 130, y);
  } else {
    doc.text(`ID: ${formData.id_ib}`, 130, y);
  }
  y += 4;
  doc.text(`Fecha: ${dateStr}`, 30, y);
  doc.text(`Fecha: ${dateStr}`, 130, y);

  addFooter(doc);
  return doc;
}

/* ── Sub-IB Agreement ── */

export interface SubIBCompensation {
  dolares_por_lote?: number;
  cpa_allocation?: { rango_deposito: string; dolares_asignados: number }[];
  hybrid_lote?: number;
  hybrid_cpa_allocation?: { rango_deposito: string; dolares_asignados: number }[];
  propfirm_comision?: number;
}

export function generateSubIBAgreementPDF(
  formData: OnboardingFormData,
  subIB: SubIB,
  reportNumber: string,
  ibId: string,
  logoBase64?: string | null,
  compensation?: SubIBCompensation
): jsPDF {
  const subFormData: OnboardingFormData = {
    ...formData,
    nombre_ib: subIB.nombre,
    correo_ib: subIB.correo,
    tipo_id: subIB.tipo_id,
    id_ib: subIB.id_documento,
    tiene_sub_ibs: false,
    sub_ibs: [],
  };

  if (compensation) {
    if (compensation.dolares_por_lote !== undefined && compensation.dolares_por_lote > 0) {
      subFormData.nuevo_dolar_ib_global = compensation.dolares_por_lote;
      subFormData.spread_config = subFormData.spread_config.map(s => {
        const diff = compensation.dolares_por_lote! - s.dolares_ib_original;
        return {
          ...s,
          nuevo_dolar_ib: compensation.dolares_por_lote!,
          dolares_ib_original: compensation.dolares_por_lote!,
          diferencia: diff,
          nuevo_spread_cliente: s.raw + s.dolares_ib_original + compensation.dolares_por_lote!,
        };
      });
    }

    if (compensation.cpa_allocation && compensation.cpa_allocation.length > 0) {
      subFormData.cpa_config = subFormData.cpa_config.map(c => {
        const match = compensation.cpa_allocation!.find(a => a.rango_deposito === c.rango_deposito);
        return match ? { ...c, cpa_pagar: match.dolares_asignados } : c;
      });
    }

    if (compensation.hybrid_lote !== undefined && compensation.hybrid_lote > 0) {
      subFormData.hybrid_config = subFormData.hybrid_config.map(h => {
        const match = compensation.hybrid_cpa_allocation?.find(a => a.rango_deposito === h.rango_deposito);
        return {
          ...h,
          dolares_por_lote: compensation.hybrid_lote!,
          cpa_pagar: match ? match.dolares_asignados : h.cpa_pagar,
        };
      });
    }

    if (formData.propfirm_cobro_tipo !== "niveles") {
      subFormData.propfirm_config = [];
    }
  }

  return generateAgreementPDF(subFormData, reportNumber, ibId, logoBase64);
}
