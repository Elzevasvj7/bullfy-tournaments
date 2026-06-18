import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Radio, Users, Heart, GraduationCap, Lock } from "lucide-react";
import { useLiveFeatureAccessBulk, type LiveFeatureKey } from "@/hooks/useLiveFeatureAccess";

const FEATURE_KEYS: LiveFeatureKey[] = ["meeting_mode", "webinar_pro_controls", "bullfy_family_mode"];

export type RoomTypeChoice = "broadcast" | "meeting" | "bullfy_family" | "webinar_pro";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (type: RoomTypeChoice) => void;
}

const RoomTypeSelectorDialog = ({ open, onOpenChange, onSelect }: Props) => {
  const access = useLiveFeatureAccessBulk(FEATURE_KEYS);

  const cards: {
    key: RoomTypeChoice;
    title: string;
    desc: string;
    icon: typeof Radio;
    accent: string;
    locked?: boolean;
  }[] = [
    {
      key: "broadcast",
      title: "Stream",
      desc: "Transmisión 1→N para captar leads. Sala de espera, OTP, co-host, IA.",
      icon: Radio,
      accent: "from-rose-500/20 to-rose-500/5 border-rose-500/30 hover:border-rose-500/60",
    },
    {
      key: "meeting",
      title: "Meeting",
      desc: "Reunión interactiva. Programa la sesión, comparte el link, aprueba a los asistentes.",
      icon: Users,
      accent: "from-blue-500/20 to-blue-500/5 border-blue-500/30 hover:border-blue-500/60",
      locked: !access?.meeting_mode,
    },
    {
      key: "bullfy_family",
      title: "Bullfy Family",
      desc: "Reunión privada para miembros con rol Bullfy Family. Acceso directo + invitados externos.",
      icon: Heart,
      accent: "from-violet-500/20 to-violet-500/5 border-violet-500/30 hover:border-violet-500/60",
      locked: !access?.bullfy_family_mode,
    },
    {
      key: "webinar_pro",
      title: "Webinar Pro",
      desc: "Webinar profesional con sub-salas (breakouts) y controles avanzados.",
      icon: GraduationCap,
      accent: "from-amber-500/20 to-amber-500/5 border-amber-500/30 hover:border-amber-500/60",
      locked: !access?.webinar_pro_controls,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl">¿Qué tipo de sala quieres crear?</DialogTitle>
          <DialogDescription>
            Cada modo tiene un flujo y herramientas diferentes. Elige la que mejor se adapte.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {cards.map(({ key, title, desc, icon: Icon, accent, locked }) => (
            <button
              key={key}
              type="button"
              disabled={locked}
              onClick={() => {
                if (locked) return;
                onSelect(key);
              }}
              className={`group relative text-left rounded-xl border bg-gradient-to-br ${accent} p-5 transition-all ${
                locked
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:scale-[1.02] hover:shadow-lg cursor-pointer"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="size-11 rounded-lg bg-background/60 backdrop-blur flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold text-base">{title}</h3>
                    {locked && <Lock className="w-3 h-3 text-muted-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>
              {locked && (
                <p className="text-[10px] text-muted-foreground mt-3 italic">
                  Sin permiso. Solicítalo a un administrador.
                </p>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RoomTypeSelectorDialog;
