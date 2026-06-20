import type { Metadata } from "next";
import { TournamentVipLanding } from "@/modules/auth/components/tournament-vip-landing";

export const metadata: Metadata = {
  title: "Registro VIP de Torneo | Bullfy",
  description:
    "Landing privada para traders VIP: registro multi-step, verificacion y creacion de clan para torneos Bullfy.",
};

export default function RegisterTournamentPage() {
  return <TournamentVipLanding />;
}
