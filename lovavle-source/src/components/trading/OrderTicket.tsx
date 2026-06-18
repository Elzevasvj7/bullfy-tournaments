import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface OrderTicketProps {
  symbol: string;
}

export default function OrderTicket({ symbol }: OrderTicketProps) {
  const [type, setType] = useState<"market" | "limit" | "stop">("market");
  const [volume, setVolume] = useState("0.01");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [price, setPrice] = useState("");

  const submit = (side: "buy" | "sell") => {
    toast({
      title: "Order ticket (preview)",
      description: `${side.toUpperCase()} ${volume} ${symbol} @ ${type}${
        price ? ` ${price}` : ""
      }${sl ? ` SL:${sl}` : ""}${tp ? ` TP:${tp}` : ""}`,
    });
    // TODO Fase 3: invocar mt5-bridge-proxy create_order
  };

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Símbolo</div>
        <div className="font-mono text-sm font-semibold">{symbol}</div>
      </div>

      <Tabs value={type} onValueChange={(v) => setType(v as typeof type)}>
        <TabsList className="grid h-8 w-full grid-cols-3">
          <TabsTrigger value="market" className="text-xs">Market</TabsTrigger>
          <TabsTrigger value="limit" className="text-xs">Limit</TabsTrigger>
          <TabsTrigger value="stop" className="text-xs">Stop</TabsTrigger>
        </TabsList>
        <TabsContent value="limit" className="mt-2">
          <Label className="text-[10px]">Precio</Label>
          <Input value={price} onChange={(e) => setPrice(e.target.value)} className="h-7 text-xs" />
        </TabsContent>
        <TabsContent value="stop" className="mt-2">
          <Label className="text-[10px]">Precio activación</Label>
          <Input value={price} onChange={(e) => setPrice(e.target.value)} className="h-7 text-xs" />
        </TabsContent>
      </Tabs>

      <div>
        <Label className="text-[10px]">Volumen (lotes)</Label>
        <Input value={volume} onChange={(e) => setVolume(e.target.value)} className="h-7 text-xs" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px]">Stop Loss</Label>
          <Input value={sl} onChange={(e) => setSl(e.target.value)} className="h-7 text-xs" placeholder="—" />
        </div>
        <div>
          <Label className="text-[10px]">Take Profit</Label>
          <Input value={tp} onChange={(e) => setTp(e.target.value)} className="h-7 text-xs" placeholder="—" />
        </div>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2">
        <Button
          onClick={() => submit("sell")}
          className="h-10 bg-rose-600 hover:bg-rose-700 text-white"
        >
          <TrendingDown className="mr-1 h-4 w-4" />
          SELL
        </Button>
        <Button
          onClick={() => submit("buy")}
          className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <TrendingUp className="mr-1 h-4 w-4" />
          BUY
        </Button>
      </div>

      <div className="rounded border border-dashed border-border p-2 text-[10px] text-muted-foreground">
        Modo preview · sin envío real al bridge MT5 (se activa en Fase 3)
      </div>
    </div>
  );
}
