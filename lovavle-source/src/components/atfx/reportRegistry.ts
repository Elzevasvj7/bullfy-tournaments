import { LucideIcon } from "lucide-react";

export interface ReportDef {
  id: string;
  label: string;
}
export interface CategoryDef {
  id: string;
  label: string;
  icon: string; // emoji or icon name
  reports: ReportDef[];
}
export interface SectionDef {
  id: "broker" | "prop" | "system" | "dealing";
  label: string;
  icon: string;
  categories: CategoryDef[];
}

export const ATFX_SECTIONS: SectionDef[] = [
  {
    id: "broker",
    label: "Broker",
    icon: "🏦",
    categories: [
      { id: "overview", label: "Overview & KPIs", icon: "📊", reports: [
        { id: "dashboard", label: "Dashboard general" },
      ]},
      { id: "customers", label: "Clientes", icon: "👥", reports: [
        { id: "list", label: "Lista de clientes" },
        { id: "detail", label: "Detalle de cliente" },
        { id: "accounts", label: "Cuentas del cliente" },
        { id: "transactions", label: "Transacciones del cliente" },
        { id: "kyc", label: "Documentos KYC" },
        { id: "logins", label: "Historial de logins" },
        { id: "notes", label: "Notas internas" },
      ]},
      { id: "transactions", label: "Transacciones", icon: "💰", reports: [
        { id: "deposits", label: "Depósitos" },
        { id: "withdrawals", label: "Retiros" },
        { id: "transfers", label: "Transferencias internas" },
        { id: "adjustments", label: "Ajustes manuales" },
        { id: "commissions", label: "Comisiones cobradas" },
      ]},
      { id: "trading", label: "Trading", icon: "📈", reports: [
        { id: "open", label: "Trades abiertos (live)" },
        { id: "closed", label: "Trades cerrados" },
        { id: "pending", label: "Órdenes pendientes" },
        { id: "volume", label: "Volumen agregado" },
        { id: "symbols", label: "Símbolos disponibles" },
      ]},
      { id: "accounts", label: "Cuentas", icon: "💼", reports: [
        { id: "list", label: "Lista de cuentas" },
        { id: "detail", label: "Detalle de cuenta" },
      ]},
      { id: "agents", label: "Agentes / IBs", icon: "🤝", reports: [
        { id: "list", label: "Lista de agentes" },
        { id: "detail", label: "Detalle / referidos" },
        { id: "commissions", label: "Comisiones generadas" },
        { id: "hierarchy", label: "Estructura jerárquica" },
        { id: "payouts", label: "Pagos a agentes" },
      ]},
      { id: "promos", label: "Promos & Bonos", icon: "🎁", reports: [
        { id: "bonuses", label: "Bonos activos" },
        { id: "promotions", label: "Promociones" },
        { id: "coupons", label: "Cupones" },
      ]},
      { id: "financial", label: "Reportes financieros", icon: "📊", reports: [
        { id: "profit", label: "P&L global" },
        { id: "pamm", label: "PAMM / Copy" },
        { id: "store_revenue", label: "Store revenue" },
      ]},
      { id: "store", label: "Store", icon: "🛒", reports: [
        { id: "products", label: "Productos" },
        { id: "orders", label: "Órdenes" },
        { id: "subscriptions", label: "Suscripciones" },
      ]},
    ],
  },
  {
    id: "prop",
    label: "Propfirm",
    icon: "🎯",
    categories: [
      { id: "overview", label: "Overview Prop", icon: "📊", reports: [
        { id: "dashboard", label: "Dashboard prop" },
      ]},
      { id: "challenges", label: "Challenges", icon: "📋", reports: [
        { id: "list", label: "Challenges vendidos" },
        { id: "types", label: "Tipos disponibles" },
        { id: "detail", label: "Detalle de challenge" },
      ]},
      { id: "participants", label: "Participantes", icon: "🧑‍💼", reports: [
        { id: "list", label: "Lista de participantes" },
        { id: "detail", label: "Detalle / drill-down" },
        { id: "goals", label: "Goals & reglas en vivo" },
        { id: "phases", label: "Historial de fases" },
        { id: "trades", label: "Trades del participante" },
        { id: "resets", label: "Resets / re-challenges" },
        { id: "equity", label: "Equity curve" },
      ]},
      { id: "sales", label: "Ventas & Revenue", icon: "💵", reports: [
        { id: "summary", label: "Resumen de ventas" },
        { id: "by_type", label: "Ventas por tipo" },
        { id: "revenue", label: "Ingresos totales" },
        { id: "conversion", label: "Tasa de conversión" },
        { id: "arpu", label: "ARPU / LTV" },
        { id: "coupons", label: "Cupones aplicados" },
      ]},
      { id: "payouts", label: "Payouts", icon: "🏆", reports: [
        { id: "list", label: "Lista de payouts" },
      ]},
      { id: "trading", label: "Trading prop", icon: "📈", reports: [
        { id: "open", label: "Trades abiertos" },
        { id: "closed", label: "Trades cerrados" },
        { id: "alerts", label: "Drawdown alertas" },
      ]},
      { id: "funded", label: "Funded Accounts", icon: "🎟️", reports: [
        { id: "list", label: "Cuentas funded" },
        { id: "performance", label: "Performance funded" },
        { id: "breaches", label: "Breaches" },
      ]},
    ],
  },
  {
    id: "system",
    label: "Sistema",
    icon: "⚙️",
    categories: [
      { id: "system", label: "Sistema", icon: "⚙️", reports: [
        { id: "test", label: "Test de conexión" },
        { id: "adapters", label: "Adapters / LPs" },
        { id: "groups", label: "Grupos de trading" },
        { id: "webhooks", label: "Webhooks" },
        { id: "audit", label: "Audit log" },
        { id: "raw", label: "🛠️ Raw API Explorer" },
      ]},
    ],
  },
  {
    id: "dealing",
    label: "Dealing Desk",
    icon: "🏛️",
    categories: [
      { id: "risk", label: "Gestión de riesgo", icon: "⚖️", reports: [
        { id: "lp_margin", label: "Análisis de Margen LP" },
      ]},
    ],
  },
];

export function findReport(section: string, category: string, report: string) {
  const s = ATFX_SECTIONS.find(x => x.id === section);
  const c = s?.categories.find(x => x.id === category);
  const r = c?.reports.find(x => x.id === report);
  return { section: s, category: c, report: r };
}
