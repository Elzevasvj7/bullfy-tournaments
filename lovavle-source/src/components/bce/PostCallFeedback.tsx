import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, TrendingUp, ArrowRight } from "lucide-react";

interface Props {
  objeccionesDetectadas: string[];
  respuestasUsadas: number;
  objecionesManejadas: number;
  probability: number;
  temperature: string;
  onClose: () => void;
}

const PostCallFeedback = ({
  objeccionesDetectadas, respuestasUsadas, objecionesManejadas,
  probability, temperature, onClose,
}: Props) => {
  const score = Math.round(probability * 0.5 + objecionesManejadas * 10 + respuestasUsadas * 2);
  const tips: string[] = [];

  if (objeccionesDetectadas.length > 3) tips.push("Muchas objeciones detectadas. Considera calificar mejor al lead antes de la presentación.");
  if (probability < 40) tips.push("Probabilidad baja. Enfócate más en generar confianza y rapport antes de presentar.");
  if (respuestasUsadas < 3) tips.push("Pocas respuestas usadas. Utiliza más el guión para mantener estructura.");
  if (objecionesManejadas === 0) tips.push("No manejaste objeciones. Practica anticipar y abordar objeciones proactivamente.");
  if (temperature === "frio") tips.push("Lead frío. Considera más preguntas de diagnóstico para calentar la conversación.");
  if (tips.length === 0) tips.push("¡Buen trabajo! Sigue practicando para mejorar tu tasa de cierre.");

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-bold text-foreground">📊 Feedback Post-Llamada</h3>
        <p className="text-sm text-muted-foreground">Resumen de tu desempeño</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="py-4 text-center">
          <p className="text-2xl font-bold text-foreground">{score}</p>
          <p className="text-xs text-muted-foreground">Score</p>
        </CardContent></Card>
        <Card><CardContent className="py-4 text-center">
          <p className="text-2xl font-bold text-foreground">{probability}%</p>
          <p className="text-xs text-muted-foreground">Prob. Cierre</p>
        </CardContent></Card>
        <Card><CardContent className="py-4 text-center">
          <p className="text-2xl font-bold text-foreground">{objecionesManejadas}</p>
          <p className="text-xs text-muted-foreground">Objeciones manejadas</p>
        </CardContent></Card>
        <Card><CardContent className="py-4 text-center">
          <p className="text-2xl font-bold text-foreground">{respuestasUsadas}</p>
          <p className="text-xs text-muted-foreground">Scripts usados</p>
        </CardContent></Card>
      </div>

      {objeccionesDetectadas.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Objeciones detectadas</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {objeccionesDetectadas.map((o, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{o}</Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-primary" /> Recomendaciones de mejora
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <ArrowRight className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
              <span className="text-muted-foreground">{tip}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="text-center">
        <Button onClick={onClose} size="lg">Volver al Inicio</Button>
      </div>
    </div>
  );
};

export default PostCallFeedback;
