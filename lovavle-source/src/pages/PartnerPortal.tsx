import { useState, useEffect } from "react";
import { useParams, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PartnerLogin from "@/components/partner/PartnerLogin";
import PartnerClientLayout from "@/components/partner/PartnerClientLayout";
import PartnerAdminLayout from "@/components/partner/PartnerAdminLayout";
import PartnerResetPassword from "@/components/partner/PartnerResetPassword";
import { Loader2 } from "lucide-react";

interface PortalData {
  id: string;
  nombre_portal: string;
  display_name: string;
  ib_id: string;
  status: string;
}

const PartnerPortal = ({ slugOverride }: { slugOverride?: string } = {}) => {
  const { slug: slugFromParams } = useParams<{ slug: string }>();
  // En un dominio propio (clubfinanciero.pro) el portal se monta en la raíz sin
  // :slug en la URL; ahí llega slugOverride. En bullfytech.online viene del path.
  const slug = slugOverride ?? slugFromParams;
  const [portal, setPortal] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Mark <html> with the portal slug so we can apply scoped branding via CSS
  useEffect(() => {
    if (!slug) return;
    document.documentElement.setAttribute("data-portal", slug);
    return () => {
      document.documentElement.removeAttribute("data-portal");
    };
  }, [slug]);

  useEffect(() => {
    const fetchPortal = async () => {
      if (!slug) { setNotFound(true); setLoading(false); return; }
      const { data, error } = await supabase
        .from("partner_portals")
        .select("*")
        .eq("nombre_portal", slug)
        .eq("status", "active")
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
      } else {
        setPortal(data as PortalData);
      }
      setLoading(false);
    };
    fetchPortal();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !portal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-display font-bold text-foreground">Portal no encontrado</h1>
          <p className="text-muted-foreground">El portal que buscas no existe o no está activo.</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<PartnerLogin portal={portal} />} />
      <Route path="/reset" element={<PartnerResetPassword portal={portal} />} />
      <Route path="/admin/*" element={<PartnerAdminLayout portal={portal} />} />
      <Route path="/app/*" element={<PartnerClientLayout portal={portal} />} />
    </Routes>
  );
};

export default PartnerPortal;
