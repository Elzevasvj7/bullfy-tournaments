import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { Bot, Send, Loader2, Sparkles, CheckCircle, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  saved?: string[];
}

const AITrainer = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "¡Hola! 👋 Soy el entrenador IA del Bullfy Closing Engine.\n\nEstoy aquí para ayudarte a **entrenar el sistema** de forma óptima. Puedo ayudarte a crear:\n\n- 🛡️ **Objeciones** con respuestas lógicas, emocionales, reframes y contra-preguntas\n- 📜 **Scripts** de ventas organizados por fase\n\n¿Qué área te gustaría entrenar hoy?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke("bce-ai-trainer", {
        body: { messages: apiMessages },
      });

      if (error) throw error;

      const assistantMsg: Message = {
        role: "assistant",
        content: data.content || "No pude generar una respuesta.",
        saved: data.saved,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (data.saved?.length > 0) {
        toast({
          title: "✅ Contenido guardado",
          description: `${data.saved.length} elemento(s) guardado(s) en el sistema.`,
        });
      }
    } catch (err: any) {
      console.error(err);
      const errorMsg = err?.message || "Error al comunicarse con el entrenador IA";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ ${errorMsg}` },
      ]);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const resetChat = () => {
    setMessages([
      {
        role: "assistant",
        content: "Chat reiniciado. ¿Qué área te gustaría entrenar?",
      },
    ]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Entrenador IA</span>
          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
            Interactivo
          </Badge>
        </div>
        <Button size="sm" variant="ghost" onClick={resetChat} className="text-muted-foreground">
          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reiniciar
        </Button>
      </div>

      <Card className="border-primary/10 bg-card/80">
        <CardContent className="p-0">
          <ScrollArea className="h-[50vh]" ref={scrollRef}>
            <div className="p-4 space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-foreground"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                    {msg.saved && msg.saved.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
                        {msg.saved.map((s, j) => (
                          <div key={j} className="flex items-start gap-1.5 text-xs">
                            <CheckCircle className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                            <span className="text-primary">{s}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted/50 rounded-xl px-3.5 py-2.5">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t border-border/30 p-3 flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe la objeción, script o situación que quieres entrenar..."
              rows={2}
              className="resize-none text-sm bg-background/50"
              disabled={loading}
            />
            <Button
              size="icon"
              onClick={send}
              disabled={!input.trim() || loading}
              className="shrink-0 self-end"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AITrainer;
