import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Pencil, Clock, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ManualSection } from "@/pages/Manual";

interface Props {
  section: ManualSection | null;
  loading: boolean;
  onEdit?: (s: ManualSection) => void;
}

const ManualViewer = ({ section, loading, onEdit }: Props) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Cargando contenido...
      </div>
    );
  }

  if (!section) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
        <p className="text-lg">No hay secciones en el manual aún</p>
        <p className="text-sm">Los administradores pueden crear nuevas secciones.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{section.title}</h1>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Actualizado {format(new Date(section.updated_at), "d MMM yyyy", { locale: es })}
            </span>
            <span className="text-muted-foreground/40">•</span>
            <span>{section.category}</span>
          </div>
        </div>
        {onEdit && (
          <Button size="sm" variant="outline" onClick={() => onEdit(section)} className="gap-2 shrink-0">
            <Pencil className="w-3 h-3" /> Editar
          </Button>
        )}
      </div>

      {section.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {section.tags.map((t) => (
            <Badge key={t} variant="secondary" className="text-xs gap-1">
              <Tag className="w-3 h-3" /> {t}
            </Badge>
          ))}
        </div>
      )}

      <article className="prose prose-invert prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground/80 prose-strong:text-foreground prose-a:text-primary prose-code:text-accent prose-li:text-foreground/80 prose-ul:text-foreground/80">
        <ReactMarkdown>{section.content}</ReactMarkdown>
      </article>
    </div>
  );
};

export default ManualViewer;
