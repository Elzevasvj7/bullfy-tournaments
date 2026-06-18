import { useState } from "react";
import { useATFX } from "@/hooks/useATFX";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Play, Loader2 } from "lucide-react";

export default function RawApiExplorer() {
  const [path, setPath] = useState("/Store/Products");
  const [method, setMethod] = useState<"GET" | "POST">("GET");
  const [bodyText, setBodyText] = useState("");
  const [submittedKey, setSubmittedKey] = useState(0);

  let parsedBody: any = undefined;
  try {
    parsedBody = bodyText.trim() ? JSON.parse(bodyText) : undefined;
  } catch { /* ignore until submit */ }

  const q = useATFX("raw", { path, method, body: parsedBody }, {
    enabled: submittedKey > 0,
    queryKey: ["atfx", "raw", path, method, bodyText, submittedKey] as any,
  } as any);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">🛠️ Raw API Explorer</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-[120px_1fr_120px] gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Método</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Path (ej: /Customers?limit=10)</Label>
              <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/Customers" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">&nbsp;</Label>
              <Button className="w-full" onClick={() => setSubmittedKey(k => k + 1)} disabled={q.isFetching}>
                {q.isFetching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                Ejecutar
              </Button>
            </div>
          </div>
          {method === "POST" && (
            <div className="space-y-1">
              <Label className="text-xs">Body JSON</Label>
              <Textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={5} placeholder='{"key":"value"}' className="font-mono text-xs" />
            </div>
          )}
        </CardContent>
      </Card>

      {q.data && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Respuesta · status {q.data.status} {q.data.ok ? "✅" : "❌"}</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted/30 p-3 rounded overflow-auto max-h-[60vh]">
              {JSON.stringify(q.data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
