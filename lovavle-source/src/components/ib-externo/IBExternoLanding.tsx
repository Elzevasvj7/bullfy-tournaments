import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Clock, CheckCircle, Megaphone, ArrowRight, Sparkles, UserPlus, FileDown } from "lucide-react";
import logoSrc from "@/assets/logo-bullfy.png";

interface Promotion {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  file_url: string | null;
  cta_text: string | null;
  cta_url: string | null;
}

const MOTIVATIONAL_MESSAGES = [
  "💪 El éxito no es casualidad. Es trabajo duro, perseverancia y aprendizaje constante.",
  "🎯 Cada día es una nueva oportunidad para acercarte más a tus metas.",
  "🚀 Los grandes logros requieren grandes esfuerzos. ¡Sigue adelante!",
  "🌟 La disciplina es el puente entre tus metas y tus resultados.",
  "📈 No se trata de ser el mejor, se trata de ser mejor que ayer.",
  "🔑 La clave del éxito está en la consistencia de tus acciones diarias.",
  "💡 Las oportunidades no ocurren, las creas tú.",
  "🏆 El camino al éxito está pavimentado con decisiones inteligentes.",
  "⭐ Haz hoy lo que otros no quieren, para tener mañana lo que otros no pueden.",
  "🎯 Un objetivo sin plan es solo un deseo. ¡Planifica y ejecuta!",
  "💎 La excelencia no es un acto, es un hábito.",
  "🔥 Tu único límite eres tú mismo. ¡Rompe barreras!",
  "📊 Mide tu progreso, celebra tus logros y aprende de los obstáculos.",
  "🌱 Cada cliente satisfecho es una semilla que dará frutos en tu red.",
  "⚡ La productividad no es hacer más cosas, es hacer las cosas correctas.",
  "🏅 Los profesionales exitosos hacen con excelencia las tareas que otros consideran simples.",
  "🎯 Enfócate en el proceso y los resultados llegarán.",
  "💼 Tu red de IBs es tan fuerte como la dedicación que le pones.",
  "🌟 Cada interacción con un cliente es una oportunidad de crear valor.",
  "🚀 No esperes el momento perfecto, crea el momento perfecto.",
];

