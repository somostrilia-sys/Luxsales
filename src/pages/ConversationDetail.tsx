import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { EDGE_BASE } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  ArrowLeft, Send, Bot, User, Loader2, Info, Clock, Check, CheckCheck,
  Smile, Meh, Frown, Sparkles, FileText, Phone,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Message {
  role: string;
  content: string;
  created_at: string;
  status?: string;
  is_ai?: boolean;
}

interface Lifecycle {
  stage: string;
  window_open: boolean;
  window_expires_at: string | null;
  sentiment: string | null;
  conversation_summary: string | null;
  interests?: string[];
  objections?: string[];
  messages_sent: number;
  messages_received: number;
  templates_sent?: string[];
}

const sentimentConfig: Record<string, { icon: any; color: string; label: string }> = {
  positive: { icon: Smile, color: "text-green-400", label: "Positivo" },
  neutral: { icon: Meh, color: "text-yellow-400", label: "Neutro" },
  negative: { icon: Frown, color: "text-red-400", label: "Negativo" },
  interested: { icon: Sparkles, color: "text-blue-400", label: "Interessado" },
};

export default function ConversationDetail() {
  const { phone } = useParams<{ phone: string }>();
  const navigate = useNavigate();
  const { collaborator } = useCollaborator();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [lifecycle, setLifecycle] = useState<Lifecycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [aiActive, setAiActive] = useState(true);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [leadName, setLeadName] = useState("Contato");

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    };
  }, []);

  const fetchConversation = useCallback(async () => {
    if (!collaborator || !phone) return;
    try {
      const headers = await getHeaders();
      const res = await fetch(`${EDGE_BASE}/conversation-engine`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "get-conversation",
          company_id: collaborator.company_id,
          phone_number: decodeURIComponent(phone),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(data.messages || []);
        setLifecycle(data.lifecycle || null);
        setLeadName(data.conversation?.lead_name || "Contato");
        setAiActive(data.conversation?.ai_active !== false);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [collaborator, phone, getHeaders]);

  useEffect(() => {
    fetchConversation();
    const interval = setInterval(fetchConversation, 5000);
    return () => clearInterval(interval);
  }, [fetchConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !collaborator || !phone) return;
    setSending(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${EDGE_BASE}/conversation-engine`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "send-manual",
          company_id: collaborator.company_id,
          collaborator_id: collaborator.id,
          phone_number: decodeURIComponent(phone),
          message: input,
        }),
      });
      if (res.ok) {
        setInput("");
        fetchConversation();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erro ao enviar");
      }
    } catch {
      toast.error("Erro de conexão");
    }
    setSending(false);
  };

  const handleHandoff = async () => {
    if (!collaborator || !phone) return;
    setHandoffLoading(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${EDGE_BASE}/conversation-engine`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "handoff",
          company_id: collaborator.company_id,
          phone_number: decodeURIComponent(phone),
          collaborator_id: collaborator.id,
        }),
      });
      if (res.ok) {
        setAiActive(false);
        toast.success("Você assumiu a conversa");
      }
    } catch {
      toast.error("Erro");
    }
    setHandoffLoading(false);
  };

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    if (isToday(d)) return format(d, "HH:mm");
    if (isYesterday(d)) return `Ontem ${format(d, "HH:mm")}`;
    return format(d, "dd/MM HH:mm");
  };

  const StatusIcon = ({ status }: { status?: string }) => {
    if (status === "read") return <CheckCheck className="h-3 w-3 text-blue-400" />;
    if (status === "delivered") return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
    return <Check className="h-3 w-3 text-muted-foreground" />;
  };

  const windowOpen = lifecycle?.window_open ?? false;
  const windowHours = lifecycle?.window_expires_at
    ? Math.max(0, Math.round((new Date(lifecycle.window_expires_at).getTime() - Date.now()) / 3600000))
    : 0;

  const ContextPanel = () => {
    const sentimentInfo = lifecycle?.sentiment ? sentimentConfig[lifecycle.sentiment] : null;
    const SIcon = sentimentInfo?.icon;

    return (
      <div className="space-y-4 p-4">
        <h3 className="font-semibold text-sm text-foreground">Contexto</h3>

        {lifecycle?.conversation_summary && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Resumo</p>
            <p className="text-sm text-foreground bg-muted/30 p-2 rounded">
              {lifecycle.conversation_summary}
            </p>
          </div>
        )}

        {lifecycle?.interests && lifecycle.interests.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Interesses</p>
            <div className="flex flex-wrap gap-1">
              {lifecycle.interests.map((i) => (
                <Badge key={i} variant="secondary" className="text-xs">{i}</Badge>
              ))}
            </div>
          </div>
        )}

        {lifecycle?.objections && lifecycle.objections.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Objeções</p>
            <div className="flex flex-wrap gap-1">
              {lifecycle.objections.map((o) => (
                <Badge key={o} variant="destructive" className="text-xs">{o}</Badge>
              ))}
            </div>
          </div>
        )}

        {sentimentInfo && SIcon && (
          <div className="flex items-center gap-2">
            <SIcon className={`h-4 w-4 ${sentimentInfo.color}`} />
            <span className="text-sm">{sentimentInfo.label}</span>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>Enviadas: {lifecycle?.messages_sent ?? 0}</p>
          <p>Recebidas: {lifecycle?.messages_received ?? 0}</p>
          <p>Stage: {lifecycle?.stage || "—"}</p>
        </div>

        {lifecycle?.templates_sent && lifecycle.templates_sent.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Templates enviados</p>
            {lifecycle.templates_sent.map((t) => (
              <Badge key={t} variant="outline" className="text-xs mr-1 mb-1">{t}</Badge>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="font-semibold text-sm">{leadName}</p>
            <p className="text-xs text-muted-foreground">{decodeURIComponent(phone || "")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {windowOpen ? (
            <Badge variant="outline" className="text-green-400 border-green-400/30 text-xs">
              <Clock className="h-3 w-3 mr-1" /> {windowHours}h
            </Badge>
          ) : (
            <Badge variant="outline" className="text-yellow-400 border-yellow-400/30 text-xs">
              Janela fechada
            </Badge>
          )}
          {aiActive && (
            <Badge variant="secondary" className="text-xs">
              <Bot className="h-3 w-3 mr-1" /> IA ativa
            </Badge>
          )}
          {/* Mobile context panel */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Info className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[60vh] overflow-y-auto">
              <ContextPanel />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Messages */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => {
              const isAgent = msg.role === "assistant" || msg.role === "agent";
              return (
                <div key={i} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                      isAgent
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {msg.is_ai && isAgent && (
                      <div className="flex items-center gap-1 mb-0.5">
                        <Bot className="h-3 w-3" />
                        <span className="text-[10px] opacity-70">IA</span>
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[10px] opacity-60">{formatTimestamp(msg.created_at)}</span>
                      {isAgent && <StatusIcon status={msg.status} />}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-3 space-y-2">
            {windowOpen ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Digitar mensagem..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  disabled={sending}
                  className="flex-1"
                />
                <Button onClick={sendMessage} disabled={sending || !input.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-xs text-yellow-400 mb-2">Janela fechada — use um template</p>
                <Button size="sm" variant="outline" onClick={() => navigate(`/my-leads`)}>
                  <FileText className="h-3.5 w-3.5 mr-1" /> Enviar Template
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              {aiActive && (
                <Button size="sm" variant="secondary" onClick={handleHandoff} disabled={handoffLoading}>
                  {handoffLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <User className="h-3 w-3 mr-1" />
                  )}
                  Assumir da IA
                </Button>
              )}
              {!aiActive && (
                <Badge variant="secondary" className="text-xs py-1">
                  <User className="h-3 w-3 mr-1" /> Você está respondendo
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Desktop context panel */}
        <aside className="hidden md:block w-[300px] border-l border-border overflow-y-auto">
          <ContextPanel />
        </aside>
      </div>
    </div>
  );
}
