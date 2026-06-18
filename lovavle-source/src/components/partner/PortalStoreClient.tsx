import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toastUtils";
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, Loader2, Package } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CARD_PAYMENT_ENABLED } from "@/lib/paymentConfig";

interface PortalStoreClientProps {
  portalId: string;
  userId: string;
  userName: string;
}

interface Product {
  id: string;
  title: string;
  description: string | null;
  price_usd: number;
  product_type: string;
  image_url: string | null;
}

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  product?: Product;
}

interface Order {
  id: string;
  order_number: string;
  total_usd: number;
  payment_status: string;
  created_at: string;
}

const PortalStoreClient = ({ portalId, userId, userName }: PortalStoreClientProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCart, setShowCart] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [verifyingOrderId, setVerifyingOrderId] = useState<string | null>(null);
  const [verifyAttempts, setVerifyAttempts] = useState(0);
  // P7.5: saldo demo del usuario (si Bullfy le asignó fondos demo).
  const [demoBalance, setDemoBalance] = useState(0);

  const loadDemoBalance = async () => {
    const { data } = await supabase
      .from("portal_user_wallets")
      .select("available_balance")
      .eq("portal_id", portalId)
      .eq("user_id", userId)
      .eq("account_kind", "demo")
      .maybeSingle();
    setDemoBalance(Number((data as any)?.available_balance ?? 0));
  };

  const fetchData = async () => {
    setLoading(true);
    const [prodRes, cartRes, ordRes] = await Promise.all([
      supabase.from("portal_products").select("id, title, description, price_usd, product_type, image_url").eq("portal_id", portalId).eq("status", "active").order("display_order"),
      supabase.from("portal_cart_items").select("id, product_id, quantity").eq("partner_user_id", userId),
      supabase.from("portal_orders").select("id, order_number, total_usd, payment_status, created_at").eq("partner_user_id", userId).order("created_at", { ascending: false }).limit(20),
    ]);
    const prods = (prodRes.data as Product[]) ?? [];
    setProducts(prods);

    // Map cart items with product data
    const cartItems = (cartRes.data as CartItem[]) ?? [];
    const enriched = cartItems.map(ci => ({
      ...ci,
      product: prods.find(p => p.id === ci.product_id),
    }));
    setCart(enriched);
    setOrders((ordRes.data as Order[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); loadDemoBalance(); }, [portalId, userId]);

  const addToCart = async (productId: string) => {
    // Use edge function or service role via supabase for cart management
    const existing = cart.find(c => c.product_id === productId);
    if (existing) {
      toast.info("Este producto ya está en tu carrito");
      return;
    }

    const { error } = await supabase.functions.invoke("portal-commerce", {
      body: { action: "add_to_cart", partner_user_id: userId, product_id: productId },
    });
    if (error) { toast.error("Error al agregar al carrito"); return; }
    toast.success("Producto agregado al carrito");
    fetchData();
  };

  const removeFromCart = async (cartItemId: string) => {
    const { error } = await supabase.functions.invoke("portal-commerce", {
      body: { action: "remove_from_cart", cart_item_id: cartItemId },
    });
    if (error) { toast.error("Error al eliminar del carrito"); return; }
    fetchData();
  };

  const pollPaymentStatus = async (orderId: string) => {
    const MAX_ATTEMPTS = 50; // ~150s (las confirmaciones cripto pueden tardar)
    const INTERVAL_MS = 3000;
    setVerifyingOrderId(orderId);
    setVerifyAttempts(0);

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      setVerifyAttempts(i + 1);
      try {
        const { data } = await supabase.functions.invoke("portal-commerce", {
          body: { action: "verify_payment", order_id: orderId },
        });
        if (data?.ok && data.status === "paid") {
          setVerifyingOrderId(null);
          toast.success("¡Pago confirmado! Tu orden ha sido completada.");
          fetchData();
          return;
        }
      } catch (e) {
        console.error("verify_payment poll error", e);
      }
      await new Promise(r => setTimeout(r, INTERVAL_MS));
    }
    setVerifyingOrderId(null);
    toast.info("Tu pago puede tardar unos minutos en confirmarse. Revisa tu historial de órdenes.");
    fetchData();
  };

  const handleCheckout = async (gateway: string, demo = false) => {
    if (cart.length === 0) { toast.error("El carrito está vacío"); return; }
    setCheckingOut(true);
    try {
      const redirectUrl = `${window.location.origin}${window.location.pathname}?payment=success`;
      const { data, error } = await supabase.functions.invoke("portal-commerce", {
        body: {
          action: "checkout",
          partner_user_id: userId,
          portal_id: portalId,
          payment_gateway: demo ? "demo" : gateway,
          account_kind: demo ? "demo" : "real",
          redirect_url: redirectUrl,
        },
      });
      if (error) throw error;
      if (data?.ok) {
        if (demo) {
          // Compra demo: la orden ya quedó pagada con saldo demo (sin pasarela).
          toast.success("Compra demo realizada con tu saldo demo.");
          setShowCart(false);
          fetchData();
          loadDemoBalance();
          return;
        }
        // Redirigir en la MISMA pestaña: tras el `await`, window.open(_blank) pierde el
        // gesto de usuario y el navegador bloquea la pestaña nueva, dejando al cliente
        // atascado sin llegar a pagar. Al volver, ?payment=success confirma la orden.
        if (data.payment_url) {
          toast.success("Redirigiendo a la pasarela de pago...");
          window.location.href = data.payment_url;
          return;
        }
        // Cripto sin payment_url = el depósito falló: avisar y NO dejar al usuario en polling.
        if (gateway === "crypto") {
          toast.error(data?.gateway_result?.error || "No se pudo iniciar el pago con cripto. Inténtalo de nuevo.");
          setShowCart(false);
          return;
        }
        setShowCart(false);
        fetchData();
      } else {
        toast.error(data?.error || "Error en el checkout");
      }
    } catch (err: any) {
      toast.error("Error en el checkout: " + (err.message || err));
    }
    setCheckingOut(false);
  };

  // Handle ?payment=success when user returns from Coinsbuy via the "Return to merchant" button
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      toast.success("¡Gracias por tu compra! Estamos confirmando tu pago...");
      // Find latest pending crypto order (coinsbuy o nowpayments) and poll it
      (async () => {
        const { data } = await supabase
          .from("portal_orders")
          .select("id, payment_status, payment_gateway")
          .eq("partner_user_id", userId)
          .in("payment_gateway", ["coinsbuy", "nowpayments", "stripe_gateway"])
          .eq("payment_status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data?.id) pollPaymentStatus(data.id);
      })();
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const cartTotal = cart.reduce((sum, ci) => sum + (ci.product?.price_usd ?? 0) * ci.quantity, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with cart */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Tienda</h2>
          <p className="text-sm text-muted-foreground mt-1">Productos digitales disponibles</p>
        </div>
        <Button variant="outline" className="gap-2 relative" onClick={() => setShowCart(true)}>
          <ShoppingCart className="w-4 h-4" />
          Carrito
          {cart.length > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
              {cart.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Products Grid */}
      {products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No hay productos disponibles en este momento</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => {
            const inCart = cart.some(c => c.product_id === p.id);
            return (
              <Card key={p.id} className="overflow-hidden">
                {p.image_url && (
                  <div className="h-40 bg-muted">
                    <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <CardContent className={`${p.image_url ? "pt-4" : "pt-6"} space-y-3`}>
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-foreground">{p.title}</h3>
                      <Badge variant="outline" className="text-xs shrink-0">{({ course: "Curso", membership: "Membresía", bundle: "Paquete" } as Record<string, string>)[p.product_type] || "Digital"}</Badge>
                    </div>
                    {p.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-primary">${p.price_usd}</span>
                    <Button
                      size="sm"
                      variant={inCart ? "secondary" : "default"}
                      className="gap-1.5"
                      onClick={() => addToCart(p.id)}
                      disabled={inCart}
                    >
                      {inCart ? "En carrito" : <><Plus className="w-3 h-3" /> Agregar</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Orders History */}
      {orders.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Mis Compras</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {orders.map(o => (
                <div key={o.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="font-mono text-sm font-medium">{o.order_number}</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("es-ES")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold">${o.total_usd}</span>
                    <Badge variant={o.payment_status === "paid" ? "default" : "outline"}>
                      {o.payment_status === "paid" ? "Pagado" : o.payment_status === "pending" ? "Pendiente" : o.payment_status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cart Dialog */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> Carrito de Compras</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {cart.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">Tu carrito está vacío</p>
            ) : (
              <>
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {cart.map(ci => (
                    <div key={ci.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{ci.product?.title || "Producto"}</p>
                        <p className="text-sm font-mono text-primary">${ci.product?.price_usd ?? 0}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="text-destructive shrink-0" onClick={() => removeFromCart(ci.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border pt-3">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-semibold">Total:</span>
                    <span className="text-xl font-bold text-primary">${cartTotal.toFixed(2)}</span>
                  </div>

                  <div className="space-y-2">
                    {CARD_PAYMENT_ENABLED && (
                      <Button className="w-full gap-2" onClick={() => handleCheckout("stripe_gateway")} disabled={checkingOut}>
                        {checkingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                        Pagar con Tarjeta
                      </Button>
                    )}
                    <Button className="w-full gap-2" onClick={() => handleCheckout("crypto")} disabled={checkingOut}>
                      {checkingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-sm">₿</span>}
                      Pagar con Crypto
                    </Button>
                    {demoBalance > 0 && (
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => handleCheckout("demo", true)}
                        disabled={checkingOut || cartTotal > demoBalance}
                        title={cartTotal > demoBalance ? "Saldo demo insuficiente" : undefined}
                      >
                        {checkingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-sm">🧪</span>}
                        Pagar con saldo demo (${demoBalance.toFixed(2)})
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment verification modal (Coinsbuy polling) */}
      <Dialog open={!!verifyingOrderId} onOpenChange={() => { /* prevent manual close while polling */ }}>
        <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Confirmando tu pago</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Estamos esperando la confirmación de la red blockchain. Esto puede tardar entre 30 segundos y 2 minutos.
            </p>
            <p className="text-xs text-muted-foreground">
              Intento {verifyAttempts} de 50. No cierres esta ventana.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setVerifyingOrderId(null); fetchData(); }}
            >
              Verificar más tarde
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortalStoreClient;
