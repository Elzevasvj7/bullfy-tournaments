import { useATFX } from "@/hooks/useATFX";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import GenericListReport from "../GenericListReport";
import RawApiExplorer from "./RawApiExplorer";
import ErrorPanel from "../ErrorPanel";

function ConnectionTest() {
  const q = useATFX("test_connection", undefined, { staleTime: 10_000 });
  const connected = q.data?.connected;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Test de conexión ATFX</CardTitle>
        <Button size="sm" variant="outline" onClick={() => q.refetch()}><RefreshCw className="w-3.5 h-3.5 mr-1" />Reintentar</Button>
      </CardHeader>
      <CardContent>
        {q.isLoading && <p className="text-sm text-muted-foreground">Probando conexión...</p>}
        {!q.isLoading && connected && (
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="w-5 h-5" />
            <div>
              <p className="font-medium text-sm">Conexión exitosa (HTTP {q.data?.status})</p>
              <p className="text-xs text-muted-foreground mt-1">URL: {q.data?.url as string}</p>
            </div>
          </div>
        )}
        {!q.isLoading && !connected && (
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="w-5 h-5" />
            <div>
              <p className="font-medium text-sm">Sin conexión</p>
              <p className="text-xs text-muted-foreground">{q.data?.error ?? `HTTP ${q.data?.status}`}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SystemReportRouter({ report }: { report: string }) {
  if (report === "test") return <ConnectionTest />;
  if (report === "adapters") return <GenericListReport action="list_adapters" columns={[
    { key: "id", label: "ID" }, { key: "name", label: "Adapter" }, { key: "type", label: "Tipo" }, { key: "status", label: "Status" },
  ]} />;
  if (report === "groups") return <GenericListReport action="list_trading_groups" columns={[
    { key: "id", label: "ID" }, { key: "name", label: "Grupo" }, { key: "leverage", label: "Leverage" }, { key: "currency", label: "Moneda" },
  ]} />;
  if (report === "webhooks") return <GenericListReport action="list_webhooks" columns={[
    { key: "id", label: "ID" }, { key: "event", label: "Evento" }, { key: "url", label: "URL" }, { key: "status", label: "Status" },
  ]} />;
  if (report === "audit") return <GenericListReport action="audit_log" columns={[
    { key: "created_at", label: "Fecha" }, { key: "user", label: "Usuario" },
    { key: "action", label: "Acción" }, { key: "resource", label: "Recurso" },
  ]} />;
  if (report === "raw") return <RawApiExplorer />;

  return <ErrorPanel message={`Reporte sistema/${report} no implementado`} />;
}
