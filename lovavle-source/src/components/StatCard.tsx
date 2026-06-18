import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
}

const StatCard = ({ title, value, subtitle, icon: Icon, trend }: StatCardProps) => {
  return (
    <div className="bg-gradient-card rounded-xl border border-border p-5 shadow-card hover:border-primary/20 transition-all group">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-display font-bold text-foreground">{value}</p>
          {subtitle && (
            <p className={`text-xs font-medium ${
              trend === "up" ? "text-accent" : trend === "down" ? "text-destructive" : "text-muted-foreground"
            }`}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
