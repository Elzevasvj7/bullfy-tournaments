import { create } from 'zustand';

export interface SubIB {
  nombre: string;
  correo: string;
  tipo_id: string;
  id_documento: string;
  es_master_ib: boolean;
  master_ib_numero: number | null;
  dolares_por_lote: number | null;
}

export interface SpreadConfig {
  symbol: string;
  raw: number;
  spread_estandar: number;
  dolares_ib_original: number;
  ajuste_manual: number;
  nuevo_dolar_ib: number | null;
  diferencia: number;
  nuevo_spread_cliente: number;
}

export interface CPAConfig {
  rango_deposito: string;
  cpa_pagar: number;
}

export interface HybridConfig {
  rango_deposito: string;
  cpa_pagar: number;
  dolares_por_lote: number;
}

export interface SubIBRebateAllocation {
  nombre: string;
  correo: string;
  dolares_asignados: number;
}

export interface PropFirmNivel {
  nivel: number;
  porcentaje: number;
}

export interface PropFirmConfig {
  rango_ventas: string;
  porcentaje_comision: number;
  niveles: PropFirmNivel[];
}

export interface CPARangoAsignacion {
  rango_deposito: string;
  dolares_asignados: number;
}

export interface CPADistribution {
  nombre: string;
  correo: string;
  asignaciones: CPARangoAsignacion[];
  es_sub_ib: boolean;
}

export interface OnboardingFormData {
  // Step 1: Info General
  tipo_persona: 'Persona Física' | 'Empresa' | '';
  nombre_bd: string;
  nombre_ib: string;
  correo_ib: string;
  tipo_id: string;
  id_ib: string;
  direccion_empresa: string;
  contacto_corporativo: string;
  representante_legal: string;
  tipo_id_representante: string;
  id_representante: string;
  negociaciones_especiales: string;
  tipo_grupo_cuentas: 'CENT' | 'Estándar' | 'Ambas' | '';

  // Step 2: Lugar de operación
  lugar_operacion: 'LATAM' | 'Europa' | 'Resto del Mundo' | '';

  // Step 3: Sub IBs
  tiene_sub_ibs: boolean;
  sub_ibs: SubIB[];

  // Step 4: Modelo de negocio
  modelo_negocio: 'Brokeraje' | 'PropFirm' | 'Ambos' | '';

  // Step 5: Tipo acuerdo brokeraje
  tipo_acuerdo_brokeraje: 'Rebates' | 'CPA' | 'Híbrido' | '';

  // Step 6: Rebates config
  usar_spreads_default: boolean;
  spread_config: SpreadConfig[];
  nuevo_dolar_ib_global: number | null;
  sub_ib_rebate_allocations: SubIBRebateAllocation[];
  dolares_ib_restante: number | null;

  // Step 7: CPA config
  usar_cpa_default: boolean;
  cpa_config: CPAConfig[];

  // Step 7b: CPA Distribution
  repartir_cpa: boolean;
  cpa_distribution: CPADistribution[];

  // Step 8: Hybrid config
  usar_hybrid_default: boolean;
  hybrid_config: HybridConfig[];
  hybrid_nuevo_dolar_lote: number | null;

  // Step 9: PropFirm config
  usar_propfirm_default: boolean;
  propfirm_cobro_tipo: 'directo' | 'niveles' | '';
  propfirm_config: PropFirmConfig[];

  // Step 10: Marketing accounts
  cuentas_marketing_tipo: 'No tiene' | 'Real Marketing' | 'Fondeo Marketing' | 'Ambas' | '';
  cuentas_marketing_cantidad: number;
  cuentas_marketing_balance: number;

  // Step 10b: Código de descuento (PropFirm)
  tiene_codigo_descuento: boolean;
  codigo_descuento: string;
  porcentaje_descuento: number;

  // Step 11: Fondeo regalo
  tiene_fondeo_regalo: boolean;
  fondeo_regalo_cantidad: number;
  fondeo_regalo_balance: number;

  // Step 12: Fondeo especial
  tiene_fondeo_especial: boolean;
  fondeo_especial_balance: number;

  // Step 13: Performance Calculator
  generar_performance: boolean;
  clientes_por_mes: number;
  depositos_por_mes: number;
  estrategia_trading: 'Conservadora' | 'Moderada' | 'Agresiva' | '';
  lotes_por_mes: number;
  lotes_manual: boolean;
  cuentas_fondeo_vendidas: number;
  tipo_cuenta_fondeo: string;

  // Comisión por lote operado
  tiene_comision_por_lote: boolean;
  comision_dolares_por_lote: number | null;