const IBExternoLanding = () => {
  const { profile } = useAuth();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [requestCounts, setRequestCounts] = useState({ pendiente: 0, en_proceso: 0, completado: 0 });
  const [motivationalIndex, setMotivationalIndex] = useState(() => Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length));
  const [displayName, setDisplayName] = useState(profile?.nombre || "IB");

  // Fetch alias
  useEffect(() => {
    const fetchAlias = async () => {
      if (profile?.sub_ib_id) {
        const { data } = await supabase.from("sub_ibs").select("alias, nombre").eq("id", profile.sub_ib_id).single();
        if (data) setDisplayName(data.alias || data.nombre || profile.nombre);
      } else if (profile?.ib_id) {
        const { data } = await (supabase.from as any)("ibs").select("alias, nombre_ib").eq("id", profile.ib_id).single();
        if (data) setDisplayName(data.alias || data.nombre_ib || profile.nombre);
      } else {
        setDisplayName(profile?.nombre || "IB");
      }
    };
    fetchAlias();
  }, [profile]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMotivationalIndex((prev) => {
        let next: number;
        do {
          next = Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length);
        } while (next === prev && MOTIVATIONAL_MESSAGES.length > 1);
        return next;
      });
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const [promoRes, reqRes] = await Promise.all([
        supabase.from("ib_portal_promotions").select("id, title, description, image_url, file_url, cta_text, cta_url").eq("active", true).order("display_order"),
        supabase.from("ib_external_requests").select("status").eq("requested_by", profile?.ib_id ? "" : ""),
      ]);
      setPromotions((promoRes.data as any) ?? []);
    };
    loadData();
  }, []);

  useEffect(() => {
    const loadCounts = async () => {
      const { data } = await supabase.from("ib_external_requests").select("status");
      if (data) {
        setRequestCounts({
          pendiente: data.filter(r => r.status === "pendiente_bd").length,
          en_proceso: data.filter(r => ["aprobado_bd", "en_proceso_ops"].includes(r.status)).length,
          completado: data.filter(r => r.status === "completado").length,
        });
      }
    };
    loadCounts();
  }, []);

  return (
    <div className="space-y-8">
      {/* Motivational Message */}
      <div className="rounded-xl px-6 py-6 text-center transition-all duration-500" style={{ background: 'linear-gradient(135deg, rgba(38,166,91,0.12) 0%, rgba(220,38,38,0.12) 100%)', border: '1px solid rgba(38,166,91,0.3)' }}>
        <p className="text-xl md:text-2xl font-semibold italic bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(90deg, #26A65B 0%, #DC2626 50%, #26A65B 100%)' }}>
          {MOTIVATIONAL_MESSAGES[motivationalIndex]}
        </p>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-primary/5 to-background border border-primary/20 p-8 md:p-12">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <img src={logoSrc} alt="Bullfy" className="h-10" />
            <Badge variant="outline" className="border-primary/40 text-primary text-xs">Portal IB</Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Bienvenido, {displayName}
          </h1>
          <p className="text-muted-foreground max-w-lg mb-6">
            Gestiona tus solicitudes de operaciones, incorpora nuevos Sub IBs y mantente al día con las últimas novedades de Bullfy.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/ib-portal/nueva?tipo=sub_ib">
              <Button size="lg" className="gap-2 shadow-lg">
                <UserPlus className="w-5 h-5" />
                Nuevo Sub IB
              </Button>
            </Link>
            <Link to="/ib-portal/nueva?tipo=especial">
              <Button variant="outline" size="lg" className="gap-2">
                <Sparkles className="w-5 h-5" />
                Nueva Solicitud Especial
              </Button>
            </Link>
            <Link to="/ib-portal/solicitudes">
              <Button variant="outline" size="lg" className="gap-2">
                <FileText className="w-5 h-5" />
                Mis Solicitudes
              </Button>
            </Link>
          </div>
        </div>
        <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-primary/5 blur-2xl" />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="pt-4 pb-4 text-center">
            <Clock className="w-5 h-5 mx-auto mb-1 text-yellow-400" />
            <p className="text-2xl font-bold text-foreground">{requestCounts.pendiente}</p>
            <p className="text-[11px] text-muted-foreground">Pendientes</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-4 pb-4 text-center">
            <FileText className="w-5 h-5 mx-auto mb-1 text-blue-400" />
            <p className="text-2xl font-bold text-foreground">{requestCounts.en_proceso}</p>
            <p className="text-[11px] text-muted-foreground">En Proceso</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="pt-4 pb-4 text-center">
            <CheckCircle className="w-5 h-5 mx-auto mb-1 text-green-400" />
            <p className="text-2xl font-bold text-foreground">{requestCounts.completado}</p>
            <p className="text-[11px] text-muted-foreground">Completados</p>
          </CardContent>
        </Card>
      </div>

      {/* Promotions */}
      {promotions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            Novedades y Promociones
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {promotions.map((promo) => (
              <Card key={promo.id} className="overflow-hidden">
                {promo.image_url && (
                  <div className="h-40 bg-secondary">
                    <img src={promo.image_url} alt={promo.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <CardContent className={promo.image_url ? "pt-4 pb-4" : "pt-5 pb-5"}>
                  <h3 className="font-semibold text-foreground mb-1">{promo.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{promo.description}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {promo.file_url && (
                      <a href={promo.file_url} target="_blank" rel="noopener noreferrer" download>
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <FileDown className="w-3.5 h-3.5" />
                          Descargar PDF
                        </Button>
                      </a>
                    )}
                    {promo.cta_text && promo.cta_url && (
                      <a href={promo.cta_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1.5">
                          {promo.cta_text}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default IBExternoLanding;
