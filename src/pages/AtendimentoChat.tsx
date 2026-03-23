import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, MessageCircle, Send, User, Bot, ArrowLeft } from "lucide-react";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { EDGE_BASE, SUPABASE_ANON_KEY } from "@/lib/constants";
import { toast } from "sonner";

interface Conversation {
  id: string;
  lead_name: string | null;
  lead_phone: string;
  last_message: string | null;
  unread_count: number;
  updated_at: string;
  instance_token?: string;
  server_url?: string;
}

interface Message {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

export default function AtendimentoChat() {
  const { collaborator } = useCollaborator();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    if (!collaborator) return;
    try {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("collaborator_id", collaborator.id)
        .order("updated_at", { ascending: false })
        .limit(100);
      setConversations((data as Conversation[]) || []);
    } catch {}
    setLoading(false);
  }, [collaborator]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const openConversation = async (conv: Conversation) => {
    setSelected(conv);
    setMsgLoading(true);
    try {
      const { data } = await supabase
        .from("messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true })
        .limit(200);
      setMessages((data as Message[]) || []);

      // Mark as read
      if (conv.unread_count > 0) {
        await supabase.from("conversations").update({ unread_count: 0 }).eq("id", conv.id).limit(1);
        setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
      }
    } catch {}
    setMsgLoading(false);
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const sendMessage = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    try {
      await fetch(`${EDGE_BASE}/send-whatsapp-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          instance_token: selected.instance_token,
          server_url: selected.server_url,
          number: selected.lead_phone,
          text: reply,
        }),
      });
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: reply, created_at: new Date().toISOString() }]);
      setReply("");
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e: any) { toast.error(e.message || "Erro ao enviar"); }
    setSending(false);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Hoje";
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Ontem";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  return (
    <DashboardLayout>
      <PageHeader title="Atendimento" subtitle="Conversas com leads via WhatsApp" />

      <div className="flex gap-4 h-[calc(100vh-180px)]">
        {/* Conversation list */}
        <div className={`w-full md:w-80 lg:w-96 shrink-0 ${selected ? "hidden md:block" : ""}`}>
          <Card variant="gradient" className="h-full">
            <CardContent className="p-0 h-full">
              {loading ? (
                <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                  <MessageCircle className="h-8 w-8" />
                  <p className="text-sm">Nenhuma conversa encontrada</p>
                </div>
              ) : (
                <ScrollArea className="h-full">
                  {conversations.map(conv => (
                    <button key={conv.id} onClick={() => openConversation(conv)}
                      className={`w-full text-left p-4 border-b border-border hover:bg-secondary/50 transition-colors ${selected?.id === conv.id ? "bg-secondary/70" : ""}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate max-w-[180px]">{conv.lead_name || conv.lead_phone}</span>
                        <span className="text-[10px] text-muted-foreground">{formatDate(conv.updated_at)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{conv.last_message || "..."}</p>
                        {conv.unread_count > 0 && <Badge className="h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full">{conv.unread_count}</Badge>}
                      </div>
                    </button>
                  ))}
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chat panel */}
        <div className={`flex-1 ${!selected ? "hidden md:flex md:items-center md:justify-center" : "flex flex-col"}`}>
          {!selected ? (
            <div className="text-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Selecione uma conversa</p>
            </div>
          ) : (
            <Card variant="gradient" className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-border flex items-center gap-3">
                <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={() => setSelected(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <User className="h-8 w-8 p-1.5 rounded-full bg-secondary text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{selected.lead_name || selected.lead_phone}</p>
                  <p className="text-[10px] text-muted-foreground">{selected.lead_phone}</p>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {msgLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                ) : (
                  <div className="space-y-3">
                    {messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.role === "assistant" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${msg.role === "assistant" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-secondary text-secondary-foreground rounded-bl-md"}`}>
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <p className={`text-[9px] mt-1 ${msg.role === "assistant" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>{formatTime(msg.created_at)}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={scrollRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Reply */}
              <div className="p-3 border-t border-border flex gap-2">
                <Input value={reply} onChange={e => setReply(e.target.value)} placeholder="Digite sua mensagem..."
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()} className="flex-1" />
                <Button size="icon" onClick={sendMessage} disabled={sending || !reply.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
