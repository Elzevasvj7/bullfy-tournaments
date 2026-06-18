import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "tournament_session_token";

export default function TournamentImpersonate() {
  const navigate = useNavigate();
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash || window.location.search.replace(/^\?/, ""));
    const token = params.get("token");
    if (token) {
      localStorage.setItem(STORAGE_KEY, token);
      window.location.replace("/tournament/dashboard");
    } else {
      navigate("/tournament/login", { replace: true });
    }
  }, [navigate]);
  return <div className="p-8 text-muted-foreground">Iniciando sesión...</div>;
}
