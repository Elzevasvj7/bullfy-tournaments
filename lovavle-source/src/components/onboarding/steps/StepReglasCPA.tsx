import IBContextBanner from "../IBContextBanner";
import { CPA_RULES } from "@/services/cpaRules";

const StepReglasCPA = () => {
  const reglas = CPA_RULES;

  return (
    <div className="space-y-6">
      <IBContextBanner />
      <div>
        <h3 className="text-lg font-display font-bold text-foreground">Reglas CPA / Híbrido</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Reglas aplicables al modelo CPA e Híbrido
        </p>
      </div>

      <div className="space-y-4">
        {reglas.map((regla, i) => (
          <div key={i} className="rounded-lg border border-border p-4 bg-card">
            <h4 className="text-sm font-semibold text-foreground mb-2">{regla.titulo}</h4>
            {regla.desc && (
              <p className="text-xs text-muted-foreground mb-2">{regla.desc}</p>
            )}
            <ul className="space-y-1">
              {regla.items.map((item, j) => (
                <li key={j} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <p className="text-xs text-muted-foreground">
          ⚠️ Estas reglas serán incluidas automáticamente en el IB Agreement y en el Technical Report.
        </p>
      </div>
    </div>
  );
};

export default StepReglasCPA;
