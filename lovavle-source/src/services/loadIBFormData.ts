import { supabase } from "@/integrations/supabase/client";
import type { OnboardingFormData, SpreadConfig, CPAConfig, HybridConfig, PropFirmConfig } from "@/stores/onboardingStore";

/**
 * Loads the current IB record + all config tables and reconstructs an OnboardingFormData object.
 * Used for editing conditions of an existing IB.
 */
export async function loadIBFormData(ibId: string): Promise<OnboardingFormData> {
  const [ibRes, spreadsRes, cpaRes, hybridRes, propfirmRes, subIbsRes] = await Promise.all([
    supabase.from("ibs").select("*").eq("id", ibId).single(),
    supabase.from("ib_spread_config").select("*").eq("ib_id", ibId),
    supabase.from("ib_cpa_config").select("*").eq("ib_id", ibId),
    supabase.from("ib_hybrid_config").select("*").eq("ib_id", ibId),
    supabase.from("ib_propfirm_config").select("*").eq("ib_id", ibId),
    supabase.from("sub_ibs").select("*").eq("ib_id", ibId),
  ]);

  if (ibRes.error || !ibRes.data) throw new Error("No se pudo cargar el IB");
  const ib = ibRes.data;

  const spreadConfig: SpreadConfig[] = (spreadsRes.data ?? []).map((s) => ({
    symbol: s.symbol,
    raw: s.raw,
    spread_estandar: s.spread_estandar,
    dolares_ib_original: s.dolares_ib_original,
    ajuste_manual: 0,
    nuevo_dolar_ib: s.nuevo_dolar_ib,
    diferencia: s.diferencia ?? 0,
    nuevo_spread_cliente: s.nuevo_spread_cliente ?? s.spread_estandar,
  }));

  const cpaConfig: CPAConfig[] = (cpaRes.data ?? []).map((c) => ({
    rango_deposito: c.rango_deposito,
    cpa_pagar: c.cpa_pagar,
  }));

  const hybridConfig: HybridConfig[] = (hybridRes.data ?? []).map((h) => ({
    rango_deposito: h.rango_deposito,
    cpa_pagar: h.cpa_pagar,
    dolares_por_lote: h.dolares_por_lote,
  }));

  const propfirmConfig: PropFirmConfig[] = (propfirmRes.data ?? []).map((p) => ({
    rango_ventas: p.rango_ventas,
    porcentaje_comision: p.porcentaje_comision,
    niveles: [],
  }));

  const subIbs = (subIbsRes.data ?? []).map((s: any) => ({
    nombre: s.nombre,
    correo: s.correo,
    tipo_id: s.tipo_id,
    id_documento: s.id_documento,
    es_master_ib: s.es_master_ib ?? false,
    master_ib_numero: s.master_ib_numero ?? null,
    dolares_por_lote: s.dolares_por_lote ?? null,
  }));

  return {
    tipo_persona: (ib as any).tipo_persona || 'Persona Física',
    nombre_bd: ib.nombre_bd,
    nombre_ib: ib.nombre_ib,
    correo_ib: ib.correo_ib,
    tipo_id: ib.tipo_id,
    id_ib: ib.id_ib,
    direccion_empresa: (ib as any).direccion_empresa || '',
    contacto_corporativo: (ib as any).contacto_corporativo || '',
    representante_legal: (ib as any).representante_legal || '',
    tipo_id_representante: (ib as any).tipo_id_representante || '',
    id_representante: (ib as any).id_representante || '',
    negociaciones_especiales: (ib as any).negociaciones_especiales || '',
    tipo_grupo_cuentas: (ib as any).tipo_grupo_cuentas || '',
    lugar_operacion: ib.lugar_operacion as OnboardingFormData["lugar_operacion"],
    tiene_sub_ibs: ib.tiene_sub_ibs,
    sub_ibs: subIbs,
    modelo_negocio: ib.modelo_negocio as OnboardingFormData["modelo_negocio"],
    tipo_acuerdo_brokeraje: (ib.tipo_acuerdo_brokeraje || "") as OnboardingFormData["tipo_acuerdo_brokeraje"],
    usar_spreads_default: false,
    spread_config: spreadConfig,
    nuevo_dolar_ib_global: null,
    sub_ib_rebate_allocations: [],
    dolares_ib_restante: null,
    usar_cpa_default: false,
    cpa_config: cpaConfig,
    repartir_cpa: false,
    cpa_distribution: [],
    usar_hybrid_default: false,
    hybrid_config: hybridConfig,
    hybrid_nuevo_dolar_lote: null,
    usar_propfirm_default: false,
    propfirm_cobro_tipo: "directo",
    propfirm_config: propfirmConfig,
    cuentas_marketing_tipo: (ib.cuentas_marketing_tipo || "No tiene") as OnboardingFormData["cuentas_marketing_tipo"],
    cuentas_marketing_cantidad: ib.cuentas_marketing_cantidad ?? 0,
    cuentas_marketing_balance: ib.cuentas_marketing_balance ?? 0,
    tiene_codigo_descuento: ib.tiene_codigo_descuento ?? false,
    codigo_descuento: ib.codigo_descuento ?? "",
    porcentaje_descuento: ib.porcentaje_descuento ?? 0,
    tiene_fondeo_regalo: ib.tiene_fondeo_regalo ?? false,
    fondeo_regalo_cantidad: ib.fondeo_regalo_cantidad ?? 0,
    fondeo_regalo_balance: ib.fondeo_regalo_balance ?? 0,
    tiene_fondeo_especial: ib.tiene_fondeo_especial ?? false,
    fondeo_especial_balance: ib.fondeo_especial_balance ?? 0,
    generar_performance: !!(ib.clientes_por_mes || ib.depositos_por_mes),
    clientes_por_mes: ib.clientes_por_mes ?? 0,
    depositos_por_mes: ib.depositos_por_mes ?? 0,
    estrategia_trading: "",
    lotes_por_mes: ib.lotes_por_mes ?? 0,
    lotes_manual: false,
    cuentas_fondeo_vendidas: ib.cuentas_fondeo_vendidas ?? 0,
    tipo_cuenta_fondeo: ib.tipo_cuenta_fondeo ?? "",
    tiene_comision_por_lote: (ib as any).tiene_comision_por_lote ?? false,
    comision_dolares_por_lote: (ib as any).comision_dolares_por_lote ?? null,
    tiene_nombre_comunidad: !!(ib as any).nombre_comunidad,
    nombre_comunidad: (ib as any).nombre_comunidad ?? '',
    tiene_video_kickoff: !!ib.kickoff_video_path,
    video_kickoff_file: null,
    video_kickoff_path: ib.kickoff_video_path ?? null,
  };
}
