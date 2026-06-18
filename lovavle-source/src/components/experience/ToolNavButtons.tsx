import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Wrench, BarChart3, ArrowRight } from "lucide-react";

const ToolNavButtons = () => (
  <div className="space-y-4 pt-6 border-t border-border/50 mt-8">
    <Card className="bg-primary/5 border-primary/20">
      <CardContent className="py-4 flex flex-col sm:flex-row items-center justify-center gap-3 text-center">
        <p className="text-sm font-semibold text-foreground">📊 Ve a tu Dashboard para mirar tu progreso</p>
        <Link to="/IbBullfyExperience/dashboard">
          <Button className="bg-gradient-brand shadow-brand gap-2">
            <BarChart3 className="w-4 h-4" />
            Ir a Dashboard
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
    <div className="flex justify-center">
      <Link to="/IbBullfyExperience/tools">
        <Button variant="outline" size="sm" className="gap-2 text-muted-foreground">
          <Wrench className="w-4 h-4" />
          Más Herramientas
        </Button>
      </Link>
    </div>
  </div>
);

export default ToolNavButtons;
