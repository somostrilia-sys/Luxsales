import { useEffect, useState, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  MessageSquare, Send, Search, Phone, Clock,
  CheckCheck, Check, X, Loader2,
} from "lucide-react";

type Conversation = {
  id: string;
  phone: string;
  name: string | null;
  lastMessage: string;
  lastTime: string;
  unread: number;
};

type Message = {
  id: string;
  direction: string;
  content: string;
  status: string;
  ai_generated: boolean;
  created_at: string;
};

const formatTime = (d: string) => {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return "Agora";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min`;
  if (diff < 86400000) return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const statusIcon = (s: string) => {
  if (s === "read") return <CheckCheck className="h-3.5 w-3.5 text-blue-400" />;
  if (s === "delivered") return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />;
  if (s === "sent") return <Check className="h-3.5 w-3.5 text-muted-foreground" />;
  if (s === "failed") return <X className="h-3.5 w-3.5 text-red-400" />;
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
};

export default function WhatsAppMeta() {
  const { collaborator } = useCollaborator();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadConversations(); }, [collaborator]);

  // Realtime subscription on whatsapp_messages
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_messages" }, (payload) => {
        const msg = payload.new as any;
        // Add to messages if current conversation
        if (selectedConv) {
          setMessages(prev => [...prev, {
            id: msg.id, direction: msg.direction, content: msg.content ?? "",
            status: msg.status ?? "sent", ai_generated: msg.ai_generated ?? false,
            created_at: msg.created_at ?? new Date().toISOString(),
          }]);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
        // Refresh conversation list
        loadConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedConv]);

  const loadConversations = async () => {
    setLoading(true);
    const companyId = collaborator?.company_id;
    // Try loading from whatsapp_messages grouped by lead
    const { data } = await supabase
      .from("whatsapp_messages")
      .select("id, lead_id, from_number, to_number, direction, content, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (data && data.length > 0) {
      // Group by phone number
      const convMap = new Map<string, Conversation>();
      data.forEach((m: any) => {
        const phone = m.direction === "inbound" ? m.from_number : m.to_number;
        if (!phone) return;
        if (!convMap.has(phone)) {
          convMap.set(phone, {
            id: phone,
            phone,
            name: null,
            lastMessage: m.content ?? "",
            lastTime: m.created_at,
            unread: 0,
          });
        }
        if (m.direction === "inbound" && m.status !== "read") {
          const conv = convMap.get(phone)!;
          conv.unread++;
        }
      });
      setConversations(Array.from(convMap.values()));
    } else {
      // Demo data
      setConversations([
        { id: "5511999887766", phone: "5511999887766", name: "João Silva", lastMessage: "Olá, gostaria de mais informações", lastTime: new Date().toISOString(), unread: 2 },
        { id: "5511988776655", phone: "5511988776655", name: "Maria Santos", lastMessage: "Obrigada!", lastTime: new Date(Date.now() - 3600000).toISOString(), unread: 0 },
      ]);
    }
    setLoading(false);
  };

  const loadMessages = async (phone: string) => {
    setLoadingMsgs(true);
    setSelectedConv(phone);
    const { data } = await supabase
      .from("whatsapp_messages")
      .select("id, direction, content, status, ai_generated, created_at")
      .or(`from_number.eq.${phone},to_number.eq.${phone}`)
      .order("created_at", { ascending: true })
      .limit(100);
    setMessages((data ?? []).map((m: any) => ({
      id: m.id, direction: m.direction, content: m.content ?? "",
      status: m.status ?? "sent", ai_generated: m.ai_generated ?? false,
      created_at: m.created_at,
    })));
    setLoadingMsgs(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedConv) return;
    const { error } = await supabase.from("whatsapp_messages").insert({
      company_id: collaborator?.company_id,
      direction: "outbound",
      from_number: collaborator?.whatsapp_comercial ?? "",
      to_number: selectedConv,
      message_type: "text",
      content: messageInput,
      status: "sent",
      ai_generated: false,
    } as any);
    if (error) { console.error(error); toast.error("Erro ao enviar mensagem."); }
    else { toast.success("Mensagem enviada!"); }
    setMessageInput("");
  };

  const filteredConvs = conversations.filter(c =>
    !searchTerm || (c.name ?? "").toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm)
  );

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="WhatsApp"
          subtitle="Inbox de mensagens em tempo real"
          badge={totalUnread > 0 ? <Badge className="bg-emerald-500 text-white">{totalUnread} não lidas</Badge> : undefined}
        />

        <div className="grid grid-cols-[320px_1fr] h-[600px] rounded-xl border border-border/60 overflow-hidden">
          {/* Conversation List */}
          <div className="border-r border-border/60 bg-card flex flex-col">
            <div className="p-3 border-b border-border/60">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar conversa..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9" />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : filteredConvs.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">Nenhuma conversa</div>
              ) : filteredConvs.map(conv => (
                <button key={conv.id} onClick={() => loadMessages(conv.phone)}
                  className={`w-full text-left px-4 py-3 border-b border-border/30 hover:bg-secondary/30 transition-colors ${selectedConv === conv.phone ? "bg-secondary/50" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{conv.name ?? conv.phone}</p>
                      <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{formatTime(conv.lastTime)}</span>
                      {conv.unread > 0 && (
                        <span className="h-5 w-5 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-bold">{conv.unread}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </ScrollArea>
          </div>

          {/* Chat */}
          <div className="bg-background flex flex-col">
            {selectedConv ? (
              <>
                <div className="h-14 px-4 flex items-center border-b border-border/60 bg-card">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center"><Phone className="h-4 w-4 text-emerald-400" /></div>
                    <div>
                      <p className="text-sm font-medium">{conversations.find(c => c.phone === selectedConv)?.name ?? selectedConv}</p>
                      <p className="text-[10px] text-muted-foreground">{selectedConv}</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 p-4 overflow-y-auto bg-secondary/10">
                  {loadingMsgs ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-8">Nenhuma mensagem ainda</div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map(m => (
                        <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] rounded-xl px-4 py-2 text-sm ${
                            m.direction === "outbound"
                              ? "bg-emerald-600 text-white rounded-br-sm"
                              : "bg-card text-foreground rounded-bl-sm"
                          }`}>
                            <p>{m.content}</p>
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <span className="text-[10px] opacity-70">{formatTime(m.created_at)}</span>
                              {m.direction === "outbound" && statusIcon(m.status)}
                              {m.ai_generated && <Badge className="text-[8px] h-4 bg-violet-500/30 text-violet-300 px-1">IA</Badge>}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>
                <div className="p-3 border-t border-border/60 bg-card flex gap-2">
                  <Input placeholder="Digite uma mensagem..." value={messageInput} onChange={e => setMessageInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} className="flex-1" />
                  <Button size="icon" onClick={sendMessage} className="bg-emerald-600 hover:bg-emerald-700"><Send className="h-4 w-4" /></Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-2">
                  <MessageSquare className="h-12 w-12 mx-auto opacity-30" />
                  <p className="text-sm">Selecione uma conversa</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
