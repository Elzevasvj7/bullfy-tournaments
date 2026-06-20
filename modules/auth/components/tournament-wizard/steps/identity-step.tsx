import { Mail, Phone, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTournamentWizard } from "../context";
import { Field } from "../components/field";

export function IdentityStep() {
  const {
    actions: { updateEmail, updateForm, updatePhone },
    state: { form },
  } = useTournamentWizard();

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Nombre completo" htmlFor="fullName" icon={User}>
          <Input
            id="fullName"
            value={form.fullName}
            onChange={(event) => updateForm("fullName", event.target.value)}
            placeholder="Karlos Guzman"
            required
            className="h-12 border-white/10 bg-black/25 pl-10 text-white placeholder:text-slate-600"
          />
        </Field>
        <Field label="Email" htmlFor="email" icon={Mail}>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(event) => updateEmail(event.target.value)}
            placeholder="trader@bullfy.com"
            required
            className="h-12 border-white/10 bg-black/25 pl-10 text-white placeholder:text-slate-600"
          />
        </Field>
      </div>
      <div className="grid gap-5 md:grid-cols-[1fr_10rem_1fr]">
        <Field label="Telefono" htmlFor="phone" icon={Phone}>
          <Input
            id="phone"
            value={form.phone}
            onChange={(event) => updatePhone(event.target.value)}
            placeholder="+584121234567"
            required
            className="h-12 border-white/10 bg-black/25 pl-10 text-white placeholder:text-slate-600"
          />
        </Field>
        <Field label="Pais" htmlFor="country">
          <Input
            id="country"
            value={form.country}
            onChange={(event) =>
              updateForm("country", event.target.value.toUpperCase())
            }
            maxLength={2}
            placeholder="VE"
            className="h-12 border-white/10 bg-black/25 text-white placeholder:text-slate-600"
          />
        </Field>
        <Field label="Codigo referido" htmlFor="referredByCode">
          <Input
            id="referredByCode"
            value={form.referredByCode}
            onChange={(event) =>
              updateForm("referredByCode", event.target.value)
            }
            placeholder="Opcional"
            className="h-12 border-white/10 bg-black/25 text-white placeholder:text-slate-600"
          />
        </Field>
      </div>
      <Field label="Contrasena" htmlFor="password">
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={(event) => updateForm("password", event.target.value)}
          placeholder="Minimo 8 caracteres"
          required
          className="h-12 border-white/10 bg-black/25 text-white placeholder:text-slate-600"
        />
      </Field>
    </div>
  );
}
