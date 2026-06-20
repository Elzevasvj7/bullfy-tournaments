import { Crown } from "lucide-react";
import { useTournamentWizard } from "../context";
import { CheckRow } from "./check-row";
import { PreviewMetric } from "./preview-metric";

export function WizardSidebar() {
  const {
    meta: { activeStep, previewDescription, previewName, previewTag },
    state: { emailVerified, form, smsVerified },
  } = useTournamentWizard();

  return (
    <aside className="grid content-start gap-5 lg:pt-28">
      <div className="border border-[#00E5FF]/20 bg-black/30 p-5 shadow-[0_0_32px_rgba(0,229,255,0.10)] backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              Vista previa
            </p>
            <h2 className="mt-2 text-2xl font-black uppercase leading-none">
              [{previewTag}] {previewName}
            </h2>
          </div>
          <div className="flex size-14 shrink-0 items-center justify-center border border-[#00E5FF]/35 bg-[#00E5FF]/10 text-xl font-black text-[#00E5FF]">
            {previewTag.slice(0, 2)}
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          {previewDescription}
        </p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <PreviewMetric label="Estado" value="VIP" />
          <PreviewMetric label="Roster" value="1" />
          <PreviewMetric label="Modo" value={form.clanPublic ? "Open" : "Key"} />
        </div>
      </div>

      <div className="border border-white/10 bg-[#0A1129]/70 p-5">
        <h2 className="flex items-center gap-2 text-lg font-black uppercase">
          <Crown className="size-5 text-[#B6FF3D]" />
          Checklist
        </h2>
        <div className="mt-4 grid gap-3">
          <CheckRow active={Boolean(form.fullName && form.email && form.phone)}>
            Identidad del trader
          </CheckRow>
          <CheckRow active={emailVerified && smsVerified}>
            Verificacion completada
          </CheckRow>
          <CheckRow active={Boolean(form.clanName && form.clanTag)}>
            Clan con nombre y tag
          </CheckRow>
          <CheckRow active={activeStep.id === "review"}>
            Listo para confirmar
          </CheckRow>
        </div>
      </div>
    </aside>
  );
}
