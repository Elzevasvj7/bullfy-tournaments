import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/toastUtils";
import ReactMarkdown from "react-markdown";
import { Save, X, Eye, FileEdit, Trash2 } from "lucide-react";
import type { ManualSection } from "@/pages/Manual";

interface Props {
  section: ManualSection | null;
  onCancel: () => void;
  onSaved: () => void;
}

const ManualEditor = ({ section, onCancel, onSaved }: Props) => {
  const { user } = useAuth();
  const isNew = !section;

  const [form, setForm] = useState<{
    category: string; title: string; slug: string; content: string;
    icon: string; display_order: number; tags: string; is_new: boolean;
  }>({
    category: section?.category || "",
    title: section?.title || "",
    slug: section?.slug || "",
    content: section?.content || "",
    icon: section?.icon || "BookOpen",
    display_order: section?.display_order || 0,
    tags: section?.tags.join(", ") || "",
    is_new: section?.is_new ?? true,
  });
  const [saving, setSaving] = useState(false);

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleTitleChange = (title: string) => {
    setForm((f) => ({
      ...f,
      title,
      ...(isNew ? { slug: generateSlug(title) } : {}),
    }));
  };

  const handleSave = async () => {
    if (!form.title || !form.category || !form.slug) {
      toast.error("Título, categoría y slug son requeridos");
      return;
    }
    setSaving(true);
    const payload = {
      category: form.category,
      title: form.title,
      slug: form.slug,
      content: form.content,
      icon: form.icon,
      display_order: form.display_order,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      is_new: form.is_new,
      updated_at: new Date().toISOString(),
      updated_by: user?.id,
    };

    let error;
    if (isNew) {
      ({ error } = await supabase.from("manual_sections").insert(payload));
    } else {
      ({ error } = await supabase.from("manual_sections").update(payload).eq("id", section!.id));
    }

    if (error) {
      toast.error("Error: " + error.message);
    } else {
      toast.success(isNew ? "Sección creada" : "Sección actualizada");
      onSaved();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!section) return;
    if (!confirm("¿Eliminar esta sección permanentemente?")) return;
    const { error } = await supabase.from("manual_sections").delete().eq("id", section.id);
    if (error) toast.error("Error: " + error.message);
    else { toast.success("Sección eliminada"); onSaved(); }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground">
          {isNew ? "Nueva sección" : "Editar sección"}
        </h2>
        <div className="flex gap-2">
          {!isNew && (
            <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-2">
              <Trash2 className="w-4 h-4" /> Eliminar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onCancel} className="gap-2">
            <X className="w-4 h-4" /> Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" /> {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <Label>Título</Label>
          <Input value={form.title} onChange={(e) => handleTitleChange(e.target.value)} />
        </div>
        <div>
          <Label>Categoría</Label>
          <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Ej: Módulos principales" />
        </div>
        <div>
          <Label>Slug (URL)</Label>
          <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
        </div>
        <div>
          <Label>Orden</Label>
          <Input type="number" value={form.display_order} onChange={(e) => setForm((f) => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} />
        </div>
        <div>
          <Label>Tags (separados por coma)</Label>
          <Input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="onboarding, ibs, deals" />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch checked={form.is_new} onCheckedChange={(v) => setForm((f) => ({ ...f, is_new: v }))} />
          <Label>Marcar como "Nuevo"</Label>
        </div>
      </div>

      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit" className="gap-2"><FileEdit className="w-4 h-4" /> Editar</TabsTrigger>
          <TabsTrigger value="preview" className="gap-2"><Eye className="w-4 h-4" /> Vista previa</TabsTrigger>
        </TabsList>
        <TabsContent value="edit">
          <Textarea
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            className="min-h-[500px] font-mono text-sm"
            placeholder="Escribe el contenido en Markdown..."
          />
        </TabsContent>
        <TabsContent value="preview">
          <div className="border border-border rounded-lg p-6 min-h-[500px]">
            <article className="prose prose-invert prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground/80 prose-strong:text-foreground prose-a:text-primary prose-code:text-accent">
              <ReactMarkdown>{form.content || "*Sin contenido*"}</ReactMarkdown>
            </article>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ManualEditor;
