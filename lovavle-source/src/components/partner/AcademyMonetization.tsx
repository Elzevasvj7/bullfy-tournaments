import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toastUtils";
import { Plus, Trash2, Edit, Loader2, Crown, Package, Eye, EyeOff, Network, ImagePlus, X } from "lucide-react";
import ProductCommissionLevelsDialog from "./ProductCommissionLevelsDialog";
import { usePortalTiers } from "@/hooks/usePortalTiers";

interface Props {
  portalId: string;
}

interface Membership {
  id: string;
  title: string;
  description: string | null;
  price_usd: number;
  membership_tier: string | null;
  image_url: string | null;
  validity_months: number | null;
  status: string;
}

interface Bundle {
  id: string;
  title: string;
  description: string | null;
  price_usd: number;
  status: string;
  product_id: string | null;
  course_ids: string[];
}

interface CourseLite {
  id: string;
  title: string;
}

const emptyMembership = { title: "", description: "", price_usd: 0, membership_tier: "", image_url: null as string | null, validity_months: null as number | null, status: "active" };
const emptyBundle = { title: "", description: "", price_usd: 0, status: "draft", course_ids: [] as string[] };

const AcademyMonetization = ({ portalId }: Props) => {
  const { tiers, labelFor } = usePortalTiers(portalId);
  // Niveles vendibles = activos y NO el base gratuito (no tiene sentido vender el nivel de entrada).
  const sellableTiers = tiers.filter(t => t.active && !t.is_default);
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [overrideTarget, setOverrideTarget] = useState<{ productId: string; title: string; price: number } | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [courses, setCourses] = useState<CourseLite[]>([]);
  const [loading, setLoading] = useState(true);

  const [memDialog, setMemDialog] = useState(false);
  const [memForm, setMemForm] = useState<any>(emptyMembership);
  const [memId, setMemId] = useState<string | null>(null);

  const [bundleDialog, setBundleDialog] = useState(false);
  const [bundleForm, setBundleForm] = useState<any>(emptyBundle);
  const [bundleId, setBundleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, [portalId]);

  const fetchAll = async () => {
    setLoading(true);
    const [memRes, bundleRes, bcRes, courseRes] = await Promise.all([
      supabase.from("portal_products").select("id, title, description, price_usd, membership_tier, image_url, validity_months, status")
        .eq("portal_id", portalId).eq("product_type", "membership").order("created_at", { ascending: false }),
      supabase.from("academy_bundles").select("id, title, description, price_usd, status, product_id")
        .eq("portal_id", portalId).order("created_at", { ascending: false }),
      supabase.from("academy_bundle_courses").select("bundle_id, course_id"),
      supabase.from("academy_courses").select("id, title").eq("portal_id", portalId).order("display_order"),
    ]);
    setMemberships((memRes.data as Membership[]) || []);
    const bcMap = new Map<string, string[]>();
    ((bcRes.data as any[]) || []).forEach(r => {
      const arr = bcMap.get(r.bundle_id) || [];
      arr.push(r.course_id);
      bcMap.set(r.bundle_id, arr);
    });
    setBundles(((bundleRes.data as any[]) || []).map(b => ({ ...b, course_ids: bcMap.get(b.id) || [] })));
    setCourses((courseRes.data as CourseLite[]) || []);
    setLoading(false);
  };

  // ---- Membership CRUD ----
  const openMembership = (m?: Membership) => {
    if (m) {
      setMemId(m.id);
      setMemForm({ title: m.title, description: m.description || "", price_usd: m.price_usd, membership_tier: m.membership_tier || sellableTiers[0]?.slug || "", image_url: m.image_url || null, validity_months: m.validity_months ?? null, status: m.status });
    } else {
      setMemId(null);
      setMemForm({ ...emptyMembership, membership_tier: sellableTiers[0]?.slug || "" });
    }
    setMemDialog(true);
  };

  const handleMembershipImage = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Solo se permiten imágenes"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("La imagen no puede superar 2MB"); return; }
    setUploadingImg(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      // Reutilizamos el bucket existente `academy-thumbnails` (ya es público y
      // tiene las políticas de subida/lectura correctas). El bucket nuevo
      // `portal-product-images` quedó privado y sin policies de INSERT, lo que
      // causaba "row-level security policy" al subir.
      const path = `memberships/${portalId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("academy-thumbnails").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("academy-thumbnails").getPublicUrl(path);
      setMemForm((f: any) => ({ ...f, image_url: pub.publicUrl }));
      toast.success("Imagen cargada");
    } catch (e: any) {
      toast.error("Error al subir la imagen: " + (e.message || e));
    } finally {
      setUploadingImg(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveMembership = async () => {
    if (!memForm.title.trim()) { toast.error("Título requerido"); return; }
    setSaving(true);
    if (!memForm.membership_tier) { toast.error("Selecciona el nivel que otorga la membresía"); return; }
    const payload = {
      portal_id: portalId,
      title: memForm.title.trim(),
      description: memForm.description.trim() || null,
      price_usd: Number(memForm.price_usd) || 0,
      product_type: "membership",
      membership_tier: memForm.membership_tier,
      image_url: memForm.image_url || null,
      validity_months: memForm.validity_months ?? null,
      status: memForm.status,
    };
    const { error } = memId
      ? await supabase.from("portal_products").update(payload).eq("id", memId)
      : await supabase.from("portal_products").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(memId ? "Membresía actualizada" : "Membresía creada");
    setMemDialog(false);
    fetchAll();
  };

  const deleteMembership = async (id: string) => {
    if (!confirm("¿Eliminar esta membresía?")) return;
    const { error } = await supabase.from("portal_products").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Membresía eliminada"); fetchAll(); }
  };

  const toggleMembership = async (m: Membership) => {
    const status = m.status === "active" ? "inactive" : "active";
    await supabase.from("portal_products").update({ status }).eq("id", m.id);
    fetchAll();
  };

  // ---- Bundle CRUD ----
  const openBundle = (b?: Bundle) => {
    if (b) {
      setBundleId(b.id);
      setBundleForm({ title: b.title, description: b.description || "", price_usd: b.price_usd, status: b.status, course_ids: b.course_ids });
    } else {
      setBundleId(null);
      setBundleForm(emptyBundle);
    }
    setBundleDialog(true);
  };

  const toggleBundleCourse = (courseId: string) => {
    setBundleForm((f: any) => ({
      ...f,
      course_ids: f.course_ids.includes(courseId)
        ? f.course_ids.filter((c: string) => c !== courseId)
        : [...f.course_ids, courseId],
    }));
  };

  const saveBundle = async () => {
    if (!bundleForm.title.trim()) { toast.error("Título requerido"); return; }
    if (bundleForm.course_ids.length === 0) { toast.error("Selecciona al menos un curso"); return; }
    setSaving(true);
    try {
      const bundlePayload = {
        portal_id: portalId,
        title: bundleForm.title.trim(),
        description: bundleForm.description.trim() || null,
        price_usd: Number(bundleForm.price_usd) || 0,
        status: bundleForm.status,
        updated_at: new Date().toISOString(),
      };

      let id = bundleId;
      let existing: Bundle | undefined = bundles.find(b => b.id === bundleId);

      if (id) {
        const { error } = await supabase.from("academy_bundles").update(bundlePayload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("academy_bundles").insert(bundlePayload).select("id").single();
        if (error) throw error;
        id = (data as any).id;
      }

      // Sincronizar la relación bundle ↔ cursos
      await supabase.from("academy_bundle_courses").delete().eq("bundle_id", id);
      if (bundleForm.course_ids.length > 0) {
        await supabase.from("academy_bundle_courses").insert(
          bundleForm.course_ids.map((cid: string) => ({ bundle_id: id, course_id: cid }))
        );
      }

      // Sincronizar el portal_product vendible (type='bundle', reference_id = bundle.id)
      const productPayload = {
        portal_id: portalId,
        title: bundleForm.title.trim(),
        description: bundleForm.description.trim() || null,
        price_usd: Number(bundleForm.price_usd) || 0,
        product_type: "bundle",
        reference_id: id,
        status: bundleForm.status === "published" ? "active" : "inactive",
      };
      if (existing?.product_id) {
        await supabase.from("portal_products").update(productPayload).eq("id", existing.product_id);
      } else {
        const { data: prod } = await supabase.from("portal_products").insert(productPayload).select("id").single();
        if (prod) await supabase.from("academy_bundles").update({ product_id: (prod as any).id }).eq("id", id);
      }

      toast.success(bundleId ? "Paquete actualizado" : "Paquete creado");
      setBundleDialog(false);
      fetchAll();
    } catch (e: any) {
      toast.error("Error al guardar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteBundle = async (b: Bundle) => {
    if (!confirm("¿Eliminar este paquete?")) return;
    if (b.product_id) await supabase.from("portal_products").delete().eq("id", b.product_id);
    const { error } = await supabase.from("academy_bundles").delete().eq("id", b.id);
    if (error) toast.error(error.message); else { toast.success("Paquete eliminado"); fetchAll(); }
  };

  const tierLabel = (t: string | null) => labelFor(t);
  const validityLabel = (vm: number | null) => (vm && vm > 0) ? `${vm} ${vm === 1 ? "mes" : "meses"}` : "Vitalicia";

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      {/* Membresías */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-foreground flex items-center gap-2"><Crown className="w-4 h-4 text-yellow-500" /> Membresías</h3>
            <p className="text-xs text-muted-foreground">Vende un nivel (VIP/Platino) que desbloquea los cursos restringidos a ese nivel.</p>
          </div>
          <Button size="sm" onClick={() => openMembership()} className="gap-1.5"><Plus className="w-4 h-4" /> Nueva membresía</Button>
        </div>
        {memberships.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Aún no hay membresías.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {memberships.map(m => (
              <Card key={m.id}><CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{m.title}</span>
                    <Badge variant="outline" className="text-xs">Nivel: {tierLabel(m.membership_tier)}</Badge>
                    <Badge variant="outline" className="text-xs">Validez: {validityLabel(m.validity_months)}</Badge>
                    <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500/30">${m.price_usd} USD</Badge>
                    <Badge variant={m.status === "active" ? "default" : "secondary"} className="text-xs">{m.status === "active" ? "Activa" : "Inactiva"}</Badge>
                  </div>
                  {m.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{m.description}</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Distribución de red personalizada" onClick={() => setOverrideTarget({ productId: m.id, title: m.title, price: m.price_usd })}><Network className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1" onClick={() => toggleMembership(m)}>
                  {m.status === "active" ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openMembership(m)}><Edit className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMembership(m.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </CardContent></Card>
            ))}
          </div>
        )}
      </section>

      {/* Paquetes */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-foreground flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> Paquetes</h3>
            <p className="text-xs text-muted-foreground">Agrupa varios cursos en un paquete; al comprarlo el usuario queda inscrito en todos.</p>
          </div>
          <Button size="sm" onClick={() => openBundle()} className="gap-1.5"><Plus className="w-4 h-4" /> Nuevo paquete</Button>
        </div>
        {bundles.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Aún no hay paquetes.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {bundles.map(b => (
              <Card key={b.id}><CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{b.title}</span>
                    <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500/30">${b.price_usd} USD</Badge>
                    <Badge variant="outline" className="text-xs">{b.course_ids.length} curso(s)</Badge>
                    <Badge variant={b.status === "published" ? "default" : "secondary"} className="text-xs">{b.status === "published" ? "Publicado" : "Borrador"}</Badge>
                  </div>
                  {b.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{b.description}</p>}
                </div>
                {b.product_id && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Distribución de red personalizada" onClick={() => setOverrideTarget({ productId: b.product_id!, title: b.title, price: b.price_usd })}><Network className="w-3.5 h-3.5" /></Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openBundle(b)}><Edit className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteBundle(b)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </CardContent></Card>
            ))}
          </div>
        )}
      </section>

      {/* Membership dialog */}
      <Dialog open={memDialog} onOpenChange={setMemDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{memId ? "Editar membresía" : "Nueva membresía"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Título</Label><Input value={memForm.title} onChange={e => setMemForm((f: any) => ({ ...f, title: e.target.value }))} placeholder="Ej: Membresía VIP" /></div>
            <div><Label>Descripción</Label><Textarea value={memForm.description} onChange={e => setMemForm((f: any) => ({ ...f, description: e.target.value }))} rows={2} /></div>

            {/* Imagen de la membresía (se muestra en la tienda del usuario) */}
            <div>
              <Label>Imagen (opcional)</Label>
              <p className="text-xs text-muted-foreground mb-1.5">Se muestra en la tienda para incentivar la compra. Máx 2MB.</p>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleMembershipImage(f); }} />
              {memForm.image_url ? (
                <div className="relative w-full h-32 rounded-md overflow-hidden border border-border">
                  <img src={memForm.image_url} alt="Membresía" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setMemForm((f: any) => ({ ...f, image_url: null }))} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"><X className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImg} className="absolute bottom-1 right-1 text-[11px] bg-black/60 text-white px-2 py-1 rounded hover:bg-black/80">Cambiar</button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImg} className="w-full h-24 rounded-md border border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 transition-colors">
                  {uploadingImg ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                  <span className="text-xs">{uploadingImg ? "Subiendo..." : "Subir imagen"}</span>
                </button>
              )}
            </div>

            <div>
              <Label>Validez</Label>
              <p className="text-xs text-muted-foreground mb-1.5">Empieza a contar cuando el usuario paga. Al vencer, baja automáticamente al nivel base.</p>
              <Select
                value={memForm.validity_months == null ? "lifetime" : String(memForm.validity_months)}
                onValueChange={v => setMemForm((f: any) => ({ ...f, validity_months: v === "lifetime" ? null : Number(v) }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lifetime">Vitalicia (sin vencimiento)</SelectItem>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                    <SelectItem key={n} value={String(n)}>{n} {n === 1 ? "mes" : "meses"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nivel que otorga</Label>
                {sellableTiers.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-1 rounded-md border border-border bg-muted/40 p-2">No hay niveles vendibles. Crea un nivel en "Clientes/Niveles" primero.</p>
                ) : (
                  <Select value={memForm.membership_tier} onValueChange={v => setMemForm((f: any) => ({ ...f, membership_tier: v }))}>
                    <SelectTrigger><SelectValue placeholder="Elige un nivel" /></SelectTrigger>
                    <SelectContent>{sellableTiers.map(t => <SelectItem key={t.id} value={t.slug}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
              <div><Label>Precio USD</Label><Input type="number" min="0" value={memForm.price_usd} onChange={e => setMemForm((f: any) => ({ ...f, price_usd: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemDialog(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={saveMembership} disabled={saving} className="gap-1.5">{saving && <Loader2 className="w-4 h-4 animate-spin" />}{memId ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bundle dialog */}
      <Dialog open={bundleDialog} onOpenChange={setBundleDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{bundleId ? "Editar paquete" : "Nuevo paquete"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Título</Label><Input value={bundleForm.title} onChange={e => setBundleForm((f: any) => ({ ...f, title: e.target.value }))} placeholder="Ej: Pack Trading Completo" /></div>
            <div><Label>Descripción</Label><Textarea value={bundleForm.description} onChange={e => setBundleForm((f: any) => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Precio USD</Label><Input type="number" min="0" value={bundleForm.price_usd} onChange={e => setBundleForm((f: any) => ({ ...f, price_usd: parseFloat(e.target.value) || 0 }))} /></div>
              <div>
                <Label>Estado</Label>
                <Select value={bundleForm.status} onValueChange={v => setBundleForm((f: any) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="published">Publicado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Cursos incluidos</Label>
              {courses.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-1">No hay cursos en este portal aún.</p>
              ) : (
                <div className="mt-1 space-y-1 max-h-52 overflow-y-auto border border-border rounded-md p-2">
                  {courses.map(c => (
                    <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                      <input type="checkbox" checked={bundleForm.course_ids.includes(c.id)} onChange={() => toggleBundleCourse(c.id)} />
                      <span className="truncate">{c.title}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBundleDialog(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={saveBundle} disabled={saving} className="gap-1.5">{saving && <Loader2 className="w-4 h-4 animate-spin" />}{bundleId ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override de distribución de red por producto (opcional) */}
      {overrideTarget && (
        <ProductCommissionLevelsDialog
          open={!!overrideTarget}
          onOpenChange={(v) => { if (!v) setOverrideTarget(null); }}
          productId={overrideTarget.productId}
          portalId={portalId}
          productTitle={overrideTarget.title}
          productPrice={overrideTarget.price}
        />
      )}
    </div>
  );
};

export default AcademyMonetization;
