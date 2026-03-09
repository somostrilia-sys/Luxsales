import { useState, useRef, useEffect } from "react";
import { Send, Mic, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/DashboardLayout";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  time: string;
}

const initialMessages: Message[] = [
  { id: "1", text: "Olá! Sou seu assistente de prospecção. Como posso te ajudar hoje?", sender: "bot", time: "08:00" },
  { id: "2", text: "Prospecta 50 leads na minha região", sender: "user", time: "08:01" },
  { id: "3", text: "Iniciando prospecção de 50 leads em Belo Horizonte... 🔍\n\nVou filtrar por:\n• Região: Belo Horizonte e RMBH\n• Perfil: Proprietários de veículos\n• Score mínimo: 7/10\n\nTempo estimado: 15 minutos. Te aviso quando terminar!", sender: "bot", time: "08:01" },
  { id: "4", text: "Perfeito! Me avisa quando terminar", sender: "user", time: "08:02" },
  { id: "5", text: "✅ Prospecção concluída!\n\n📊 Resultados:\n• 50 leads encontrados\n• 32 com score alto (8+)\n• 18 com score médio (7)\n• 12 já receberam mensagem\n\nQuer que eu inicie o envio para os demais?", sender: "bot", time: "08:17" },
];

const botResponses: Record<string, string> = {
  "status": "📊 Status atual:\n• Prospecção: Ativa\n• Mensagens enviadas hoje: 48\n• Respostas: 12\n• Leads quentes: 5\n• Taxa de resposta: 25%",
  "leads": "🔥 Seus 5 leads mais quentes:\n1. Juliana Costa - Score 9.5\n2. Luciana Ferreira - Score 9.2\n3. Roberto Oliveira - Score 8.8\n4. Carla Ribeiro - Score 8.5\n5. Renata Souza - Score 8.1",
  "meta": "🎯 Suas metas do mês:\n• Prospecções: 1.200/1.500 (80%)\n• Conversões: 23/30 (77%)\n• Faturamento: R$18.400/R$25.000 (74%)\n\nVocê está no caminho certo! 💪",
};

function getBotResponse(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("status")) return botResponses["status"];
  if (lower.includes("lead")) return botResponses["leads"];
  if (lower.includes("meta")) return botResponses["meta"];
  if (lower.includes("prospecta") || lower.includes("prospecção")) {
    const match = lower.match(/(\d+)/);
    const num = match ? match[1] : "30";
    return `🔍 Iniciando prospecção de ${num} leads na sua região...\n\nFiltrando perfis qualificados. Tempo estimado: ${Math.ceil(parseInt(num) / 3)} minutos.`;
  }
  return "Entendi! Posso te ajudar com:\n• \"status\" - Ver métricas atuais\n• \"leads quentes\" - Top leads\n• \"meta\" - Acompanhar metas\n• \"prospecta X leads\" - Iniciar prospecção";
}

export default function MeuBot() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const userMsg: Message = { id: `u-${Date.now()}`, text: input, sender: "user", time };
    setMessages(prev => [...prev, userMsg]);
    const userInput = input;
    setInput("");

    setTimeout(() => {
      const botMsg: Message = { id: `b-${Date.now()}`, text: getBotResponse(userInput), sender: "bot", time };
      setMessages(prev => [...prev, botMsg]);
    }, 800);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-5.5rem)] animate-fade-in">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Meu Bot</h1>
          <p className="text-muted-foreground text-sm">Converse com seu assistente de prospecção</p>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-auto rounded-xl border bg-card/80 backdrop-blur-sm p-4 space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`flex gap-2 max-w-[75%] ${msg.sender === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.sender === "bot" ? "bg-primary/10 text-primary" : "bg-gradient-to-br from-[hsl(var(--kpi-from))] to-[hsl(var(--kpi-to))] text-primary-foreground"}`}>
                  {msg.sender === "bot" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>
                <div className={`rounded-2xl px-4 py-2.5 text-sm ${msg.sender === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md"}`}>
                  <p className="whitespace-pre-line">{msg.text}</p>
                  <p className={`text-[10px] mt-1 ${msg.sender === "user" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>{msg.time}</p>
                </div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 mt-3">
          <Button variant="outline" size="icon" className="shrink-0">
            <Mic className="h-4 w-4" />
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Digite sua mensagem..."
            className="flex-1"
          />
          <Button className="btn-shimmer shrink-0" onClick={sendMessage}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
