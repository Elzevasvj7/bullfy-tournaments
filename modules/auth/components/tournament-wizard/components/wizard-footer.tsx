import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTournamentWizard } from "../context";

export function WizardFooter() {
  const {
    actions: { nextStep, previousStep },
    meta: { activeStep, canMoveNext },
    state: { pendingAction, stepIndex },
  } = useTournamentWizard();

  return (
    <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-between">
      <Button
        type="button"
        variant="outline"
        disabled={stepIndex === 0 || pendingAction === "submit"}
        onClick={previousStep}
        className="h-11 justify-center border-white/15 bg-black/20 text-white hover:bg-white/10"
      >
        <ArrowLeft className="size-4" />
        Anterior
      </Button>

      {activeStep.id === "review" ? (
        <Button
          type="submit"
          variant="neonGreenSolid"
          disabled={!canMoveNext || pendingAction === "submit"}
          className="h-11 justify-center px-6"
        >
          {pendingAction === "submit" ? "Creando..." : "Crear usuario y clan"}
          <CheckCircle2 className="size-4" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="neonBlueSolid"
          disabled={!canMoveNext}
          onClick={nextStep}
          className="h-11 justify-center px-6"
        >
          Continuar
          <ArrowRight className="size-4" />
        </Button>
      )}
    </div>
  );
}
