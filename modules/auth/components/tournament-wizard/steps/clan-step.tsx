import { Eye, Lock, Swords, UsersRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useTournamentWizard } from "../context";
import { Field } from "../components/field";

export function ClanStep() {
  const {
    actions: { updateForm },
    state: { form },
  } = useTournamentWizard();

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 md:grid-cols-[1fr_12rem]">
        <Field label="Nombre del clan" htmlFor="clanName" icon={UsersRound}>
          <Input
            id="clanName"
            value={form.clanName}
            onChange={(event) => updateForm("clanName", event.target.value)}
            maxLength={32}
            placeholder="Bullfy Syndicate"
            required
            className="h-12 border-white/10 bg-black/25 pl-10 text-white placeholder:text-slate-600"
          />
        </Field>
        <Field label="Tag" htmlFor="clanTag" icon={Swords}>
          <Input
            id="clanTag"
            value={form.clanTag}
            onChange={(event) =>
              updateForm(
                "clanTag",
                event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
              )
            }
            maxLength={6}
            placeholder="BULL"
            required
            className="h-12 border-white/10 bg-black/25 pl-10 font-mono text-white placeholder:text-slate-600"
          />
        </Field>
      </div>
      <Field label="Manifiesto del clan" htmlFor="clanDescription">
        <Textarea
          id="clanDescription"
          value={form.clanDescription}
          onChange={(event) =>
            updateForm("clanDescription", event.target.value)
          }
          placeholder="Describe el estilo competitivo, reglas y personalidad del clan."
          required
          className="min-h-36 border-white/10 bg-black/25 text-white placeholder:text-slate-600"
        />
      </Field>
      <div className="flex items-center justify-between gap-4 border border-white/10 bg-black/25 p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center border border-[#00E5FF]/35 bg-[#00E5FF]/10 text-[#00E5FF]">
            {form.clanPublic ? (
              <Eye className="size-5" />
            ) : (
              <Lock className="size-5" />
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              Clan {form.clanPublic ? "publico" : "privado"}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {form.clanPublic
                ? "Visible en ranking y busqueda."
                : "Acceso solo por invitacion."}
            </p>
          </div>
        </div>
        <Switch
          checked={form.clanPublic}
          onCheckedChange={(value) => updateForm("clanPublic", value)}
        />
      </div>
    </div>
  );
}
