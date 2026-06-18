import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { toast } from "@/lib/toastUtils";
import { usePortalBrand, brandText } from "@/lib/portalBrand";
import {
  Activity,
  BarChart3,
  Bot,
  Calculator,
  Check,
  Clock3,
  Lock,
  Newspaper,
  PlayCircle,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Star,
  TrendingUp,
  X,
} from "lucide-react";
import { PlanSelectorMenu } from "./PlanSelectorMenu";
import { CARD_PAYMENT_ENABLED } from "@/lib/paymentConfig";

interface BullfyTradingRoomProps {
  portalId: string;
  userId: string;
  userName: string;
  isHost?: boolean;
}

interface TradingPlan {
  id: string;
  plan_code: string;
  display_name: string;
  session_label: string | null;
  target_price_monthly: number;
  metaapi_cost_monthly: number;
  active_hours_per_month: number;
  notes: string | null;
}

interface TradingAccount {
  id: string;
  mt_login: string | null;
  metaapi_account_id: string | null;
  broker_server: string | null;
  provider: string | null;
  account_label: string | null;
  selected_session_key: string | null;
  connection_status: string;
  refreshes_per_day: number;
  ai_analysis_frequency: string;
  last_snapshot_at: string | null;
  last_analysis_at: string | null;
  balance?: number | null;
  equity?: number | null;
  margin?: number | null;
  free_margin?: number | null;
  currency?: string | null;
}

interface TradingSubscription {
  id: string;
  plan_id: string;
  price_monthly: number;
  access_status: string;
  billing_status: string;
}

interface TradingAccessState {
  override_enabled: boolean;
  effective_access: string;
  can_trade: boolean;
  is_test_user: boolean;
  active_test_plan_ids: string[];
}

interface OrderIntent {
  id: string;
  side: "buy" | "sell";
  lot_size: number;
  stop_loss: number | null;
  take_profit: number | null;
  symbol: string | null;
  execution_status: string;
  failure_reason?: string | null;
  requested_at: string;
  executed_at?: string | null;
}

interface AnalysisRun {
  id: string;
  status: string;
  summary: string | null;
  created_at: string;
}

interface OpenPosition {
  id: string;
  symbol: string;
  type: string;
  volume: number | null;
  open_price: number | null;
  current_price: number | null;
  profit: number | null;
  opened_at: string | null;
  updated_at: string | null;
  comment?: string | null;
}

interface FavoriteSymbol {
  id: string;
  symbol: string;
  display_name: string | null;
}

interface BrokerSymbolOption {
  symbol: string;
  display_name: string;
}

interface TradingAccountSlim extends TradingAccount {
  is_active_for_stream?: boolean;
  bridge_login?: string | null;
}

interface TradingRoomState {
  plans: TradingPlan[];
  subscription: TradingSubscription | null;
  account: TradingAccountSlim | null;
  accounts?: { metaapi: TradingAccountSlim | null; bridge: TradingAccountSlim | null };
  open_positions: OpenPosition[];
  favorite_symbols: FavoriteSymbol[];
  recent_orders: OrderIntent[];
  recent_analyses: AnalysisRun[];
  access: TradingAccessState;
}

