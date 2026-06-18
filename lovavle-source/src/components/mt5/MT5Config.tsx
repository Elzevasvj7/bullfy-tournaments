import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useMT5Connection } from "@/hooks/useMT5Connection";
import { mt5Login, mt5Logout } from "@/services/mt5Api";
import { Settings, Plug, Unplug, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "@/lib/toastUtils";

const MT5Config = () => {
  const { connected, refresh, disconnect } = useMT5Connection();
  const [username, setUsername] = useState("superadmin");
  const [password, setPassword] = useState("Bull$ecure2024!");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (!username || !password) {
      toast.error("Completa usuario y contraseña");
      return;
    }
    setLoading(true);
    try {
      await mt5Login(username, password);
      refresh();
      toast.success("Conectado a MT5 exitosamente");
      setUsername("");
      setPassword("");
    } catch (err) {
      toast.error((err as Error).message || "Error al conectar");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await mt5Logout();
      disconnect();
      toast.success("Desconectado de MT5");
    } catch {
      disconnect();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      {/* Estado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Estado de Conexión
          </CardTitle>
          <CardDescription>API: api.bullfytech.online</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Badge variant={connected ? "default" : "destructive"} className="text-sm">
            {connected ? "Conectado" : "Desconectado"}
          </Badge>
          {connected && (
            <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Unplug className="w-4 h-4 mr-1" />}
              Desconectar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Login Form */}
      {!connected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plug className="w-5 h-5 text-primary" />
              Conectar a MT5
            </CardTitle>
            <CardDescription>Ingresa tus credenciales de la API de MT5</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mt5-user">Usuario</Label>
              <Input
                id="mt5-user"
                placeholder="Usuario MT5"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mt5-pass">Contraseña</Label>
              <div className="relative">
                <Input
                  id="mt5-pass"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button onClick={handleConnect} disabled={loading} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plug className="w-4 h-4 mr-2" />}
              Conectar
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MT5Config;
