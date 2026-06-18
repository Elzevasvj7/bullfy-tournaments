import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, FileText, Receipt, TrendingUp, ArrowDownToLine, ArrowUpFromLine,
  Wallet, Banknote, LineChart, Boxes, BarChart3, Sparkles, MessageSquare,
  AlertTriangle, FileBarChart, Lock, ShieldCheck, Building2, Settings as Cog, CreditCard,
} from "lucide-react";

type Tile = {
  to: string;
  label: string;
  description: string;
  icon: typeof FileText;
  gradient: string;
  ring: string;
  iconBg: string;
  show?: boolean;
};

type Section = { title: string; tiles: Tile[] };

export default function ContabilidadHome() {
  const { isGlobalAdmin, isDirectivo, isAccountant, isAccountingUser } = useAuth();
  const canSeeCEO = isGlobalAdmin || isDirectivo || isAccountant;

  const sections: Section[] = [
    {
      title: "Vista Ejecutiva",
      tiles: [
        {
          to: "/contabilidad/dashboard",
          label: "Dashboard CEO",
          description: "KPIs del mes, forecast IA, resultado neto",
          icon: LayoutDashboard,
          gradient: "from-amber-400 via-yellow-500 to-amber-600",
          ring: "ring-amber-300/40",
          iconBg: "bg-amber-900/30",
          show: canSeeCEO,
        },
      ],
    },
    {
      title: "Operaciones",
      tiles: [
        { to: "/contabilidad/facturas", label: "Facturas / Tickets", description: "OCR, captura y revisión", icon: FileText,
          gradient: "from-blue-500 via-blue-600 to-blue-700", ring: "ring-blue-300/40", iconBg: "bg-blue-900/30" },
        { to: "/contabilidad/gastos", label: "Gastos", description: "Registro y categorización", icon: Receipt,
          gradient: "from-rose-500 via-red-600 to-rose-700", ring: "ring-rose-300/40", iconBg: "bg-rose-900/30" },
        { to: "/contabilidad/ingresos", label: "Ingresos", description: "Cobros y facturación", icon: TrendingUp,
          gradient: "from-emerald-500 via-green-600 to-emerald-700", ring: "ring-emerald-300/40", iconBg: "bg-emerald-900/30" },
      ],
    },
    {
      title: "Tesorería",
      tiles: [
        { to: "/contabilidad/cobrar", label: "Por Cobrar (AR)", description: "Cuentas pendientes de cobro", icon: ArrowDownToLine,
          gradient: "from-teal-500 via-emerald-500 to-teal-600", ring: "ring-teal-300/40", iconBg: "bg-teal-900/30" },
        { to: "/contabilidad/pagar", label: "Por Pagar (AP)", description: "Cuentas pendientes de pago", icon: ArrowUpFromLine,
          gradient: "from-orange-500 via-amber-500 to-orange-600", ring: "ring-orange-300/40", iconBg: "bg-orange-900/30" },
        { to: "/contabilidad/tesoreria", label: "Tesorería", description: "Cuentas, saldos y transferencias", icon: Wallet,
          gradient: "from-yellow-500 via-amber-500 to-yellow-600", ring: "ring-yellow-300/40", iconBg: "bg-yellow-900/30" },
        { to: "/contabilidad/conciliacion", label: "Conciliación", description: "Match bancario y ajustes", icon: Banknote,
          gradient: "from-cyan-500 via-sky-500 to-cyan-600", ring: "ring-cyan-300/40", iconBg: "bg-cyan-900/30" },
        { to: "/contabilidad/flujo-caja", label: "Flujo de Caja", description: "Entradas y salidas reales", icon: LineChart,
          gradient: "from-sky-500 via-blue-500 to-sky-600", ring: "ring-sky-300/40", iconBg: "bg-sky-900/30" },
      ],
    },
    {
      title: "Activos y Presupuesto",
      tiles: [
        { to: "/contabilidad/activos", label: "Activos", description: "Inventario y depreciación", icon: Boxes,
          gradient: "from-purple-500 via-violet-600 to-purple-700", ring: "ring-purple-300/40", iconBg: "bg-purple-900/30" },
        { to: "/contabilidad/presupuestos", label: "Presupuestos", description: "Planeación vs real", icon: BarChart3,
          gradient: "from-indigo-500 via-indigo-600 to-indigo-700", ring: "ring-indigo-300/40", iconBg: "bg-indigo-900/30" },
      ],
    },
    {
      title: "Análisis e IA",
      tiles: [
        { to: "/contabilidad/insights", label: "Insights IA", description: "Análisis automático de tu data", icon: Sparkles,
          gradient: "from-violet-500 via-purple-600 to-fuchsia-600", ring: "ring-violet-300/40", iconBg: "bg-violet-900/30" },
        { to: "/contabilidad/chat", label: "Chat contable", description: "Pregunta a tu IA contable", icon: MessageSquare,
          gradient: "from-pink-500 via-fuchsia-500 to-pink-600", ring: "ring-pink-300/40", iconBg: "bg-pink-900/30" },
        { to: "/contabilidad/alertas", label: "Alertas", description: "Eventos que requieren atención", icon: AlertTriangle,
          gradient: "from-orange-500 via-red-500 to-orange-600", ring: "ring-orange-300/40", iconBg: "bg-orange-900/30" },
        { to: "/contabilidad/anomalias", label: "Anomalías", description: "Detección de irregularidades", icon: AlertTriangle,
          gradient: "from-red-500 via-rose-600 to-red-700", ring: "ring-red-300/40", iconBg: "bg-red-900/30" },
      ],
    },
    {
      title: "Reportes y Compliance",
      tiles: [
        { to: "/contabilidad/reportes", label: "Reportes", description: "P&L, balance, flujo", icon: BarChart3,
          gradient: "from-slate-500 via-slate-600 to-slate-700", ring: "ring-slate-300/40", iconBg: "bg-slate-900/40" },
        { to: "/contabilidad/reportes-fiscales", label: "Reportes fiscales", description: "Declaraciones y obligaciones", icon: FileBarChart,
          gradient: "from-blue-700 via-indigo-700 to-blue-900", ring: "ring-blue-300/40", iconBg: "bg-blue-950/50" },
        { to: "/contabilidad/periodos", label: "Períodos", description: "Cierres mensuales y anuales", icon: Lock,
          gradient: "from-zinc-500 via-zinc-600 to-zinc-700", ring: "ring-zinc-300/40", iconBg: "bg-zinc-900/40" },
        { to: "/contabilidad/auditoria", label: "Auditoría", description: "Bitácora y trazabilidad", icon: ShieldCheck,
          gradient: "from-green-600 via-emerald-700 to-green-800", ring: "ring-green-300/40", iconBg: "bg-green-900/40" },
      ],
    },
    {
      title: "Configuración",
      tiles: [
        { to: "/contabilidad/entidades", label: "Entidades", description: "Empresas, clientes y proveedores", icon: Building2,
          gradient: "from-stone-500 via-stone-600 to-stone-700", ring: "ring-stone-300/40", iconBg: "bg-stone-900/40" },
        { to: "/contabilidad/tarjetas", label: "Tarjetas", description: "Débito/crédito por usuario para gastos", icon: CreditCard,
          gradient: "from-blue-500 via-indigo-600 to-blue-700", ring: "ring-blue-300/40", iconBg: "bg-blue-900/40" },
        { to: "/contabilidad/catalogos", label: "Catálogos", description: "Cuentas, categorías y monedas", icon: Cog,
          gradient: "from-gray-500 via-gray-600 to-gray-700", ring: "ring-gray-300/40", iconBg: "bg-gray-900/40" },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Contabilidad</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Gestión financiera, tesorería e inteligencia contable de Bullfy.
        </p>
      </div>

      {sections.map((section) => {
        const visible = section.tiles.filter((t) => t.show !== false);
        if (!visible.length) return null;
        return (
          <section key={section.title} className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground">
              {section.title}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visible.map((tile) => {
                const Icon = tile.icon;
                return (
                  <Link
                    key={tile.to}
                    to={tile.to}
                    className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${tile.gradient} p-5 shadow-lg ring-1 ${tile.ring} transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:ring-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60`}
                  >
                    <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10 blur-2xl group-hover:bg-white/20 transition-colors" />
                    <div className="relative flex flex-col gap-4 h-full min-h-[140px]">
                      <div className={`w-11 h-11 rounded-xl ${tile.iconBg} backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20`}>
                        <Icon className="w-5 h-5 text-white" strokeWidth={2} />
                      </div>
                      <div className="mt-auto">
                        <div className="text-base font-bold text-white drop-shadow-sm">
                          {tile.label}
                        </div>
                        <div className="text-xs text-white/80 mt-1 leading-snug">
                          {tile.description}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
