import { useState } from "react";
import { MessageSquare, Bot, User, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/DashboardLayout";

interface Conversation {
  id: string;
  nome: string;
  avatar: string;
  ultimaMensagem: string;
  hora: string;
  naoLidas: number;
  gerenciadoPor: "bot" | "consultor";
  mensagens: { text: string; sender: "lead" | "bot" | "consultor"; time: string }[];
}

const mockConversas: Conversation[] = [
  {
    id: "c1", nome: "Roberto Oliveira", avatar: "RO", ultimaMensagem: "Quero saber mais sobre proteção veicular", hora: "09:32", naoLidas: 2, gerenciadoPor: "bot",
    mensagens: [
      { text: "Olá Roberto! Tudo bem? Sou da Objetivo Proteção Veicular 🛡️", sender: "bot", time: "09:28" },
      { text: "Oi! Tudo sim", sender: "lead", time: "09:30" },
      { text: "Temos planos a partir de R$89,90/mês com cobertura completa. Posso te enviar uma cotação?", sender: "bot", time: "09:30" },
      { text: "Quero saber mais sobre proteção veicular", sender: "lead", time: "09:32" },
    ],
  },
  {
    id: "c2", nome: "Juliana Costa", avatar: "JC", ultimaMensagem: "Qual o valor mensal?", hora: "08:40", naoLidas: 1, gerenciadoPor: "bot",
    mensagens: [
      { text: "Boa tarde Juliana! Vi que você demonstrou interesse em proteção veicular 😊", sender: "bot", time: "08:35" },
      { text: "Sim! Qual o valor mensal?", sender: "lead", time: "08:40" },
    ],
  },
  {
    id: "c3", nome: "Carla Ribeiro", avatar: "CR", ultimaMensagem: "Interessante! Me conta mais", hora: "08:10", naoLidas: 0, gerenciadoPor: "consultor",
    mensagens: [
      { text: "Oi Carla! Vi seu interesse pelo nosso serviço!", sender: "bot", time: "07:55" },
      { text: "Interessante! Me conta mais", sender: "lead", time: "08:10" },
      { text: "Carla, aqui é o Alex! Vou te explicar tudo pessoalmente 😊", sender: "consultor", time: "08:15" },
    ],
  },
  {
    id: "c4", nome: "Márcia Santos", avatar: "MS", ultimaMensagem: "Pode me ligar amanhã?", hora: "09:15", naoLidas: 1, gerenciadoPor: "bot",
    mensagens: [
      { text: "Olá Márcia! Temos uma oferta especial este mês 🎉", sender: "bot", time: "09:10" },
      { text: "Pode me ligar amanhã?", sender: "lead", time: "09:15" },
    ],
  },
  {
    id: "c5", nome: "Renata Souza", avatar: "RS", ultimaMensagem: "Qual a diferença para o seguro?", hora: "07:10", naoLidas: 0, gerenciadoPor: "bot",
    mensagens: [
      { text: "Bom dia Renata! Tudo bem?", sender: "bot", time: "07:00" },
      { text: "Bom dia! Tudo sim", sender: "lead", time: "07:05" },
      { text: "Ótimo! Gostaria de conhecer nossos planos de proteção veicular?", sender: "bot", time: "07:05" },
      { text: "Qual a diferença para o seguro?", sender: "lead", time: "07:10" },
    ],
  },
];

export default function Conversas() {
  const [selected, setSelected] = useState<string | null>(null);
  const [conversas, setConversas] = useState(mockConversas);

  const conversa = conversas.find(c => c.id === selected);

  const toggleGerenciamento = (id: string) => {
    setConversas(prev => prev.map(c => c.id === id ? { ...c, gerenciadoPor: c.gerenciadoPor === "bot" ? "consultor" as const : "bot" as const } : c));
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-5.5rem)] gap-4 animate-fade-in">
        {/* Lista */}
        <div className={`${selected ? "hidden lg:flex" : "flex"} flex-col w-full lg:w-96 border rounded-xl bg-card/80 backdrop-blur-sm overflow-hidden`}>
          <div className="p-4 border-b">
            <h1 className="text-lg font-bold">Conversas</h1>
            <p className="text-xs text-muted-foreground">{conversas.length} conversas ativas</p>
          </div>
          <div className="flex-1 overflow-auto">
            {conversas.map((c) => (
              <button key={c.id} onClick={() => setSelected(c.id)} className={`w-full flex items-center gap-3 p-3 text-left table-row-hover border-b border-border/50 ${selected === c.id ? "bg-primary/5" : ""}`}>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[hsl(var(--kpi-from))] to-[hsl(var(--kpi-to))] flex items-center justify-center text-primary-foreground font-semibold text-sm shrink-0">
                  {c.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className="font-medium text-sm truncate">{c.nome}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{c.hora}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{c.ultimaMensagem}</p>
                </div>
                {c.naoLidas > 0 && (
                  <Badge className="bg-primary text-primary-foreground text-[10px] h-5 w-5 flex items-center justify-center p-0 rounded-full">{c.naoLidas}</Badge>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Chat */}
        {conversa ? (
          <div className="flex-1 flex flex-col border rounded-xl bg-card/80 backdrop-blur-sm overflow-hidden">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSelected(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[hsl(var(--kpi-from))] to-[hsl(var(--kpi-to))] flex items-center justify-center text-primary-foreground font-semibold text-xs">
                  {conversa.avatar}
                </div>
                <div>
                  <p className="font-medium text-sm">{conversa.nome}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Gerenciado por: {conversa.gerenciadoPor === "bot" ? "🤖 Bot" : "👤 Você"}
                  </p>
                </div>
              </div>
              <Button variant={conversa.gerenciadoPor === "bot" ? "default" : "outline"} size="sm" className="btn-shimmer text-xs" onClick={() => toggleGerenciamento(conversa.id)}>
                {conversa.gerenciadoPor === "bot" ? "Assumir Conversa" : "Deixar com Bot"}
              </Button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {conversa.mensagens.map((msg, i) => (
                <div key={i} className={`flex ${msg.sender === "lead" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.sender === "lead" ? "bg-muted rounded-bl-md" :
                    msg.sender === "bot" ? "bg-primary/80 text-primary-foreground rounded-br-md" :
                    "bg-primary text-primary-foreground rounded-br-md"
                  }`}>
                    {msg.sender !== "lead" && (
                      <p className="text-[10px] font-medium mb-0.5 opacity-70">{msg.sender === "bot" ? "🤖 Bot" : "👤 Você"}</p>
                    )}
                    <p>{msg.text}</p>
                    <p className={`text-[10px] mt-1 ${msg.sender === "lead" ? "text-muted-foreground" : "opacity-60"}`}>{msg.time}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 border-t flex gap-2">
              <Input placeholder="Digite sua mensagem..." className="flex-1" />
              <Button className="btn-shimmer"><MessageSquare className="h-4 w-4" /></Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 hidden lg:flex items-center justify-center border rounded-xl bg-card/80 backdrop-blur-sm">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Selecione uma conversa</p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