const emptyState: TradingRoomState = {
  plans: [],
  subscription: null,
  account: null,
  accounts: { metaapi: null, bridge: null },
  open_positions: [],
  favorite_symbols: [],
  recent_orders: [],
  recent_analyses: [],
  access: {
    override_enabled: false,
    effective_access: "inactive",
    can_trade: false,
    is_test_user: false,
    active_test_plan_ids: [],
  },
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatMoney = (value?: number | null, currency = "USD") => {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatDecimal = (value?: number | null, digits = 2) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
};

const getConnectionStatusDisplay = (status?: string | null) => {
  const normalized = (status || "not_connected").trim().toLowerCase();

  if (normalized === "connected") {
    return {
      label: "CONNECTED",
      className: "border-success/30 bg-success/15 text-success",
      icon: Check,
    };
  }

  return {
    label: normalized.toUpperCase(),
    className: "border-border bg-muted/40 text-foreground",
    icon: null,
  };
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  return fallback;
};

const ALLOWED_BROKER_SERVER = "Bullfy-Trade";

const BullfyTradingRoom = ({ portalId, userId, isHost = false }: BullfyTradingRoomProps) => {
  const { isWhiteLabel } = usePortalBrand();
  const [state, setState] = useState<TradingRoomState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const [checkingOutPlan, setCheckingOutPlan] = useState<"stripe_gateway" | "crypto" | null>(null);
  
  const [sendingOrder, setSendingOrder] = useState(false);
  const [closingPositions, setClosingPositions] = useState(false);
  const [requestingAnalysis, setRequestingAnalysis] = useState(false);
  const [searchingSymbols, setSearchingSymbols] = useState(false);
  const [updatingFavoriteSymbol, setUpdatingFavoriteSymbol] = useState<string | null>(null);
  const [symbolSearch, setSymbolSearch] = useState("");
  const [brokerSymbolResults, setBrokerSymbolResults] = useState<BrokerSymbolOption[]>([]);
  const [metaapiForm, setMetaapiForm] = useState({
    mt_login: "",
    mt_password: "",
    broker_server: ALLOWED_BROKER_SERVER,
    selected_session_key: "stream_only" as "stream_only" | "ny" | "london" | "hk",
  });
  const [bridgeForm, setBridgeForm] = useState({
    mt_login: "",
    mt_password: "",
    broker_server: ALLOWED_BROKER_SERVER,
    selected_session_key: "stream_only" as "stream_only" | "ny" | "london" | "hk",
  });
  const [savingProvider, setSavingProvider] = useState<"metaapi" | "bridge" | null>(null);
  const [testingProvider, setTestingProvider] = useState<"metaapi" | "bridge" | null>(null);
  const [activatingProvider, setActivatingProvider] = useState<"metaapi" | "bridge" | null>(null);
  const [orderForm, setOrderForm] = useState({
    symbol: "XAUUSD",
    lot_size: "0.10",
    stop_loss: "",
    take_profit: "",
  });
  const [activeTab, setActiveTab] = useState<string>("operativa");

  const loadState = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const { data, error } = await supabase.functions.invoke("trading-room-client", {
        body: {
          action: "get_state",
          portal_id: portalId,
          partner_user_id: userId,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "No se pudo cargar Trading Room");

      const nextState = (data.state || emptyState) as TradingRoomState;
      setState(nextState);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, brandText(isWhiteLabel, "Error cargando Bullfy Trading Room")));
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [portalId, userId]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // Initialize/refresh form values ONLY when the underlying account row changes
  // (not on every silent poll) so the user can keep typing without interruptions.
  const metaapiAccountId = state.accounts?.metaapi?.id ?? null;
  const bridgeAccountId = state.accounts?.bridge?.id ?? null;
  useEffect(() => {
    const ma = state.accounts?.metaapi ?? null;
    setMetaapiForm({
      mt_login: ma?.mt_login || "",
      mt_password: "",
      broker_server: ma?.broker_server || ALLOWED_BROKER_SERVER,
      selected_session_key: (ma?.selected_session_key as any) || "stream_only",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaapiAccountId]);
  useEffect(() => {
    const br = state.accounts?.bridge ?? null;
    setBridgeForm({
      mt_login: br?.mt_login || "",
      mt_password: "",
      broker_server: br?.broker_server || ALLOWED_BROKER_SERVER,
      selected_session_key: (br?.selected_session_key as any) || "stream_only",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridgeAccountId]);

  // Focus-aware polling: skip refresh while user is typing in an input/textarea
  useEffect(() => {
    if (!state.account?.id) return;
    const intervalId = window.setInterval(() => {
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement | null)?.isContentEditable) {
        return;
      }
      void loadState({ silent: true });
    }, 8000);
    return () => window.clearInterval(intervalId);
  }, [loadState, state.account?.id]);

  // Realtime push from bridge_account_snapshot (Bridge MT5 only). Updates open
  // positions and balance with sub-second latency, no extra HTTP polling.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`bullfy-bridge-snap-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bridge_account_snapshot", filter: `partner_user_id=eq.${userId}` },
        (payload: any) => {
          const row = payload.new as { open_positions?: unknown; balance?: number | null } | null;
          if (!row) return;
          const positions = Array.isArray(row.open_positions) ? row.open_positions : [];
          setState((prev) => {
            // Only apply when the active account is Bridge.
            if (prev.account?.provider !== "bridge") return prev;
            return {
              ...prev,
              open_positions: positions as typeof prev.open_positions,
              account: prev.account
                ? { ...prev.account, ...(typeof row.balance === "number" ? { balance: row.balance } : {}) }
                : prev.account,
            };
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);



  const selectedPlan = useMemo(
    () => state.plans.find((plan) => plan.id === state.subscription?.plan_id) || null,
    [state.plans, state.subscription?.plan_id],
  );

  const activeTestPlans = useMemo(
    () => state.plans.filter((plan) => state.access.active_test_plan_ids.includes(plan.id)),
    [state.plans, state.access.active_test_plan_ids],
  );

  const favoriteSymbols = state.favorite_symbols ?? [];
  const openPositions = state.open_positions ?? [];

  const favoriteSymbolMap = useMemo(
    () => new Set(favoriteSymbols.map((item) => item.symbol.toUpperCase())),
    [favoriteSymbols],
  );

  const handlePlanSelect = async (planId: string) => {
    setSavingPlanId(planId);
    try {
      const { data, error } = await supabase.functions.invoke("trading-room-client", {
        body: {
          action: "set_plan",
          portal_id: portalId,
          partner_user_id: userId,
          plan_id: planId,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "No se pudo guardar el plan");
      toast.success(state.access.is_test_user ? "Plan de prueba habilitado" : "Plan actualizado");
      await loadState({ silent: true });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error guardando plan"));
    } finally {
      setSavingPlanId(null);
    }
  };

  const handleAccountSave = async (provider: "metaapi" | "bridge") => {
    const form = provider === "bridge" ? bridgeForm : metaapiForm;
    const setForm = provider === "bridge" ? setBridgeForm : setMetaapiForm;

    if (!form.mt_login.trim() || !form.mt_password.trim()) {
      toast.error("Completa el número de cuenta MT5 y la master password");
      return;
    }

    setSavingProvider(provider);
    try {
      const { data, error } = await supabase.functions.invoke("trading-room-client", {
        body: {
          action: "save_account",
          portal_id: portalId,
          partner_user_id: userId,
          provider,
          mt_login: form.mt_login,
          mt_password: form.mt_password,
          broker_server: form.broker_server,
          selected_session_key: form.selected_session_key,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "No se pudo guardar la cuenta");
      toast.success(provider === "bridge" ? "Bridge MT5 conectado" : "MetaAPI conectado");
      setForm((prev) => ({ ...prev, mt_password: "" }));
      await loadState({ silent: true });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error guardando cuenta"));
    } finally {
      setSavingProvider(null);
    }
  };

  const handleSetActiveAccount = async (provider: "metaapi" | "bridge") => {
    setActivatingProvider(provider);
    try {
      const { data, error } = await supabase.functions.invoke("trading-room-client", {
        body: { action: "set_active_account", portal_id: portalId, partner_user_id: userId, provider },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "No se pudo activar la cuenta");
      toast.success(`${provider === "bridge" ? "Bridge MT5" : "MetaAPI"} ahora se usará en el Stream`);
      await loadState({ silent: true });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error activando cuenta"));
    } finally {
      setActivatingProvider(null);
    }
  };

  const handleTestConnection = async (provider: "metaapi" | "bridge") => {
    setTestingProvider(provider);
    try {
      await loadState({ silent: true });
      toast.success("Estado de conexión actualizado");
    } finally {
      setTestingProvider(null);
    }
  };

  const handlePlanCheckout = async (gateway: "stripe_gateway" | "crypto") => {
    if (!state.subscription?.plan_id) {
      toast.error("Primero selecciona un plan");
      return;
    }

    setCheckingOutPlan(gateway);
    try {
      const { data, error } = await supabase.functions.invoke("portal-commerce", {
        body: {
          action: "checkout_trading_plan",
          partner_user_id: userId,
          portal_id: portalId,
          payment_gateway: gateway,
          redirect_url: `${window.location.origin}${window.location.pathname}?payment=success`,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "No se pudo iniciar el pago");

      if (data.payment_url) {
        // Redirigir en la misma pestaña: window.open(_blank) tras el await lo bloquea el navegador.
        toast.success("Redirigiendo a la pasarela de pago...");
        window.location.href = data.payment_url;
        return;
      }
      toast.success("Pago procesado");
      await loadState({ silent: true });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error iniciando checkout"));
    } finally {
      setCheckingOutPlan(null);
    }
  };

  const handleSendOrder = async (side: "buy" | "sell") => {
    setSendingOrder(true);
    try {
      const { data, error } = await supabase.functions.invoke("trading-room-client", {
        body: {
          action: "create_intent",
          portal_id: portalId,
          partner_user_id: userId,
          side,
          source: "dashboard",
          symbol: orderForm.symbol,
          lot_size: Number(orderForm.lot_size),
          stop_loss: orderForm.stop_loss ? Number(orderForm.stop_loss) : null,
          take_profit: orderForm.take_profit ? Number(orderForm.take_profit) : null,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "No se pudo registrar la orden");
      toast.success(`Orden ${side === "buy" ? "BUY" : "SELL"} registrada`);
      await loadState({ silent: true });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error enviando orden"));
    } finally {
      setSendingOrder(false);
    }
  };

  const handleCloseAllPositions = async () => {
    if (openPositions.length === 0) {
      toast.error("No hay operaciones abiertas para cerrar");
      return;
    }

    const confirmed = window.confirm(`Se cerrarán ${openPositions.length} operaciones abiertas. ¿Deseas continuar?`);
    if (!confirmed) return;

    setClosingPositions(true);
    try {
      const { data, error } = await supabase.functions.invoke("trading-room-client", {
        body: {
          action: "close_all_positions",
          portal_id: portalId,
          partner_user_id: userId,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "No se pudieron cerrar las operaciones");

      const nextState = (data.state || emptyState) as TradingRoomState;
      setState(nextState);
      toast.success(
        data.closed_count > 0
          ? `${data.closed_count} operaciones cerradas correctamente`
          : "No había operaciones abiertas",
      );
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error cerrando operaciones"));
    } finally {
      setClosingPositions(false);
    }
  };

  const handleAnalysis = async () => {
    setRequestingAnalysis(true);
    try {
      const { data, error } = await supabase.functions.invoke("trading-room-client", {
        body: {
          action: "request_analysis",
          portal_id: portalId,
          partner_user_id: userId,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "No se pudo crear el análisis");
      toast.success(brandText(isWhiteLabel, "Análisis Bullfy Brain solicitado"));
      await loadState({ silent: true });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error solicitando análisis"));
    } finally {
      setRequestingAnalysis(false);
    }
  };

  const handleSearchSymbols = async (query: string) => {
    setSymbolSearch(query);

    if (!state.account?.metaapi_account_id) {
      setBrokerSymbolResults([]);
      return;
    }

    setSearchingSymbols(true);
    try {
      const { data, error } = await supabase.functions.invoke("trading-room-client", {
        body: {
          action: "search_symbols",
          portal_id: portalId,
          partner_user_id: userId,
          query,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "No se pudieron cargar los activos del broker");
      setBrokerSymbolResults((data.symbols || []) as BrokerSymbolOption[]);
    } catch (err: unknown) {
      setBrokerSymbolResults([]);
      toast.error(getErrorMessage(err, "Error buscando activos del broker"));
    } finally {
      setSearchingSymbols(false);
    }
  };

  const toggleFavoriteSymbol = async (symbol: string, displayName?: string | null, enabled = true) => {
    setUpdatingFavoriteSymbol(symbol);
    try {
      const { data, error } = await supabase.functions.invoke("trading-room-client", {
        body: {
          action: "toggle_favorite_symbol",
          portal_id: portalId,
          partner_user_id: userId,
          symbol,
          display_name: displayName || symbol,
          enabled,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "No se pudo actualizar favoritos");

      const nextState = (data.state || emptyState) as TradingRoomState;
      setState(nextState);

      if (enabled) {
        setOrderForm((prev) => ({ ...prev, symbol }));
        toast.success(`${symbol} agregado a favoritos`);
      } else {
        toast.success(`${symbol} eliminado de favoritos`);
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error actualizando favoritos"));
    } finally {
      setUpdatingFavoriteSymbol(null);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="h-40 animate-pulse" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">{brandText(isWhiteLabel, "Bullfy Trading Room")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Centro operativo para conectar tu cuenta MT5, ejecutar órdenes y revisar análisis.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={state.access.override_enabled ? "default" : "outline"}>
            {state.access.override_enabled ? "Pruebas habilitadas por IB" : "Acceso comercial"}
          </Badge>
          <Badge variant={state.access.can_trade ? "default" : "secondary"}>
            {state.access.can_trade ? "Trading disponible" : "Pendiente de activación"}
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 justify-start">
          <TabsTrigger value="operativa">Operativa</TabsTrigger>
          <TabsTrigger value="cuentas">Cuentas MT5</TabsTrigger>
          <TabsTrigger value="historial">Historial de órdenes</TabsTrigger>
          {/* Bullfy Brain: tab solo visible para el IB (host). Los usuarios
              clientes del portal no la ven. Decisión 2026-05-28. */}
          {isHost && <TabsTrigger value="brain">{brandText(isWhiteLabel, "Bullfy Brain")}</TabsTrigger>}
          {!isHost && <TabsTrigger value="suscripcion">Suscripción</TabsTrigger>}
          <TabsTrigger value="herramientas">Herramientas</TabsTrigger>
        </TabsList>

        {/* ============ TAB 1: OPERATIVA ============ */}
        <TabsContent value="operativa" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Star className="w-5 h-5 text-primary" /> Activos favoritos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Buscar activo del broker</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={symbolSearch}
                      onChange={(e) => void handleSearchSymbols(e.target.value)}
                      placeholder={state.account ? "Ej: XAUUSD, EURUSD, BTCUSD" : "Conecta primero tu cuenta MT5"}
                      disabled={!state.account}
                      className="pl-9"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  El buscador consulta los símbolos reales disponibles en tu cuenta conectada y los deja listos para operar en Stream.
                </p>
              </div>

              {favoriteSymbols.length > 0 && (
                <div className="space-y-2">
                  <Label>Favoritos guardados</Label>
                  <div className="flex flex-wrap gap-2">
                    {favoriteSymbols.map((item) => (
                      <div key={item.id} className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2.5 py-1.5 text-sm">
                        <button
                          type="button"
                          className="font-medium text-foreground"
                          onClick={() => setOrderForm((prev) => ({ ...prev, symbol: item.symbol }))}
                        >
                          {item.display_name || item.symbol}
                        </button>
                        <button
                          type="button"
                          className="text-muted-foreground transition-colors hover:text-foreground"
                          onClick={() => void toggleFavoriteSymbol(item.symbol, item.display_name, false)}
                          disabled={updatingFavoriteSymbol === item.symbol}
                          aria-label={`Quitar ${item.symbol} de favoritos`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-md border border-border">
                <div className="max-h-64 overflow-y-auto p-2">
                  {!state.account ? (
                    <p className="p-3 text-sm text-muted-foreground">Conecta tu cuenta MT5 para cargar activos del broker.</p>
                  ) : searchingSymbols ? (
                    <p className="p-3 text-sm text-muted-foreground">Buscando activos...</p>
                  ) : brokerSymbolResults.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No hay resultados todavía. Escribe para buscar símbolos disponibles.</p>
                  ) : (
                    <div className="space-y-1">
                      {brokerSymbolResults.map((item) => {
                        const isFavorite = favoriteSymbolMap.has(item.symbol.toUpperCase());
                        return (
                          <div key={item.symbol} className="flex items-center justify-between gap-3 rounded-md px-3 py-2 hover:bg-secondary/40">
                            <div>
                              <p className="text-sm font-medium text-foreground">{item.display_name}</p>
                              <p className="text-xs text-muted-foreground">{item.symbol}</p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant={isFavorite ? "secondary" : "outline"}
                              disabled={updatingFavoriteSymbol === item.symbol}
                              onClick={() => void toggleFavoriteSymbol(item.symbol, item.display_name, !isFavorite)}
                            >
                              {isFavorite ? "Guardado" : "Agregar"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <PlayCircle className="w-5 h-5 text-primary" /> Panel de ejecución manual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {favoriteSymbols.length > 0 && (
                <div className="space-y-2">
                  <Label>Seleccionar desde favoritos</Label>
                  <div className="flex flex-wrap gap-2">
                    {favoriteSymbols.map((item) => {
                      const isSelected = orderForm.symbol.toUpperCase() === item.symbol.toUpperCase();
                      return (
                        <Button
                          key={item.id}
                          type="button"
                          size="sm"
                          variant={isSelected ? "default" : "outline"}
                          onClick={() => setOrderForm((prev) => ({ ...prev, symbol: item.symbol }))}
                        >
                          {item.display_name || item.symbol}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2 md:col-span-1">
                  <Label>Símbolo</Label>
                  <Input value={orderForm.symbol} onChange={(e) => setOrderForm((prev) => ({ ...prev, symbol: e.target.value }))} />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label>Lotaje</Label>
                  <Input value={orderForm.lot_size} onChange={(e) => setOrderForm((prev) => ({ ...prev, lot_size: e.target.value }))} />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label>SL</Label>
                  <Input value={orderForm.stop_loss} onChange={(e) => setOrderForm((prev) => ({ ...prev, stop_loss: e.target.value }))} />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label>TP</Label>
                  <Input value={orderForm.take_profit} onChange={(e) => setOrderForm((prev) => ({ ...prev, take_profit: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Button type="button" className="w-full" disabled={!state.access.can_trade || sendingOrder || closingPositions} onClick={() => handleSendOrder("buy")}>
                  {sendingOrder ? "Procesando..." : "BUY"}
                </Button>
                <Button type="button" className="w-full" variant="destructive" disabled={!state.access.can_trade || sendingOrder || closingPositions} onClick={() => handleSendOrder("sell")}>
                  {sendingOrder ? "Procesando..." : "SELL"}
                </Button>
                <Button type="button" className="w-full" variant="outline" disabled={!state.access.can_trade || sendingOrder || closingPositions || openPositions.length === 0} onClick={handleCloseAllPositions}>
                  {closingPositions ? "Cerrando..." : "Cerrar operaciones"}
                </Button>
              </div>
              <div className="space-y-3 rounded-md border border-border p-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Operaciones abiertas</p>
                    <p className="text-xs text-muted-foreground">Actualización automática cada 8 segundos (se pausa mientras escribes).</p>
                  </div>
                  <Badge variant="outline">{openPositions.length} abiertas</Badge>
                </div>

                {openPositions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay operaciones abiertas en este momento.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[780px] text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase tracking-normal text-muted-foreground">
                          <th className="px-2 py-2 font-medium">Activo</th>
                          <th className="px-2 py-2 font-medium">Tipo</th>
                          <th className="px-2 py-2 font-medium">Lote</th>
                          <th className="px-2 py-2 font-medium">Entrada</th>
                          <th className="px-2 py-2 font-medium">Actual</th>
                          <th className="px-2 py-2 font-medium">P/L</th>
                          <th className="px-2 py-2 font-medium">Apertura</th>
                          <th className="px-2 py-2 font-medium">Actualizado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openPositions.map((position) => {
                          const isPositive = (position.profit ?? 0) >= 0;
                          return (
                            <tr key={position.id} className="border-b border-border/60 last:border-0">
                              <td className="px-2 py-2">
                                <div className="font-medium text-foreground">{position.symbol}</div>
                                {position.comment ? <div className="text-xs text-muted-foreground">{position.comment}</div> : null}
                              </td>
                              <td className="px-2 py-2 text-foreground">{position.type.replace("POSITION_TYPE_", "")}</td>
                              <td className="px-2 py-2 text-foreground">{formatDecimal(position.volume, 2)}</td>
                              <td className="px-2 py-2 text-foreground">{formatDecimal(position.open_price, 5)}</td>
                              <td className="px-2 py-2 text-foreground">{formatDecimal(position.current_price, 5)}</td>
                              <td className={`px-2 py-2 font-medium ${isPositive ? "text-success" : "text-destructive"}`}>
                                {formatMoney(position.profit, state.account?.currency || "USD")}
                              </td>
                              <td className="px-2 py-2 text-muted-foreground">{formatDateTime(position.opened_at)}</td>
                              <td className="px-2 py-2 text-muted-foreground">{formatDateTime(position.updated_at)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ TAB 2: CUENTAS MT5 ============ */}
        <TabsContent value="cuentas" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/*
              MetaAPI quedó deprecado el 2026-05-28: la única vía de conexión
              soportada para usuarios nuevos es Bridge MT5 Bullfy.
              La card de MetaAPI solo se renderiza si el usuario YA tenía una
              cuenta MetaAPI conectada antes del cambio — esto evita romper
              su flujo (reconectar, cambiar password, alternar provider activo)
              mientras planificamos su migración a Bridge.
              Hard cut definitivo (eliminar el branch metaapi del map y limpiar
              forms/handlers asociados) queda para cuando los últimos usuarios
              legacy hayan migrado.
            */}
            {(["metaapi", "bridge"] as const)
              .filter((p) => p === "bridge" || !!state.accounts?.metaapi)
              .map((provider) => {
              const isBridge = provider === "bridge";
              const form = isBridge ? bridgeForm : metaapiForm;
              const setForm = isBridge ? setBridgeForm : setMetaapiForm;
              const accountRow = isBridge ? state.accounts?.bridge : state.accounts?.metaapi;
              const isConnected = isBridge ? !!accountRow?.bridge_login : !!accountRow?.metaapi_account_id;
              const isActive = !!accountRow?.is_active_for_stream;
              const status = getConnectionStatusDisplay(accountRow?.connection_status);
              const title = isBridge ? brandText(isWhiteLabel, "Cuenta Bridge MT5 Bullfy") : "Cuenta MetaAPI";
              const description = isBridge
                // OJO: "Bullfy-Trade" es el nombre real del servidor MT5 y NO se
                // white-labela; solo se quita la marca de "Bridge MT5 de Bullfy".
                ? (isWhiteLabel
                    ? "Conecta directo al Bridge MT5. Solo cuentas Bullfy-Trade. Tu master password se valida y se descarta."
                    : "Conecta directo al Bridge MT5 de Bullfy. Solo cuentas Bullfy-Trade. Tu master password se valida y se descarta.")
                : "Conecta vía MetaAPI Cloud. Compatible con cualquier cuenta del servidor permitido.";
              const ctaLabel = isConnected
                ? (isBridge ? "Reconectar Bridge MT5" : "Reconectar MetaAPI")
                : (isBridge ? "Conectar vía Bridge MT5" : "Conectar vía MetaAPI");

              return (
                <Card key={provider} className={isActive ? "border-primary/60 ring-1 ring-primary/30" : ""}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2 text-lg">
                      <span className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-primary" /> {title}
                      </span>
                      <div className="flex items-center gap-2">
                        {isConnected ? (
                          <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
                            {status.label}
                            {status.icon ? <status.icon className="h-3 w-3" /> : null}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                            NO CONFIGURADA
                          </span>
                        )}
                        {isActive && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            <Check className="h-3 w-3" /> EN USO
                          </span>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-xs text-muted-foreground">{description}</p>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label># cuenta MT5</Label>
                        <Input
                          value={form.mt_login}
                          onChange={(e) => setForm((prev) => ({ ...prev, mt_login: e.target.value }))}
                          placeholder="10001234"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Master password MT5</Label>
                        <Input
                          type="password"
                          value={form.mt_password}
                          onChange={(e) => setForm((prev) => ({ ...prev, mt_password: e.target.value }))}
                          placeholder="Ingresa tu master password"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Servidor Broker</Label>
                      <Input value={form.broker_server} readOnly aria-readonly="true" />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => handleAccountSave(provider)}
                        disabled={savingProvider === provider}
                      >
                        {savingProvider === provider ? "Conectando..." : ctaLabel}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleTestConnection(provider)}
                        disabled={!isConnected || testingProvider === provider}
                      >
                        <RefreshCcw className={`w-3.5 h-3.5 mr-1.5 ${testingProvider === provider ? "animate-spin" : ""}`} />
                        Probar conexión
                      </Button>
                      <Button
                        variant={isActive ? "secondary" : "default"}
                        onClick={() => handleSetActiveAccount(provider)}
                        disabled={!isConnected || isActive || activatingProvider === provider}
                      >
                        {isActive ? "✓ En uso para Stream" : "Usar esta cuenta en Stream"}
                      </Button>
                    </div>

                    {isConnected && (
                      <div className="grid gap-2 sm:grid-cols-2 text-xs">
                        <div className="rounded-md border border-border p-2">
                          <p className="text-muted-foreground">Balance</p>
                          <p className="font-semibold text-foreground">
                            {formatMoney(accountRow?.balance ?? (isActive ? state.account?.balance : null), accountRow?.currency || "USD")}
                          </p>
                        </div>
                        <div className="rounded-md border border-border p-2">
                          <p className="text-muted-foreground">Equity</p>
                          <p className="font-semibold text-foreground">
                            {formatMoney(accountRow?.equity ?? (isActive ? state.account?.equity : null), accountRow?.currency || "USD")}
                          </p>
                        </div>
                        <div className="rounded-md border border-border p-2 sm:col-span-2">
                          <p className="text-muted-foreground">Último refresh</p>
                          <p className="font-semibold text-foreground">{formatDateTime(accountRow?.last_snapshot_at)}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ============ TAB 3: HISTORIAL DE ÓRDENES (horizontal) ============ */}
        <TabsContent value="historial" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-lg">
                <span className="flex items-center gap-2">
                  <RefreshCcw className="w-5 h-5 text-primary" /> Historial de órdenes
                </span>
                <Badge variant="outline">{state.recent_orders.length} órdenes</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {state.recent_orders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Aún no hay órdenes registradas.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full min-w-[1000px] text-sm">
                    <thead className="bg-secondary/40">
                      <tr className="border-b border-border text-left text-xs uppercase tracking-normal text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Solicitada</th>
                        <th className="px-3 py-2 font-medium">Ejecutada</th>
                        <th className="px-3 py-2 font-medium">Side</th>
                        <th className="px-3 py-2 font-medium">Símbolo</th>
                        <th className="px-3 py-2 font-medium text-right">Lote</th>
                        <th className="px-3 py-2 font-medium text-right">SL</th>
                        <th className="px-3 py-2 font-medium text-right">TP</th>
                        <th className="px-3 py-2 font-medium">Estado</th>
                        <th className="px-3 py-2 font-medium">Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.recent_orders.map((order) => (
                        <tr key={order.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/20">
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDateTime(order.requested_at)}</td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{order.executed_at ? formatDateTime(order.executed_at) : "—"}</td>
                          <td className="px-3 py-2">
                            <Badge variant={order.side === "buy" ? "default" : "destructive"} className="uppercase">{order.side}</Badge>
                          </td>
                          <td className="px-3 py-2 font-medium text-foreground">{order.symbol || "—"}</td>
                          <td className="px-3 py-2 text-right text-foreground">{formatDecimal(order.lot_size, 2)}</td>
                          <td className="px-3 py-2 text-right text-foreground">{order.stop_loss ?? "—"}</td>
                          <td className="px-3 py-2 text-right text-foreground">{order.take_profit ?? "—"}</td>
                          <td className="px-3 py-2"><Badge variant="outline">{order.execution_status}</Badge></td>
                          <td className={`px-3 py-2 text-xs ${order.failure_reason && order.execution_status !== "executed" ? "text-destructive" : "text-muted-foreground"}`}>
                            {order.failure_reason || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ TAB 4: BULLFY BRAIN (solo IB / host) ============ */}
        {isHost && (
          <TabsContent value="brain" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bot className="w-5 h-5 text-primary" /> {brandText(isWhiteLabel, "Bullfy Brain")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-border p-3 text-sm">
                    <p className="text-xs text-muted-foreground">Último snapshot</p>
                    <p className="font-semibold text-foreground mt-1">{formatDateTime(state.account?.last_snapshot_at)}</p>
                  </div>
                  <div className="rounded-md border border-border p-3 text-sm">
                    <p className="text-xs text-muted-foreground">Último análisis</p>
                    <p className="font-semibold text-foreground mt-1">{formatDateTime(state.account?.last_analysis_at)}</p>
                  </div>
                </div>
                <Button className="w-full" variant="outline" onClick={handleAnalysis} disabled={requestingAnalysis || !state.account}>
                  {requestingAnalysis ? "Solicitando..." : brandText(isWhiteLabel, "Analizar operativa con Bullfy Brain")}
                </Button>
                <div className="space-y-2">
                  {state.recent_analyses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aún no hay análisis generados.</p>
                  ) : (
                    state.recent_analyses.map((analysis) => (
                      <div key={analysis.id} className="rounded-md border border-border p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">Revisión estratégica</span>
                          <Badge variant="outline">{analysis.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{formatDateTime(analysis.created_at)}</p>
                        {analysis.summary && <p className="text-sm text-foreground mt-2">{analysis.summary}</p>}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ============ TAB 5: SUSCRIPCIÓN ============ */}
        {!isHost && <TabsContent value="suscripcion" className="space-y-4">
          <PlanSelectorMenu
            plans={state.plans}
            portalId={portalId}
            partnerUserId={userId}
            onActivated={() => loadState()}
            isTestUser={state.access.is_test_user}
            activeTestPlanIds={state.access.active_test_plan_ids}
          />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="w-5 h-5 text-primary" /> Estado comercial
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">Plan actual</p>
                  <p className="font-semibold text-foreground mt-1">
                    {state.access.is_test_user
                      ? activeTestPlans.length > 0
                        ? `${activeTestPlans.length} planes de prueba activos`
                        : "Sin planes de prueba activos"
                      : selectedPlan?.display_name || "Sin plan elegido"}
                  </p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">Acceso efectivo</p>
                  <p className="font-semibold text-foreground mt-1">{state.access.effective_access}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">Cobro mensual objetivo</p>
                  <p className="font-semibold text-foreground mt-1">${state.subscription?.price_monthly?.toFixed(2) || selectedPlan?.target_price_monthly?.toFixed(2) || activeTestPlans[0]?.target_price_monthly?.toFixed(2) || "0.00"}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">Estado de facturación</p>
                  <p className="font-semibold text-foreground mt-1">{state.access.is_test_user ? "qa_always_on" : state.subscription?.billing_status || "pending_setup"}</p>
                </div>
              </div>
              {state.access.is_test_user && activeTestPlans.length > 0 && (
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">Planes habilitados 24/7</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {activeTestPlans.map((plan) => (
                      <Badge key={plan.id} variant="outline">{plan.display_name}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {!state.access.override_enabled && state.subscription?.plan_id && !state.access.can_trade && (
                <div className={CARD_PAYMENT_ENABLED ? "grid gap-2 md:grid-cols-2" : "grid gap-2"}>
                  {CARD_PAYMENT_ENABLED && (
                    <Button className="w-full gap-2" onClick={() => handlePlanCheckout("stripe_gateway")} disabled={!!checkingOutPlan}>
                      {checkingOutPlan === "stripe_gateway" ? "Procesando..." : "Pagar plan con tarjeta"}
                    </Button>
                  )}
                  <Button className="w-full gap-2" onClick={() => handlePlanCheckout("crypto")} disabled={!!checkingOutPlan}>
                    {checkingOutPlan === "crypto" ? "Procesando..." : "Pagar plan con crypto"}
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Prioridad de acceso: override de pruebas del IB → suscripción pagada → acceso inactivo.
              </p>
            </CardContent>
          </Card>
        </TabsContent>}

        {/* ============ TAB 6: HERRAMIENTAS ============ */}
        <TabsContent value="herramientas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Herramientas integradas y backlog</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 md:grid-cols-2">
                {[
                  { label: "ForexFactory y noticias de carpeta roja", icon: Newspaper },
                  { label: "Noticias financieras relevantes", icon: TrendingUp },
                  { label: brandText(isWhiteLabel, "Recomendaciones Bullfy"), icon: BarChart3 },
                  { label: "Bitácora de trading", icon: Activity },
                  { label: "Calculadora de riesgo", icon: Calculator },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-md border border-border p-3">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <item.icon className="w-4 h-4 text-primary" />
                      <span>{item.label}</span>
                    </div>
                    <Badge variant="outline">Pendiente</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
};

export default BullfyTradingRoom;