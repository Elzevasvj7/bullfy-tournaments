// Shared CPA activation rules used in reports and agreements
export const CPA_RULES = [
  {
    titulo: "Activación CPA",
    desc: "Debe cumplirse en 30 días:",
    items: [
      "Opción A: 2 lotes operados",
      "Opción B: 10 operaciones + 1 lote operado, cada una con mínimo 3 minutos",
    ],
  },
  {
    titulo: "Corte y Pagos",
    items: ["Corte: 30 de cada mes", "Pago: 15-20 del mes siguiente"],
  },
  {
    titulo: "Regla de Retiros",
    items: ["Si el cliente retira capital antes del pago, el CPA no se paga"],
  },
  {
    titulo: "Regla ROI2",
    items: [
      "El cliente debe generar depósitos equivalentes a 2x CPA",
      "Ejemplo: CPA $200 → mínimo $400 en depósitos",
    ],
  },
  {
    titulo: "Regla Saldo Negativo",
    items: [
      "Si el CPA fue pagado y el cliente retira capital, el IB queda con saldo negativo",
    ],
  },
  {
    titulo: "Depósitos NO Válidos",
    items: [
      "Cliente existente",
      "Depósitos duplicados",
      "IP sospechosa",
      "Depósito retirado sin operar",
    ],
  },
  {
    titulo: "Depósitos Válidos",
    items: ["Primer depósito real", "No transferencias internas"],
  },
  {
    titulo: "Retiro de CPA IB",
    items: ["Retiro mínimo acumulado: $1,000"],
  },
];
