import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTournamentAuth } from "@/hooks/useTournamentAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  MOCK_AUTH_ENABLED,
  MOCK_TOURNAMENT_TOKEN,
  mockTournamentUser,
} from "@/lib/mockAuth";

export default function TournamentLogin() {
  const { setSession } = useTournamentAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("tournament-auth-login", {
        body: { email: email.trim(), password },
      });
      if (error || !data?.ok) {
        toast.error(data?.error || error?.message || "Error al ingresar");
        return;
      }
      setSession(data.token, data.user);
      toast.success(`¡Bienvenido, ${data.user.full_name}!`);
      nav("/tournament/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const enterMockTournament = () => {
    setSession(MOCK_TOURNAMENT_TOKEN, mockTournamentUser);
    toast.success(`Modo mock: ${mockTournamentUser.full_name}`);
    nav("/tournament/dashboard");
  };

  return (
    <div className="max-w-md mx-auto pt-8">
      <Card>
        <CardHeader>
          <CardTitle>Ingresar a Bullfy Tournament</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Contraseña</Label>
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Ingresando..." : "Ingresar"}
            </Button>
            {MOCK_AUTH_ENABLED ? (
              <Button
                type="button"
                className="w-full"
                variant="outline"
                onClick={enterMockTournament}
              >
                Entrar como trader mock
              </Button>
            ) : null}
            <p className="text-sm text-center text-muted-foreground">
              ¿Sin cuenta? <Link to="/tournament/register" className="text-primary">Registrarme</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
