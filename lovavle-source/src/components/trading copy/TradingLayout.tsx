import { useState } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import MarketWatch from "./MarketWatch";
import ChartPanel from "./ChartPanel";
import OrderTicket from "./OrderTicket";
import BottomTabs from "./BottomTabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"];

export default function TradingLayout() {
  const [symbol, setSymbol] = useState("EURUSD");
  const [timeframe, setTimeframe] = useState("M15");

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-lg border border-border bg-card">
      {/* Topbar */}
      <div className="flex h-12 items-center justify-between border-b border-border bg-background/50 px-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Cuenta MT5</div>
            <div className="font-mono text-xs">— sin conectar —</div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Balance</div>
            <div className="font-mono text-xs">—</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Equity</div>
            <div className="font-mono text-xs">—</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">P&L</div>
            <div className="font-mono text-xs">—</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="h-8 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEFRAMES.map((tf) => (
                <SelectItem key={tf} value={tf} className="text-xs">{tf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main 3-panel + bottom */}
      <ResizablePanelGroup direction="vertical" className="flex-1">
        <ResizablePanel defaultSize={70} minSize={40}>
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={18} minSize={12} maxSize={30}>
              <MarketWatch activeSymbol={symbol} onSelect={setSymbol} />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={60} minSize={40}>
              <ChartPanel symbol={symbol} timeframe={timeframe} />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={22} minSize={16} maxSize={32}>
              <OrderTicket symbol={symbol} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={30} minSize={15}>
          <BottomTabs />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
