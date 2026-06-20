import type { Metadata } from "next";
import { TournamentRegisterWizard } from "@/modules/auth/components/tournament-register-wizard";

export const metadata: Metadata = {
  title: "Registro Multi-step VIP | Bullfy",
  description:
    "Crea tu usuario Bullfy y funda tu clan en un flujo privado para torneos VIP.",
};

export default function RegisterTournamentSignupPage() {
  return <TournamentRegisterWizard />;
}
