import { useState } from "react";
import { ATFX_SECTIONS } from "./reportRegistry";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  section: string;
  category: string;
  report: string;
  onSelect: (section: string, category: string, report: string) => void;
}

export default function ATFXReportSidebar({ section, category, report, onSelect }: Props) {
  // open state per "section.category"
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    ATFX_SECTIONS.forEach(s => s.categories.forEach(c => {
      init[`${s.id}.${c.id}`] = s.id === section && c.id === category;
    }));
    return init;
  });

  const toggle = (key: string) => setOpenMap(m => ({ ...m, [key]: !m[key] }));

  return (
    <aside className="w-64 border-r border-border bg-muted/20 shrink-0">
      <ScrollArea className="h-[calc(100vh-180px)]">
        <div className="p-2 space-y-4">
          {ATFX_SECTIONS.map(sec => (
            <div key={sec.id}>
              <div className="px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {sec.icon} {sec.label}
              </div>
              <div className="space-y-0.5">
                {sec.categories.map(cat => {
                  const key = `${sec.id}.${cat.id}`;
                  const isOpen = openMap[key];
                  const hasActive = sec.id === section && cat.id === category;
                  return (
                    <div key={cat.id}>
                      <button
                        onClick={() => toggle(key)}
                        className={cn(
                          "w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded hover:bg-muted/60 transition",
                          hasActive && "text-primary font-medium"
                        )}
                      >
                        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        <span className="flex-1 text-left">{cat.icon} {cat.label}</span>
                      </button>
                      {isOpen && (
                        <div className="ml-5 border-l border-border pl-2 mt-0.5 space-y-0.5">
                          {cat.reports.map(r => {
                            const isActive = sec.id === section && cat.id === category && r.id === report;
                            return (
                              <button
                                key={r.id}
                                onClick={() => onSelect(sec.id, cat.id, r.id)}
                                className={cn(
                                  "w-full text-left px-2 py-1 text-xs rounded hover:bg-muted/60 transition",
                                  isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
                                )}
                              >
                                {r.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
