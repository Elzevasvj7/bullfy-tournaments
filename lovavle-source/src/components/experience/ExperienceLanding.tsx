import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Users, DollarSign, BarChart3, Zap, Globe, Shield, Award } from "lucide-react";

const benefits = [
  { icon: DollarSign, title: "Ingresos Recurrentes", desc: "Genera ingresos pasivos con cada operación de tus clientes referidos" },
  { icon: Users, title: "Red de Sub IBs", desc: "Construye tu propia red de afiliados y multiplica tus ganancias" },
  { icon: BarChart3, title: "Modelos Flexibles", desc: "CPA, Rebates, Híbrido o PropFirm — elige el que más te convenga" },
  { icon: Globe, title: "Alcance Global", desc: "Opera desde cualquier parte del mundo con soporte multiregional" },
  { icon: Shield, title: "Broker Regulado", desc: "Transparencia total con un broker confiable y regulado" },
  { icon: Award, title: "Herramientas Pro", desc: "Accede a simuladores, análisis y reportes profesionales" },
];

const stats = [
  { value: "5+", label: "Modelos de Negocio" },
  { value: "10+", label: "Herramientas de Simulación" },
  { value: "24/7", label: "Soporte Dedicado" },
  { value: "∞", label: "Potencial de Crecimiento" },
];

const ExperienceLanding = () => {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="text-center py-12 md:py-20 space-y-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono uppercase tracking-widest">
            <Zap className="w-3 h-3" />
            Experiencia Interactiva
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
            <span className="text-foreground">Construye tu</span>
            <br />
            <span className="text-gradient-brand">Imperio IB</span>
            <br />
            <span className="text-foreground">con Bullfy</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Descubre cuánto podrías ganar como Introducing Broker. 
            Simula, analiza y construye tu estrategia con nuestras herramientas profesionales.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/IbBullfyExperience/dashboard">
            <Button size="lg" className="bg-gradient-brand text-lg px-8 py-6 shadow-brand hover:opacity-90 transition-opacity">
              <TrendingUp className="w-5 h-5 mr-2" />
              Descubre cuánto podrías construir
            </Button>
          </Link>
          <Link to="/IbBullfyExperience/dashboard">
            <Button variant="outline" size="lg" className="text-lg px-8 py-6">
              Ver mi Dashboard
            </Button>
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="bg-card/50 border-border/50 text-center">
            <CardContent className="pt-6">
              <p className="text-3xl md:text-4xl font-bold text-gradient-brand">{s.value}</p>
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Benefits */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold">¿Por qué Bullfy?</h2>
          <p className="text-muted-foreground">Todo lo que necesitas para construir un negocio IB exitoso</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {benefits.map((b) => (
            <Card key={b.title} className="bg-card/50 border-border/50 hover:border-primary/30 transition-colors group">
              <CardContent className="pt-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <b.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">{b.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center py-12 space-y-6 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
        <h2 className="text-2xl md:text-3xl font-bold">¿Listo para empezar?</h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Usa nuestros simuladores gratuitos para descubrir tu potencial como IB. Sin compromiso.
        </p>
        <Link to="/IbBullfyExperience/dashboard">
          <Button size="lg" className="bg-gradient-brand shadow-brand px-8">
            Comienza tu Experiencia
          </Button>
        </Link>
      </section>
    </div>
  );
};

export default ExperienceLanding;
