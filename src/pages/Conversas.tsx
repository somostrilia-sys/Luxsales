import { useEffect, useState, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, Bot, Loader2, ArrowLeft } from "lucide-react";

interface AgentItem { id: string; name: string; emoji: string; description: string; }
interface Message { id: string; role: "user" | "assistant"; content: string; created_at: string; }

export default function Conversas() {
  const { collaborator } = useCollaborator();
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentItem | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (collaborator) loadAgents(); }, [collaborator]);

  const loadAgents = async () => {
    if (!collaborator) return;
    const [roleAccess, collabAccess] = await Promise.all([
      supabase.from("role_agent_access").select("agent_id").eq("role_id", collaborator.role_id),
      supabase.from("collaborator_agent_access").select("agent_id, has_access").eq("collaborator_id", collaborator.id),
    ]);
    const roleAgentIds = new Set((roleAccess.data || []).map((r: any) => r.agent_id));
    const overrides = new Map((collabAccess.data || []).map((c: any) => [c.agent_id, c.has_access]));
    const allowedIds = new Set<string>();
    roleAgentIds.forEach(id => { if (overrides.get(id) !== false) allowedIds.add(id); });
    overrides.forEach((hasAccess, agentId) => { if (hasAccess) allowedIds.add(agentId); });

    if (allowedIds.size > 0) {
      const { data } = await supabase.from("agent_definitions").select("id, name, emoji, description")
        .in("id", Array.from(allowedIds)).eq("active", true).order("name");
      setAgents((data || []) as AgentItem[]);
    }
    setLoading(false);
  };

  const openChat = async (agent: AgentItem) => {
    setSelectedAgent(agent);
    setMessages([]);
    const { data: existing } = await supabase.from("agent_conversations")
      .select("id").eq("agent_id", agent.id).eq("collaborator_id", collaborator!.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing) {
      setConversationId(existing.id);
      loadMessages(existing.id);
    } else {
      const { data: newConv } = await supabase.from("agent_conversations").insert({
        agent_id: agent.id, collaborator_id: collaborator!.id,
        company_id: collaborator!.company_id, title: `Conversa com ${agent.name}`,
      }).select("id").single();
      if (newConv) setConversationId(newConv.id);
    }
  };

  const loadMessages = async (convId: string) => {
    const { data } = await supabase.from("agent_messages").select("id, role, content, created_at")
      .eq("conversation_id", convId).order("created_at", { ascending: true });
    setMessages((data || []) as Message[]);
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const sendMessage = async () => {
    if (!input.trim() || !conversationId || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");
    const tempMsg: Message = { id: crypto.randomUUID(), role: "user", content, created_at: new Date().toISOString() };
    const newMessages = [...messages, tempMsg];
    setMessages(newMessages);
    await supabase.from("agent_messages").insert({ conversation_id: conversationId, role: "user", content });
    try {
      const history = newMessages.map(m => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke("consultant-chat", {
        body: { message: content, history, consultant_name: collaborator?.name || "Consultor" },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Erro ao enviar");
      } else if (data?.reply) {
        const assistantMsg: Message = {
          id: crypto.randomUUID(), role: "assistant", content: data.reply, created_at: new Date().toISOString(),
        };
        await supabase.from("agent_messages").insert({ conversation_id: conversationId, role: "assistant", content: data.reply });
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro de conexão");
    }
    setSending(false);
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  if (selectedAgent) {
    return (
      <DashboardLayout>
        <div className="flex flex-col h-[calc(100vh-8rem)]">
          <div className="flex items-center gap-3 pb-4 border-b">
            <Button variant="ghost" size="sm" onClick={() => setSelectedAgent(null)}><ArrowLeft className="h-4 w-4" /></Button>
            <span className="text-2xl">{selectedAgent.emoji}</span>
            <div>
              <h2 className="font-semibold">{selectedAgent.name}</h2>
              <p className="text-xs text-muted-foreground">{selectedAgent.description}</p>
            </div>
          </div>
          <ScrollArea className="flex-1 py-4">
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}>{msg.content}</div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
          <div className="pt-4 border-t">
            <div className="flex gap-2 max-w-3xl mx-auto">
              <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Digite sua mensagem..."
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()} />
              <Button onClick={sendMessage} disabled={sending || !input.trim()} className="btn-modern">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Conversas</h1>
        <p className="text-muted-foreground text-sm">Converse com seus agentes de IA</p>
        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : agents.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum agente disponível</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(agent => (
              <Card key={agent.id} className="cursor-pointer hover:bg-[hsl(var(--card-hover))] transition-colors" onClick={() => openChat(agent)}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{agent.emoji}</span>
                    <h3 className="font-semibold text-lg">{agent.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{agent.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
