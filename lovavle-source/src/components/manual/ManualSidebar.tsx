import { Input } from "@/components/ui/input";
import { Search, BookOpen, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ManualSection } from "@/pages/Manual";

interface Props {
  categories: Map<string, ManualSection[]>;
  activeSlug: string;
  onSelect: (slug: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  loading: boolean;
}

const ManualSidebar = ({ categories, activeSlug, onSelect, search, onSearchChange, loading }: Props) => {
  return (
    <div className="w-72 border-r border-border bg-card flex flex-col shrink-0">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-3">
          <BookOpen className="w-5 h-5 text-primary" />
          Manual de Usuario
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">Cargando...</div>
          ) : categories.size === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">No hay secciones</div>
          ) : (
            Array.from(categories.entries()).map(([cat, items]) => (
              <div key={cat}>
                <p className="px-3 py-1 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  {cat}
                </p>
                {items.map((s) => (
                  <button
                    key={s.slug}
                    onClick={() => onSelect(s.slug)}
                    className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                      activeSlug === s.slug
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    <ChevronRight className="w-3 h-3 shrink-0" />
                    <span className="truncate flex-1">{s.title}</span>
                    {s.is_new && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/20 text-primary">
                        Nuevo
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ManualSidebar;
