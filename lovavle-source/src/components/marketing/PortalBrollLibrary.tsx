import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { toast } from "@/lib/toastUtils";

interface Props {
  portalId?: string;
}

interface BrollAsset {
  id: string;
  asset_type: string;
  asset_url: string;
  label: string | null;
  tags: string[] | null;
}

export default function PortalBrollLibrary({ portalId }: Props) {
  const [assets, setAssets] = useState<BrollAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [label, setLabel] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("portal_broll_library").select("*").order("created_at", { ascending: false });
    if (portalId) q = q.eq("portal_id", portalId); else q = q.is("portal_id", null);
    const { data } = await q;
    setAssets((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [portalId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `${portalId || "global"}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("clip-broll").upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("clip-broll").getPublicUrl(path);
      const { error: insErr } = await supabase.from("portal_broll_library").insert({
        portal_id: portalId || null,
        asset_type: file.type.startsWith("video/") ? "video" : "image",
        asset_url: publicUrl,
        label: label || file.name,
      });
      if (insErr) throw insErr;
      toast.success("Subido");
      setLabel("");
      load();
    } catch (e: any) {
      toast.error("Error: " + (e.message || ""));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar?")) return;
    await supabase.from("portal_broll_library").delete().eq("id", id);
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><ImageIcon className="w-4 h-4" /> Biblioteca B-Roll</CardTitle>
        <CardDescription>Imágenes y videos de overlay para los clips de tu portal</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Etiqueta (opcional)" />
          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleUpload} className="hidden" />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1.5 shrink-0">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Subir
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : assets.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">Sin assets</p>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {assets.map((a) => (
              <div key={a.id} className="relative group border border-border rounded overflow-hidden">
                {a.asset_type === "image" ? (
                  <img src={a.asset_url} alt={a.label || ""} className="w-full aspect-square object-cover" />
                ) : (
                  <video src={a.asset_url} className="w-full aspect-square object-cover" muted />
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(a.id)} className="h-7 w-7 p-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {a.label && <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 truncate">{a.label}</div>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
