import type { TournamentWizardFormState, TournamentWizardStep } from "./types";

export const WHITE_LOGO_FILTER = "brightness(0) invert(1)";

export const INITIAL_TOURNAMENT_WIZARD_FORM: TournamentWizardFormState = {
  fullName: "",
  email: "",
  phone: "",
  country: "VE",
  password: "",
  referredByCode: "",
  emailCode: "",
  smsCode: "",
  clanName: "",
  clanTag: "",
  clanDescription: "",
  clanPublic: true,
};

export const TOURNAMENT_WIZARD_STEPS: TournamentWizardStep[] = [
  { id: "identity", label: "Identidad", title: "Datos del trader" },
  { id: "verify", label: "Verificacion", title: "Validar acceso" },
  { id: "clan", label: "Clan", title: "Fundar clan" },
  { id: "review", label: "Final", title: "Confirmar entrada" },
];
