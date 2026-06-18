import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, User, Sparkles, Loader2, RotateCcw } from "lucide-react";
import { useExperienceStore } from "@/stores/experienceStore";
import { useExperienceSession } from "@/hooks/useExperienceSession";
import ToolNavButtons from "@/components/experience/ToolNavButtons";
import ReactMarkdown from "react-markdown";
import { toast } from "@/lib/toastUtils";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTED_QUESTIONS = [
  "¿Cuál es el mejor modelo de negocio para empezar como IB?",
  "¿Cuánto puedo ganar con 50 clientes activos?",
  "¿Qué ventajas tiene Bullfy sobre otros brokers?",
  "¿Cómo funciona el modelo híbrido CPA + Rebates?",
  "¿Me conviene tener Sub IBs bajo mi estructura?",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-ib-advisor`;

const AIAdvisor = () => {
  const { sessionId } = useExperienceSession();
  const { level, opportunityScore, toolsUsed, simulationsCount, badges, addToolUsed, incrementSimulations } = useExperienceStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsStreaming(true);

    // Track tool usage on first message
    if (messages.length === 0) {
      addToolUsed("advisor");
      incrementSimulations();
    }

    let assistantSoFar = "";

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages.map(m => ({ role: m.role, content: m.content })),
          context: { level, opportunityScore, toolsUsed, simulationsCount, badges },
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(errData.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      console.error("AI Advisor error:", e);
      const errMsg = e instanceof Error ? e.message : "Error desconocido";
      toast.error(errMsg);
      // Remove the empty assistant message if nothing was streamed
      if (!assistantSoFar) {
        setMessages(prev => prev.filter((_, i) => i < prev.length || prev[prev.length - 1]?.role !== "assistant"));
      }
    } finally {
      setIsStreaming(false);
    }
  }, [messages, isStreaming, level, opportunityScore, toolsUsed, simulationsCount, badges, addToolUsed, incrementSimulations]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleReset = () => {
    setMessages([]);
    setInput("");
  };

  return (
    <div className="space-y-6">
      <ToolNavButtons />

      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
          <Bot className="w-5 h-5 text-primary" />
          <span className="text-sm font-semibold text-primary">AI IB Advisor</span>
          <Sparkles className="w-4 h-4 text-accent" />
        </div>
        <h1 className="text-3xl font-bold">Tu Asesor IB con Inteligencia Artificial</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Pregúntame sobre modelos de negocio, proyecciones de ingresos, estrategias de crecimiento, o cualquier duda sobre ser IB en Bullfy.
        </p>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          {/* Chat messages */}
          <ScrollArea ref={scrollRef} className="h-[450px] p-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-6 py-8">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Bot className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-lg font-semibold">¡Hola! Soy tu Bullfy IB Advisor 🐂</p>
                  <p className="text-sm text-muted-foreground">Pregúntame lo que quieras o elige una de estas opciones:</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      className="px-3 py-2 text-xs rounded-lg border border-border bg-secondary/50 text-secondary-foreground hover:bg-secondary hover:border-primary/30 transition-all text-left"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mt-1">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-xl px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary/50 border border-border/50"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-0.5 [&_strong]:text-accent [&_h2]:text-base [&_h3]:text-sm [&_a]:text-primary">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                          {isStreaming && i === messages.length - 1 && (
                            <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5" />
                          )}
                        </div>
                      ) : (
                        <p className="text-sm">{msg.content}</p>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center mt-1">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Input area */}
          <div className="border-t border-border p-4 bg-card/80">
            <form onSubmit={handleSubmit} className="flex gap-2">
              {messages.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleReset}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  title="Nueva conversación"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu pregunta sobre el negocio IB..."
                disabled={isStreaming}
                className="flex-1 bg-secondary/50 border-border"
              />
              <Button
                type="submit"
                disabled={!input.trim() || isStreaming}
                className="shrink-0 bg-gradient-brand shadow-brand"
              >
                {isStreaming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIAdvisor;
