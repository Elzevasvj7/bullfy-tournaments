import { supabase } from "@/integrations/supabase/client";
import type { OnboardingFormData } from "@/stores/onboardingStore";

export async function saveOnboardingToDB(formData: OnboardingFormData, userId: string) {
  // Check for duplicate email
  const { data: existing } = await supabase
    .from("ibs")
    .select("id, nombre_ib")
    .eq("correo_ib", formData.correo_ib)
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error(`Ya existe un IB registrado con el correo "${formData.correo_ib}" (${existing[0].nombre_ib}). No se puede duplicar.`);
  }

  // 1. Insert main IB record
  const { data: ibData, error: ibError } = await supabase
    .from("ibs")
    .insert({
      tipo_persona: formData.tipo_persona || 'Persona Física',
      nombre_bd: formData.nombre_bd,
      nombre_ib: formData.nombre_ib,
      correo_ib: formData.correo_ib,
      tipo_id: formData.tipo_id,
      id_ib: formData.id_ib,
      direccion_empresa: formData.tipo_persona === 'Empresa' ? formData.direccion_empresa : null,
      contacto_corporativo: formData.tipo_persona === 'Empresa' ? formData.contacto_corporativo : null,
      representante_legal: formData.tipo_persona === 'Empresa' ? formData.representante_legal : null,
      tipo_id_representante: formData.tipo_persona === 'Empresa' ? formData.tipo_id_representante : null,
      id_representante: formData.tipo_persona === 'Empresa' ? formData.id_representante : null,
      negociaciones_especiales: formData.negociaciones_especiales || null,
      tipo_grupo_cuentas: formData.tipo_grupo_cuentas || null,
      lugar_operacion: formData.lugar_operacion,
      modelo_negocio: formData.modelo_negocio,
      tipo_acuerdo_brokeraje: formData.tipo_acuerdo_brokeraje || null,
      tiene_sub_ibs: formData.tiene_sub_ibs,
      cuentas_marketing_tipo: formData.cuentas_marketing_tipo && formData.cuentas_marketing_tipo !== "No tiene" ? formData.cuentas_marketing_tipo : null,
      cuentas_marketing_cantidad: formData.cuentas_marketing_tipo && formData.cuentas_marketing_tipo !== "No tiene" ? (formData.cuentas_marketing_cantidad || null) : null,
      cuentas_marketing_balance: formData.cuentas_marketing_tipo && formData.cuentas_marketing_tipo !== "No tiene" ? (formData.cuentas_marketing_balance || null) : null,
      tiene_fondeo_regalo: formData.tiene_fondeo_regalo,
      fondeo_regalo_cantidad: formData.tiene_fondeo_regalo ? formData.fondeo_regalo_cantidad : null,
      fondeo_regalo_balance: formData.tiene_fondeo_regalo ? formData.fondeo_regalo_balance : null,
      tiene_fondeo_especial: formData.tiene_fondeo_especial,
      fondeo_especial_balance: formData.tiene_fondeo_especial ? formData.fondeo_especial_balance : null,
      clientes_por_mes: formData.generar_performance ? formData.clientes_por_mes : null,
      depositos_por_mes: formData.generar_performance ? formData.depositos_por_mes : null,
      lotes_por_mes: formData.generar_performance ? formData.lotes_por_mes : null,
      cuentas_fondeo_vendidas: formData.generar_performance ? formData.cuentas_fondeo_vendidas : null,
      tipo_cuenta_fondeo: formData.tipo_cuenta_fondeo || null,
      tiene_codigo_descuento: (formData.modelo_negocio === "PropFirm" || formData.modelo_negocio === "Ambos") ? formData.tiene_codigo_descuento : false,
      codigo_descuento: formData.tiene_codigo_descuento ? formData.codigo_descuento || null : null,
      porcentaje_descuento: formData.tiene_codigo_descuento ? formData.porcentaje_descuento || null : null,
      created_by: userId,
      status: "submitted",
      kickoff_video_path: formData.video_kickoff_path || null,
      tiene_comision_por_lote: formData.tiene_comision_por_lote,
      comision_dolares_por_lote: formData.tiene_comision_por_lote ? formData.comision_dolares_por_lote : null,
      nombre_comunidad: formData.tiene_nombre_comunidad ? formData.nombre_comunidad : null,
    } as any)
    .select("id")
    .single();

  if (ibError) throw new Error(`Error guardando IB: ${ibError.message}`);
  const ibId = ibData.id;

  // 2. Insert Sub IBs — dolares_por_lote for Master IBs comes from rebate allocations
  if (formData.tiene_sub_ibs && formData.sub_ibs.length > 0) {
    const subIbRows = formData.sub_ibs.map((s, idx) => {
      let dolaresLote: number | null = s.dolares_por_lote ?? null;
      // For Master IBs, prefer the value from rebate allocations (set in StepRebates)
      if (s.es_master_ib && formData.sub_ib_rebate_allocations[idx]) {
        const allocated = formData.sub_ib_rebate_allocations[idx].dolares_asignados;
        if (allocated > 0) dolaresLote = allocated;
      }
      return {
        ib_id: ibId,
        nombre: s.nombre,
        correo: s.correo,
        tipo_id: s.tipo_id,
        id_documento: s.id_documento,
        es_master_ib: s.es_master_ib ?? false,
        master_ib_numero: s.es_master_ib ? s.master_ib_numero : null,
        dolares_por_lote: s.es_master_ib ? dolaresLote : null,
      };
    });
    const { error } = await supabase.from("sub_ibs").insert(subIbRows as any);
    if (error) throw new Error(`Error guardando Sub IBs: ${error.message}`);
  }

  // 3. Insert Spread Config (for Rebates, CPA, or Híbrido)
  if (formData.spread_config.length > 0) {
    const spreadRows = formData.spread_config.map((s) => ({
      ib_id: ibId,
      symbol: s.symbol,
      raw: s.raw,
      spread_estandar: s.spread_estandar,
      dolares_ib_original: s.dolares_ib_original,
      nuevo_dolar_ib: s.nuevo_dolar_ib,
    }));
    const { error } = await supabase.from("ib_spread_config").insert(spreadRows);
    if (error) throw new Error(`Error guardando Spreads: ${error.message}`);
  }

  // 4. Insert CPA Config
  if (formData.cpa_config.length > 0) {
    const cpaRows = formData.cpa_config.map((c) => ({
      ib_id: ibId,
      rango_deposito: c.rango_deposito,
      cpa_pagar: c.cpa_pagar,
    }));
    const { error } = await supabase.from("ib_cpa_config").insert(cpaRows);
    if (error) throw new Error(`Error guardando CPA Config: ${error.message}`);
  }

  // 5. Insert CPA Distribution
  if (formData.repartir_cpa && formData.cpa_distribution.length > 0) {
    // Get sub_ib ids if needed
    let subIbMap: Record<string, string> = {};
    if (formData.tiene_sub_ibs) {
      const { data: subIbs } = await supabase
        .from("sub_ibs")
        .select("id, correo")
        .eq("ib_id", ibId);
      if (subIbs) {
        subIbs.forEach((s) => { subIbMap[s.correo] = s.id; });
      }
    }

    const distRows = formData.cpa_distribution.flatMap((d) =>
      d.asignaciones.map((a) => ({
        ib_id: ibId,
        nombre: d.nombre,
        correo: d.correo,
        dolares_asignados: a.dolares_asignados,
        es_sub_ib: d.es_sub_ib,
        sub_ib_id: d.es_sub_ib ? (subIbMap[d.correo] || null) : null,
      }))
    );

    if (distRows.length > 0) {
      const { error } = await supabase.from("ib_cpa_distribution").insert(distRows);
      if (error) throw new Error(`Error guardando CPA Distribution: ${error.message}`);
    }
  }

  // 6. Insert Hybrid Config
  if (formData.hybrid_config.length > 0) {
    const hybridRows = formData.hybrid_config.map((h) => ({
      ib_id: ibId,
      rango_deposito: h.rango_deposito,
      cpa_pagar: h.cpa_pagar,
      dolares_por_lote: h.dolares_por_lote,
    }));
    const { error } = await supabase.from("ib_hybrid_config").insert(hybridRows);
    if (error) throw new Error(`Error guardando Hybrid Config: ${error.message}`);
  }

  // 7. Insert PropFirm Config
  if (formData.propfirm_config.length > 0) {
    const propRows = formData.propfirm_config.map((p) => ({
      ib_id: ibId,
      rango_ventas: p.rango_ventas,
      porcentaje_comision: p.porcentaje_comision,
    }));
    const { error } = await supabase.from("ib_propfirm_config").insert(propRows);
    if (error) throw new Error(`Error guardando PropFirm Config: ${error.message}`);
  }

  // 8. Auto-generate reports (technical + agreement + performance if applicable)
  await autoGenerateReports(ibId, formData);

  return ibId;
}