  // Nombre Comunidad
  tiene_nombre_comunidad: boolean;
  nombre_comunidad: string;

  // Kickoff Video
  tiene_video_kickoff: boolean;
  video_kickoff_file: File | null;
  video_kickoff_path: string | null;
}

interface OnboardingStore {
  currentStep: number;
  formData: OnboardingFormData;
  isTestMode: boolean;
  savedIbId: string | null;
  testCompleted: boolean;
  downloadedReports: string[];
  editMode: boolean;
  editingIbId: string | null;
  setCurrentStep: (step: number) => void;
  updateFormData: (data: Partial<OnboardingFormData>) => void;
  setTestMode: (val: boolean) => void;
  setSavedIbId: (id: string | null) => void;
  setTestCompleted: (val: boolean) => void;
  addDownloadedReport: (type: string) => void;
  loadForEdit: (ibId: string, data: OnboardingFormData) => void;
  resetForm: () => void;
  nextStep: () => void;
  prevStep: () => void;
}

const initialFormData: OnboardingFormData = {
  tipo_persona: '',
  nombre_bd: '',
  nombre_ib: '',
  correo_ib: '',
  tipo_id: '',
  id_ib: '',
  direccion_empresa: '',
  contacto_corporativo: '',
  representante_legal: '',
  tipo_id_representante: '',
  id_representante: '',
  negociaciones_especiales: '',
  tipo_grupo_cuentas: '',
  lugar_operacion: '',
  tiene_sub_ibs: false,
  sub_ibs: [] as SubIB[],
  modelo_negocio: '',
  tipo_acuerdo_brokeraje: '',
  usar_spreads_default: true,
  spread_config: [],
  nuevo_dolar_ib_global: null,
  sub_ib_rebate_allocations: [],
  dolares_ib_restante: null,
  usar_cpa_default: true,
  cpa_config: [],
  repartir_cpa: false,
  cpa_distribution: [],
  usar_hybrid_default: true,
  hybrid_config: [],
  hybrid_nuevo_dolar_lote: null,
  usar_propfirm_default: true,
  propfirm_cobro_tipo: 'directo',
  propfirm_config: [],
  cuentas_marketing_tipo: '',
  cuentas_marketing_cantidad: 0,
  cuentas_marketing_balance: 0,
  tiene_fondeo_regalo: false,
  fondeo_regalo_cantidad: 0,
  fondeo_regalo_balance: 0,
  tiene_codigo_descuento: false,
  codigo_descuento: '',
  porcentaje_descuento: 0,
  tiene_fondeo_especial: false,
  fondeo_especial_balance: 0,
  generar_performance: false,
  clientes_por_mes: 0,
  depositos_por_mes: 0,
  estrategia_trading: '',
  lotes_por_mes: 0,
  lotes_manual: false,
  cuentas_fondeo_vendidas: 0,
  tipo_cuenta_fondeo: '',
  tiene_comision_por_lote: false,
  comision_dolares_por_lote: null,
  tiene_nombre_comunidad: false,
  nombre_comunidad: '',
  tiene_video_kickoff: false,
  video_kickoff_file: null,
  video_kickoff_path: null,
};

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  currentStep: 0,
  formData: { ...initialFormData },
  isTestMode: false,
  savedIbId: null,
  testCompleted: false,
  downloadedReports: [],
  editMode: false,
  editingIbId: null,
  setCurrentStep: (step) => set({ currentStep: step }),
  updateFormData: (data) =>
    set((state) => ({ formData: { ...state.formData, ...data } })),
  setTestMode: (val) => set({ isTestMode: val }),
  setSavedIbId: (id) => set({ savedIbId: id }),
  setTestCompleted: (val) => set({ testCompleted: val }),
  addDownloadedReport: (type) =>
    set((state) => ({
      downloadedReports: state.downloadedReports.includes(type)
        ? state.downloadedReports
        : [...state.downloadedReports, type],
    })),
  loadForEdit: (ibId, data) => set({
    currentStep: 0,
    formData: { ...data },
    isTestMode: false,
    savedIbId: null,
    testCompleted: false,
    downloadedReports: [],
    editMode: true,
    editingIbId: ibId,
  }),
  resetForm: () => set({
    currentStep: 0,
    formData: { ...initialFormData },
    isTestMode: false,
    savedIbId: null,
    testCompleted: false,
    downloadedReports: [],
    editMode: false,
    editingIbId: null,
  }),
  nextStep: () => set((state) => ({ currentStep: state.currentStep + 1 })),
  prevStep: () =>
    set((state) => ({
      currentStep: Math.max(0, state.currentStep - 1),
    })),
}));
