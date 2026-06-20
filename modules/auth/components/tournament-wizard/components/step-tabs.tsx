import { Check } from "lucide-react";
import { TOURNAMENT_WIZARD_STEPS } from "../constants";
import { useTournamentWizard } from "../context";

export function StepTabs() {
  const {
    actions: { goToStep },
    state: { stepIndex },
  } = useTournamentWizard();

  return (
    <div className="mt-5 grid gap-2 md:grid-cols-4">
      {TOURNAMENT_WIZARD_STEPS.map((step, index) => {
        const isActive = index === stepIndex;
        const isDone = index < stepIndex;

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => goToStep(index)}
            className={[
              "flex min-h-16 items-center gap-3 border p-3 text-left transition-colors",
              isActive
                ? "border-[#00E5FF]/60 bg-[#00E5FF]/10"
                : "border-white/10 bg-black/20 hover:border-white/25",
            ].join(" ")}
          >
            <span
              className={[
                "flex size-8 shrink-0 items-center justify-center border text-xs font-black",
                isDone
                  ? "border-[#B6FF3D]/45 bg-[#B6FF3D]/15 text-[#B6FF3D]"
                  : "border-white/15 bg-black/20 text-white",
              ].join(" ")}
            >
              {isDone ? <Check className="size-4" /> : `0${index + 1}`}
            </span>
            <span>
              <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                {step.label}
              </span>
              <span className="mt-1 block text-sm font-black uppercase">
                {step.title}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
