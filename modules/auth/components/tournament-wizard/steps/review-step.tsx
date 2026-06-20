import { ShieldCheck, Swords, User } from "lucide-react";
import { useTournamentWizard } from "../context";
import { ReviewBlock } from "../components/review-block";

export function ReviewStep() {
  const {
    meta: { previewName, previewTag },
    state: { emailVerified, form, smsVerified },
  } = useTournamentWizard();

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <ReviewBlock
        icon={User}
        label="Trader"
        value={form.fullName || "Sin nombre"}
        detail={form.email || "Sin email"}
      />
      <ReviewBlock
        icon={ShieldCheck}
        label="Verificacion"
        value={emailVerified && smsVerified ? "Completa" : "Pendiente"}
        detail="Codigo mock: 123456"
      />
      <ReviewBlock
        icon={Swords}
        label="Clan"
        value={`[${previewTag}] ${previewName}`}
        detail={form.clanPublic ? "Publico" : "Privado"}
      />
    </div>
  );
}
