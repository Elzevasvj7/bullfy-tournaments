import { ReactNode } from "react";
import { useOnboardingStore } from "@/stores/onboardingStore";

interface IBContextBannerProps {
  children?: ReactNode;
}

const IBContextBanner = ({ children }: IBContextBannerProps) => {
  const { formData } = useOnboardingStore();

  if (!formData.nombre_ib && !formData.correo_ib) return null;

  return (
    <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">
        Configuración para IB:
      </p>
      <p className="text-sm font-semibold text-foreground">
        {formData.nombre_ib || "—"}
      </p>
      {formData.correo_ib && (
        <p className="text-xs text-muted-foreground">{formData.correo_ib}</p>
      )}
      {children}
    </div>
  );
};

export default IBContextBanner;
