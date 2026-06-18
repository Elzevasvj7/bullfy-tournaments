import { useEffect, useState, useRef } from "react";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "documents";
const GLOBAL_PATH = "sidebar_banners/global.png";
const userPath = (uid: string) => `sidebar_banners/user_${uid}.png`;

interface SidebarBannerProps {
  userId: string | undefined;
  isGlobalAdmin: boolean;
}

async function fileExists(path: string): Promise<string | null> {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  try {
    const res = await fetch(data.publicUrl, { method: "HEAD" });
    if (res.ok) return data.publicUrl + "?t=" + Date.now();
  } catch {}
  return null;
}

const SidebarBanner = ({ userId, isGlobalAdmin }: SidebarBannerProps) => {
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load banner: personal first, then global fallback
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const personal = await fileExists(userPath(userId));
      if (personal) { setBannerUrl(personal); return; }
      const global = await fileExists(GLOBAL_PATH);
      if (global) { setBannerUrl(global); return; }
      setBannerUrl(null);
    })();
  }, [userId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true);
    try {
      if (isGlobalAdmin) {
        // Upload as global default
        await supabase.storage.from(BUCKET).remove([GLOBAL_PATH]);
        const { error } = await supabase.storage.from(BUCKET).upload(GLOBAL_PATH, file, { upsert: true });
        if (error) throw error;

        // Delete all personal banners so everyone sees the new global
        const { data: files } = await supabase.storage.from(BUCKET).list("sidebar_banners", { limit: 1000 });
        if (files) {
          const personalFiles = files.filter(f => f.name.startsWith("user_")).map(f => `sidebar_banners/${f.name}`);
          if (personalFiles.length > 0) {
            await supabase.storage.from(BUCKET).remove(personalFiles);
          }
        }

        const url = await fileExists(GLOBAL_PATH);
        setBannerUrl(url);
        toast({ title: "✅ Imagen global actualizada para todos" });
      } else {
        // Upload as personal banner
        const path = userPath(userId);
        await supabase.storage.from(BUCKET).remove([path]);
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
        if (error) throw error;
        const url = await fileExists(path);
        setBannerUrl(url);
        toast({ title: "✅ Imagen personalizada guardada" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!userId) return;
    setDeleting(true);
    try {
      if (isGlobalAdmin) {
        // Delete global + all personal
        await supabase.storage.from(BUCKET).remove([GLOBAL_PATH]);
        const { data: files } = await supabase.storage.from(BUCKET).list("sidebar_banners", { limit: 1000 });
        if (files) {
          const all = files.map(f => `sidebar_banners/${f.name}`);
          if (all.length > 0) await supabase.storage.from(BUCKET).remove(all);
        }
        setBannerUrl(null);
        toast({ title: "Imagen global eliminada" });
      } else {
        // Delete personal → fall back to global
        await supabase.storage.from(BUCKET).remove([userPath(userId)]);
        const global = await fileExists(GLOBAL_PATH);
        setBannerUrl(global);
        toast({ title: global ? "Tu imagen fue eliminada, se muestra la global" : "Imagen eliminada" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mt-4 pt-3 border-t border-border/50">
      {bannerUrl ? (
        <div className="relative group">
          <img src={bannerUrl} alt="Banner" className="w-full rounded-lg object-cover" />
          <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <input ref={inputRef} type="file" className="hidden" accept="image/*" onChange={handleUpload} />
            <Button
              variant="secondary" size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="h-6 w-6 p-0" title="Cambiar imagen"
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            </Button>
            <Button
              variant="secondary" size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="h-6 w-6 p-0 hover:text-destructive" title="Eliminar imagen"
            >
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <input ref={inputRef} type="file" className="hidden" accept="image/*" onChange={handleUpload} />
          <Button
            variant="outline" size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full gap-1.5 text-xs"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {isGlobalAdmin ? "Subir imagen global" : "Subir imagen"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default SidebarBanner;
