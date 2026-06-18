import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toastUtils";
import { usePortalBrand, brandText } from "@/lib/portalBrand";
import { ExternalLink, Save, Loader2 } from "lucide-react";

interface BullfyReferralLinkCardProps {
  portalId: string;
}

const BullfyReferralLinkCard = ({ portalId }: BullfyReferralLinkCardProps) => {
  const { isWhiteLabel } = usePortalBrand();
  const [link, setLink] = useState("");
  const [initial, setInitial] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("partner_portals")
        .select("bullfy_referral_link")
        .eq("id", portalId)
        .maybeSingle();
      if (cancelled) return;
      const v = (data?.bullfy_referral_link as string | null) || "";
      setLink(v);
      setInitial(v);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [portalId]);

  const handleSave = async () => {
    const trimmed = link.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      toast.error("El link debe iniciar con http:// o https://");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("partner_portals")
      .update({ bullfy_referral_link: trimmed || null })
      .eq("id", portalId);
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar: " + error.message);
      return;
    }
    setInitial(trimmed);
    toast.success("Link de referido guardado");
  };

  const dirty = link.trim() !== initial.trim();

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3 mb-2">
          <ExternalLink className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">{brandText(isWhiteLabel, "Tu Link de Referido de Bullfy")}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          {brandText(isWhiteLabel, "Pega aquí tu link de afiliado de Bullfy. Cada lead capturado en un stream público de este portal quedará atribuido automáticamente a este link en el Bullfy Lead System.")}
        </p>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://bullfy.com/?ref=tu-codigo"
              className="text-sm"
            />
            <Button size="sm" onClick={handleSave} disabled={!dirty || saving} className="gap-1.5 shrink-0">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BullfyReferralLinkCard;
