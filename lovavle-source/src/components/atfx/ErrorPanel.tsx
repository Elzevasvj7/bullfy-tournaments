import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  title?: string;
  message: string;
  raw?: any;
  onRetry?: () => void;
}

export default function ErrorPanel({ title = "Endpoint no disponible", message, raw, onRetry }: Props) {
  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardContent className="p-6 space-y-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-sm">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
            {raw && (
              <details className="mt-2">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Ver respuesta cruda</summary>
                <pre className="mt-2 text-xs bg-muted/50 p-2 rounded overflow-auto max-h-48">{JSON.stringify(raw, null, 2)}</pre>
              </details>
            )}
          </div>
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" />Reintentar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