/**
 * Automatically generates and stores reports in DB after saving an IB.
 * Reports are stored for Ops access regardless of whether the BD downloads them.
 */
async function autoGenerateReports(ibId: string, formData: OnboardingFormData) {
  try {
    // Technical Report
    await supabase.from("reports").insert({
      ib_id: ibId,
      report_type: "technical",
      report_number: "TEMP",
      nombre_ib: formData.nombre_ib,
      nombre_bd: formData.nombre_bd,
      data: formData as any,
    });

    // Agreement
    await supabase.from("reports").insert({
      ib_id: ibId,
      report_type: "agreement",
      report_number: "TEMP",
      nombre_ib: formData.nombre_ib,
      nombre_bd: formData.nombre_bd,
      data: formData as any,
    });

    // Sub IB Agreements
    if (formData.tiene_sub_ibs && formData.sub_ibs.length > 0) {
      for (const subIB of formData.sub_ibs) {
        await supabase.from("reports").insert({
          ib_id: ibId,
          report_type: "agreement",
          report_number: "TEMP",
          nombre_ib: subIB.nombre,
          nombre_bd: formData.nombre_bd,
          data: {
            ...formData,
            _is_sub_ib: true,
            _sub_ib_agreement_for: subIB.nombre,
            _sub_ib_correo: subIB.correo,
            _parent_ib_name: formData.nombre_ib,
            _parent_ib_correo: formData.correo_ib,
          } as any,
        });
      }
    }

    // Performance (only if selected and has data)
    if (formData.generar_performance && formData.clientes_por_mes > 0) {
      await supabase.from("reports").insert({
        ib_id: ibId,
        report_type: "performance",
        report_number: "TEMP",
        nombre_ib: formData.nombre_ib,
        nombre_bd: formData.nombre_bd,
        data: formData as any,
      });
    }
  } catch (err) {
    console.error("Error auto-generating reports:", err);
    // Don't throw - reports are secondary to the main save
  }
}
