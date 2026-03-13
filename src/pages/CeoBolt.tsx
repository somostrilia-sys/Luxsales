import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Crown, Bot, Loader2 } from "lucide-react";
import { ConfigCards } from "@/components/ceo/ConfigCards";

interface AgentDef {
  id: string;
  name: string;
  emoji: string | null;
  active: boolean;
  company_id: string | null;
  company_name?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function CeoBolt() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<AgentDef[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Olá! Sou o Bolt, seu assistente CEO. Como posso ajudar?" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadAgents() {
    const { data } = await supabase
      .from("agent_definitions" as any)
      .select("id, name, emoji, active, company_id");
    if (!data) return;
    const agentList = data as unknown as AgentDef[];
    const companyIds = [...new Set(agentList.filter((a) => a.company_id).map((a) => a.company_id!))];
    let companyMap: Record<string, string> = {};
    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from("companies" as any)
        .select("id, name")
        .in("id", companyIds);
      if (companies) {
        (companies as unknown as { id: string; name: string }[]).forEach(
          (c) => (companyMap[c.id] = c.name)
        );
      }
    }
    setAgents(
      agentList.map((a) => ({
        ...a,
        company_name: a.company_id ? companyMap[a.company_id] || "—" : "—",
      }))
    );
  }

  async function toggleAgent(agent: AgentDef) {
    const newActive = !agent.active;
    await supabase
      .from("agent_definitions" as any)
      .update({ active: newActive } as any)
      .eq("id", agent.id);
    setAgents((prev) =>
      prev.map((a) => (a.id === agent.id ? { ...a, active: newActive } : a))
    );
  }

  async function sendMessage() {
    if (!chatInput.trim() || sending) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setChatInput("");
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("ceo-chat", {
        body: {
          message: userMsg.content,
          history: newMessages.map(({ role, content }) => ({ role, content })),
        },
      });
      if (error || data?.error) {
        toast({ title: "Erro", description: data?.error || error?.message || "Erro ao enviar", variant: "destructive" });
      } else if (data?.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Erro de conexão", variant: "destructive" });
    }
    setSending(false);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Crown className="h-7 w-7 text-yellow-500" />
          <h1 className="text-2xl font-bold text-foreground">CEO / Bolt</h1>
        </div>

        {/* Configurações - 3 cards */}
        <ConfigCards />

        {/* Status dos Agentes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="h-5 w-5 text-muted-foreground" />
              Status dos Agentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum agente encontrado.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{agent.emoji || "🤖"}</span>
                        <span className="font-medium text-foreground truncate">{agent.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{agent.company_name}</p>
                      <Badge variant={agent.active ? "default" : "secondary"} className="mt-1 text-[10px]">
                        {agent.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <Switch checked={agent.active} onCheckedChange={() => toggleAgent(agent)} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chat com Bolt */}
        <Card className="flex flex-col" style={{ minHeight: 400 }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              Chat com Bolt
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 p-0">
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ maxHeight: 350 }}>
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t border-border p-3 flex gap-2">
              <Input
                type="search"
                autoComplete="off"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <Button onClick={sendMessage} size="icon" disabled={sending || !chatInput.trim()}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
