import { supabase } from "@/integrations/supabase/client";
import type { OnboardingFormData } from "@/stores/onboardingStore";
import { generateTechnicalReportPDF } from "./generateTechnicalReport";
import { generateAgreementPDF } from "./generateAgreement";
import { generatePerformanceReportPDF } from "./generatePerformanceReport";
import { getLogoBase64 } from "./pdfLogoHelper";

/**
 * Updates an existing IB's conditions (configs), increments version,
 * and generates new reports with the updated data.
 */
export async function updateIBConditions(ibId: string, formData: OnboardingFormData): Promise<{ version: number; reportCount: number }> {
  // Capture user + previous state for audit log
  const { data: { user } } = await supabase.auth.getUser();
  const { data: oldIb } = await supabase.from("ibs").select("*").eq("id", ibId).maybeSingle();

  // 1. Delete old configs
  await Promise.all([
    supabase.from("ib_spread_config").delete().eq("ib_id", ibId),
    supabase.from("ib_cpa_config").delete().eq("ib_id", ibId),
    supabase.from("ib_hybrid_config").delete().eq("ib_id", ibId),
    supabase.from("ib_propfirm_config").delete().eq("ib_id", ibId),
    supabase.from("ib_cpa_distribution").delete().eq("ib_id", ibId),
  ]);

  // 2. Insert new configs
  if (formData.spread_config.length > 0) {
    const rows = formData.spread_config.map((s) => ({
      ib_id: ibId,
      symbol: s.symbol,
      raw: s.raw,
      spread_estandar: s.spread_estandar,
      dolares_ib_original: s.dolares_ib_original,
      nuevo_dolar_ib: s.nuevo_dolar_ib,
    }));
    const { error } = await supabase.from("ib_spread_config").insert(rows);
    if (error) throw new Error(`Error guardando spreads: ${error.message}`);
  }

  if (formData.cpa_config.length > 0) {
    const rows = formData.cpa_config.map((c) => ({
      ib_id: ibId,
      rango_deposito: c.rango_deposito,
      cpa_pagar: c.cpa_pagar,
    }));
    const { error } = await supabase.from("ib_cpa_config").insert(rows);
    if (error) throw new Error(`Error guardando CPA: ${error.message}`);
  }

  if (formData.hybrid_config.length > 0) {
    const rows = formData.hybrid_config.map((h) => ({
      ib_id: ibId,
      rango_deposito: h.rango_deposito,
      cpa_pagar: h.cpa_pagar,
      dolares_por_lote: h.dolares_por_lote,
    }));
    const { error } = await supabase.from("ib_hybrid_config").insert(rows);
    if (error) throw new Error(`Error guardando Hybrid: ${error.message}`);
  }

  if (formData.propfirm_config.length > 0) {
    const rows = formData.propfirm_config.map((p) => ({
      ib_id: ibId,
      rango_ventas: p.rango_ventas,
      porcentaje_comision: p.porcentaje_comision,
    }));
    const { error } = await supabase.from("ib_propfirm_config").insert(rows);
    if (error) throw new Error(`Error guardando PropFirm: ${error.message}`);
  }

  // 3. Update IB main record + increment version
  const { data: ibData, error: ibError } = await supabase
    .from("ibs")
    .update({
      modelo_negocio: formData.modelo_negocio,
      tipo_acuerdo_brokeraje: formData.tipo_acuerdo_brokeraje || null,
      cuentas_marketing_tipo: formData.cuentas_marketing_tipo && formData.cuentas_marketing_tipo !== "No tiene" ? formData.cuentas_marketing_tipo : null,
      cuentas_marketing_cantidad: formData.cuentas_marketing_tipo && formData.cuentas_marketing_tipo !== "No tiene" ? (formData.cuentas_marketing_cantidad || null) : null,
      cuentas_marketing_balance: formData.cuentas_marketing_tipo && formData.cuentas_marketing_tipo !== "No tiene" ? (formData.cuentas_marketing_balance || null) : null,
      tiene_fondeo_regalo: formData.tiene_fondeo_regalo,
      fondeo_regalo_cantidad: formData.tiene_fondeo_regalo ? formData.fondeo_regalo_cantidad : null,
      fondeo_regalo_balance: formData.tiene_fondeo_regalo ? formData.fondeo_regalo_balance : null,
      tiene_fondeo_especial: formData.tiene_fondeo_especial,
      fondeo_especial_balance: formData.tiene_fondeo_especial ? formData.fondeo_especial_balance : null,
      tiene_codigo_descuento: formData.tiene_codigo_descuento,
      codigo_descuento: formData.tiene_codigo_descuento ? formData.codigo_descuento || null : null,
      porcentaje_descuento: formData.tiene_codigo_descuento ? formData.porcentaje_descuento || null : null,
      clientes_por_mes: formData.generar_performance ? formData.clientes_por_mes : null,
      depositos_por_mes: formData.generar_performance ? formData.depositos_por_mes : null,
      lotes_por_mes: formData.generar_performance ? formData.lotes_por_mes : null,
      cuentas_fondeo_vendidas: formData.generar_performance ? formData.cuentas_fondeo_vendidas : null,
      tipo_cuenta_fondeo: formData.tipo_cuenta_fondeo || null,
      tiene_comision_por_lote: formData.tiene_comision_por_lote,
      comision_dolares_por_lote: formData.tiene_comision_por_lote ? formData.comision_dolares_por_lote : null,
      tipo_grupo_cuentas: formData.tipo_grupo_cuentas || null,
    } as any)
    .eq("id", ibId)
    .select("version")
    .maybeSingle();

  if (ibError) throw new Error(`Error actualizando IB: ${ibError.message}`);
  
  // Increment version
  const newVersion = (ibData?.version ?? 1) + 1;
  await supabase.from("ibs").update({ version: newVersion } as any).eq("id", ibId);

  // Audit log: record the IB conditions update
  try {
    await supabase.from("audit_log").insert({
      table_name: "ibs",
      record_id: ibId,
      action: "UPDATE",
      old_data: (oldIb as any) || null,
      new_data: { ...formData, _version: newVersion } as any,
      changed_fields: ["modelo_negocio", "configs", "version"],
      user_id: user?.id || null,
    });
  } catch (auditErr) {
    console.warn("audit_log insert failed (non-blocking):", auditErr);
  }

  // 4. Generate new reports
  const logo = await getLogoBase64();
  let reportCount = 0;

  // Technical report
  const techReport = {
    ib_id: ibId,
    report_type: "technical",
    report_number: "", // auto-generated by trigger
    nombre_ib: formData.nombre_ib,
    nombre_bd: formData.nombre_bd,
    data: { ...formData, _is_update: true } as any,
  };
  const { error: techErr } = await supabase.from("reports").insert(techReport);
  if (!techErr) reportCount++;

  // Agreement
  const agrReport = {
    ib_id: ibId,
    report_type: "agreement",
    report_number: "",
    nombre_ib: formData.nombre_ib,
    nombre_bd: formData.nombre_bd,
    data: formData as any,
  };
  const { error: agrErr } = await supabase.from("reports").insert(agrReport);
  if (!agrErr) reportCount++;

  // Performance (only if performance data exists)
  if (formData.generar_performance && formData.clientes_por_mes > 0) {
    const perfReport = {
      ib_id: ibId,
      report_type: "performance",
      report_number: "",
      nombre_ib: formData.nombre_ib,
      nombre_bd: formData.nombre_bd,
      data: formData as any,
    };
    const { error: perfErr } = await supabase.from("reports").insert(perfReport);
    if (!perfErr) reportCount++;
  }

  return { version: newVersion, reportCount };
}
