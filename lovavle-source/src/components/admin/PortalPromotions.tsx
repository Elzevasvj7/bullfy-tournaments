import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toastUtils";
import { Plus, Pencil, Trash2, Megaphone, GripVertical, Upload, Loader2, FileDown, Image } from "lucide-react";

interface Promotion {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  file_url: string | null;
  cta_text: string | null;
  cta_url: string | null;
  active: boolean;
  display_order: number;
  created_at: string;
}

const PortalPromotions = () => {
  const { user } = useAuth();
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState<Promotion | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);

  const fetchPromos = async () => {
    const { data, error } = await supabase
      .from("ib_portal_promotions")
      .select("*")
      .order("display_order");
    if (!error) setPromos((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchPromos(); }, []);

  const openCreate = () => {
    setTitle("");
    setDescription("");
    setDisplayOrder(promos.length);
    setImageFile(null);
    setImagePreview(null);
    setPdfFile(null);
    setExistingFileUrl(null);
    setCreating(true);
    setEditDialog({} as any);
  };

  const openEdit = (p: Promotion) => {
    setTitle(p.title);
    setDescription(p.description);
    setDisplayOrder(p.display_order);
    setImageFile(null);
    setImagePreview(p.image_url);
    setPdfFile(null);
    setExistingFileUrl(p.file_url);
    setCreating(false);
    setEditDialog(p);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFile(file);
    }
  };

  const uploadToStorage = async (file: File, prefix: string): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${prefix}-${Date.now()}.${ext}`;
    setUploading(true);
    const { error } = await supabase.storage.from("promotions").upload(path, file);
    setUploading(false);
    if (error) {
      toast.error("Error subiendo archivo: " + error.message);
      return null;
    }
    const { data: urlData } = supabase.storage.from("promotions").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleSave = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Título y descripción son obligatorios");
      return;
    }
    setSaving(true);

    let imageUrl: string | null = creating ? null : (editDialog?.image_url ?? null);
    let fileUrl: string | null = creating ? null : (existingFileUrl ?? null);

    if (imageFile) {
      const url = await uploadToStorage(imageFile, "promo-img");
      if (url) imageUrl = url;
    }

    if (pdfFile) {
      const url = await uploadToStorage(pdfFile, "promo-pdf");
      if (url) fileUrl = url;
    }

    const payload = {
      title,
      description,
      image_url: imageUrl,
      file_url: fileUrl,
      cta_text: null,
      cta_url: null,
      active: true,
      display_order: displayOrder,
      ...(creating ? { created_by: user?.id } : {}),
    };

    let error;
    if (creating) {
      ({ error } = await supabase.from("ib_portal_promotions").insert(payload as any));
    } else {
      ({ error } = await supabase.from("ib_portal_promotions").update(payload as any).eq("id", editDialog!.id));
    }

    if (error) {
      toast.error("Error: " + error.message);
    } else {
      toast.success(creating ? "Promoción creada" : "Promoción actualizada");
      setEditDialog(null);
      fetchPromos();
    }
    setSaving(false);
  };

  const handleToggleActive = async (p: Promotion) => {
    const { error } = await supabase.from("ib_portal_promotions").update({ active: !p.active } as any).eq("id", p.id);
    if (!error) fetchPromos();
    else toast.error("Error: " + error.message);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("ib_portal_promotions").delete().eq("id", id);
    if (!error) { toast.success("Promoción eliminada"); fetchPromos(); }
    else toast.error("Error: " + error.message);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Promociones del Portal IB</h3>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Nueva Promoción
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Orden</TableHead>
              <TableHead>Imagen</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Archivos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
            ) : promos.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No hay promociones</TableCell></TableRow>
            ) : promos.map((p) => (
              <TableRow key={p.id}>
                <TableCell><GripVertical className="w-4 h-4 text-muted-foreground inline" /> {p.display_order}</TableCell>
                <TableCell>
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.title} className="w-12 h-8 rounded object-cover" />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="font-medium">{p.title}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {p.image_url && <Badge variant="outline" className="text-[10px] gap-1"><Image className="w-3 h-3" />Img</Badge>}
                    {p.file_url && (
                      <a href={p.file_url} target="_blank" rel="noopener noreferrer">
                        <Badge variant="outline" className="text-[10px] gap-1 cursor-pointer hover:bg-primary/10"><FileDown className="w-3 h-3" />PDF</Badge>
                      </a>
                    )}
                    {!p.image_url && !p.file_url && <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={p.active ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => handleToggleActive(p)}
                  >
                    {p.active ? "Activa" : "Inactiva"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editDialog} onOpenChange={(o) => { if (!o) setEditDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{creating ? "Nueva Promoción" : "Editar Promoción"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la promoción" />
            </div>
            <div className="space-y-2">
              <Label>Descripción *</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción..." rows={3} />
            </div>

            {/* Image upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Image className="w-4 h-4" /> Imagen (se muestra al usuario)</Label>
              <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-border cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{imageFile ? imageFile.name : "Subir imagen"}</span>
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
              {imagePreview && (
                <img src={imagePreview} alt="Preview" className="mt-2 w-full max-h-40 object-cover rounded-lg border border-border" />
              )}
            </div>

            {/* PDF upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><FileDown className="w-4 h-4" /> Archivo PDF (link de descarga)</Label>
              <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-border cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{pdfFile ? pdfFile.name : existingFileUrl ? "PDF actual cargado ✓" : "Subir PDF"}</span>
                <input type="file" accept=".pdf,application/pdf" onChange={handlePdfChange} className="hidden" />
              </label>
              {existingFileUrl && !pdfFile && (
                <div className="flex items-center gap-2">
                  <a href={existingFileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Ver PDF actual</a>
                  <Button variant="ghost" size="sm" className="text-destructive text-xs h-6" onClick={() => setExistingFileUrl(null)}>Quitar</Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Orden de aparición</Label>
              <Input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditDialog(null)} className="flex-1">Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || uploading} className="flex-1 gap-2">
                {(saving || uploading) && <Loader2 className="w-4 h-4 animate-spin" />}
                {uploading ? "Subiendo..." : saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortalPromotions;
