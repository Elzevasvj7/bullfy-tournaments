import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Symbol {
  symbol: string;
  description: string | null;
  category: string | null;
}

interface MarketWatchProps {
  activeSymbol: string;
  onSelect: (symbol: string) => void;
}

export default function MarketWatch({ activeSymbol, onSelect }: MarketWatchProps) {
  const [symbols, setSymbols] = useState<Symbol[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("broker_symbols")
        .select("symbol, description, category")
        .eq("enabled", true)
        .order("symbol")
        .limit(500);
      setSymbols(data ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = symbols.filter(
    (s) =>
      s.symbol.toLowerCase().includes(q.toLowerCase()) ||
      (s.description ?? "").toLowerCase().includes(q.toLowerCase())
  );

  // Bid/Ask simulado mientras conectamos al feed
  const fakePrice = (sym: string) => {
    const base = sym.includes("BTC") ? 65000 : sym.includes("JPY") ? 150 : 1.08;
    const noise = (Math.sin(Date.now() / 5000 + sym.length) * 0.5 + 0.5) * (base * 0.001);
    return { bid: base + noise, ask: base + noise + base * 0.00005 };
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar símbolo..."
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-xs text-muted-foreground">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">Sin símbolos</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/50 text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Símbolo</th>
                <th className="px-2 py-1.5 text-right font-medium">Bid</th>
                <th className="px-2 py-1.5 text-right font-medium">Ask</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const { bid, ask } = fakePrice(s.symbol);
                const isActive = s.symbol === activeSymbol;
                const digits = s.symbol.includes("JPY") ? 3 : s.symbol.includes("BTC") ? 1 : 5;
                return (
                  <tr
                    key={s.symbol}
                    onClick={() => onSelect(s.symbol)}
                    className={cn(
                      "cursor-pointer border-b border-border/40 hover:bg-muted/40",
                      isActive && "bg-primary/10"
                    )}
                  >
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-muted-foreground/40" />
                        <span className="font-mono">{s.symbol}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-rose-500">{bid.toFixed(digits)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-emerald-500">{ask.toFixed(digits)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
