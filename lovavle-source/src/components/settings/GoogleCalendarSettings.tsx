import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Calendar, Loader2, Plus, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Connection {
  id: string;
  google_email: string;
  account_type: string;
  active: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
}

export default function GoogleCalendarSettings() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchConnections = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("google_calendar_connections")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    setConnections(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchConnections();
    // Detect callback redirect
    const params = new URLSearchParams(window.location.search);
    const status = params.get("google_calendar");
    if (status === "connected") {
      toast({ title: "✅ Google Calendar conectado", description: "Tu cuenta fue vinculada correctamente." });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (status === "error") {
      toast({ title: "Error al conectar", description: "Intenta de nuevo.", variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-oauth-init", {
        body: { return_to: "/settings", account_type: "internal" },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No se pudo generar URL de autorización");
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setConnecting(false);
    }
  };

  const toggleActive = async (conn: Connection) => {
    setBusyId(conn.id);
    const { error } = await supabase
      .from("google_calendar_connections")
      .update({ active: !conn.active })
      .eq("id", conn.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: conn.active ? "Sincronización pausada" : "Sincronización activada" });
      await fetchConnections();
    }
    setBusyId(null);
  };

  const handleDisconnect = async (conn: Connection) => {
    if (!confirm(`¿Desconectar ${conn.google_email}? Los eventos creados seguirán en tu calendario, pero no se sincronizarán cambios futuros.`)) return;
    setBusyId(conn.id);
    const { error } = await supabase.from("google_calendar_connections").delete().eq("id", conn.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Cuenta desconectada" });
      await fetchConnections();
    }
    setBusyId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" /> Google Calendar
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Conecta tu cuenta de Google para recibir automáticamente en tu calendario los Bullfy Live de Family,
            las tareas de campañas asignadas y los eventos del sistema. Tus eventos personales no se leen.
          </p>
        </div>
        <Button onClick={handleConnect} disabled={connecting} className="gap-2 shrink-0">
          {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Conectar cuenta
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
        </div>
      ) : connections.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Calendar className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Aún no tienes ninguna cuenta de Google conectada.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Mientras tanto recibirás los eventos por email como archivo <code className="px-1 py-0.5 bg-muted rounded">.ics</code> que puedes agregar a cualquier calendario con un clic.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="flex items-center justify-between gap-4 p-4 rounded-lg border border-border bg-card"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground truncate">{conn.google_email}</span>
                    {conn.active ? (
                      <Badge variant="default" className="gap-1 text-xs">
                        <CheckCircle2 className="w-3 h-3" /> Activo
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Pausado</Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {conn.account_type === "ib_externo" ? "IB Externo" : "Interno"}
                    </Badge>
                  </div>
                  {conn.last_error ? (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {conn.last_error}
                    </p>
                  ) : conn.last_sync_at ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Última sincronización: {new Date(conn.last_sync_at).toLocaleString("es-CO")}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">Sin sincronizaciones aún</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={conn.active}
                  onCheckedChange={() => toggleActive(conn)}
                  disabled={busyId === conn.id}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDisconnect(conn)}
                  disabled={busyId === conn.id}
                  className="text-muted-foreground hover:text-destructive"
                >
                  {busyId === conn.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground space-y-1.5">
        <p className="font-semibold text-foreground">¿Qué permisos pide Google?</p>
        <p>• Solo permiso para <strong>crear, editar y borrar eventos creados por Bullfy</strong> (scope <code className="px-1 py-0.5 bg-background rounded">calendar.events</code>).</p>
        <p>• Bullfy <strong>NO</strong> puede leer tus eventos personales, ni acceder a Gmail, Drive u otros servicios.</p>
        <p>• Puedes revocar el acceso en cualquier momento desde aquí o desde <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="underline">myaccount.google.com/permissions</a>.</p>
      </div>
    </div>
  );
}
