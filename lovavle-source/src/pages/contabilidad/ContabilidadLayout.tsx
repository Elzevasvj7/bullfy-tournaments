import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { ArrowLeft, LogOut, LayoutGrid } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export default function ContabilidadLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/contabilidad" || location.pathname === "/contabilidad/";

  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <header className="h-14 border-b flex items-center justify-between px-4 gap-2 bg-card/40 backdrop-blur">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Bullfy
          </Button>
          {!isHome && (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/contabilidad">
                <LayoutGrid className="h-4 w-4 mr-1" /> Contabilidad
              </Link>
            </Button>
          )}
          <h1 className="font-semibold text-lg ml-1">
            {isHome ? "Contabilidad" : ""}
          </h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground hidden md:inline">{profile?.nombre}</span>
          <Button variant="ghost" size="icon" onClick={signOut} title="Salir">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
