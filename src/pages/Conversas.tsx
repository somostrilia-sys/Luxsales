import { useState, useEffect, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { EDGE_BASE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Search, Send, Loader2, ArrowLeft, Bot, User, Info, Check, CheckCheck,
  X, Phone, FileText, MessageSquare, Clock,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";

const FALLBACK_COMPANY_ID = "d33b6a84-8f72-4441-b2eb-dd151a31ac12";

interface ConversationItem {
  phone_from: string;
  body: string | null;
  created_at: string;
  lead_name: string | null;
  window_open: boolean;
  ai_status?: string;
}

interface ChatMessage {
  id: string;
  phone_from: string;
  phone_to: string;
  body: string | null;
  direction: string;
  status: string | null;
  created_at: string;
  is_ai_generated?: boolean;
}

interface LifecycleData {
  stage: string | null;
  sentiment: string | null;
  window_open: boolean;
  window_expires_at: string | null;
  interests: string[] | null;
  objections: string[] | null;
  messages_sent: number;
  messages_received: number;
}

interface TemplateItem {
  name: string;
  status: string;
  language: string;
}

export default function Conversas() {
  const { collaborator } = useCollaborator();
  const isMobile = useIsMobile();

  const companyId = collaborator?.company_id || FALLBACK_COMPANY_ID;

  // Left panel
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "window" | "waiting">("all");

  // Right panel
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [lifecycle, setLifecycle] = useState<LifecycleData | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Template modal
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);

  // ── Load conversation list ──
  const loadConversations = useCallback(async () => {
    const { data: msgs } = await supabase
      .from("whatsapp_meta_messages")
      .select("phone_from, body, created_at, status")
      .eq("company_id", companyId)
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(500);

    if (!msgs) { setLoadingList(false); return; }

    // Group by phone_from, keep latest
    const map = new Map<string, ConversationItem>();
    for (const m of msgs) {
      if (!map.has(m.phone_from)) {
        map.set(m.phone_from, {
          phone_from: m.phone_from,
          body: m.body,
          created_at: m.created_at,
          lead_name: null,
          window_open: false,
          ai_status: undefined,
        });
      }
    }

    const phones = Array.from(map.keys());

    // Enrich with lifecycle data
    if (phones.length > 0) {
      const { data: lifecycles } = await supabase
        .from("lead_whatsapp_lifecycle")
        .select("phone_number, lead_name, window_open, ai_conversation_active")
        .eq("company_id", companyId)
        .in("phone_number", phones);

      if (lifecycles) {
        for (const lc of lifecycles) {
          const item = map.get((lc as any).phone_number);
          if (item) {
            item.lead_name = (lc as any).lead_name || null;
            item.window_open = (lc as any).window_open ?? false;
            item.ai_status = (lc as any).ai_conversation_active ? "ia" : undefined;
          }
        }
      }
    }

    setConversations(Array.from(map.values()));
    setLoadingList(false);
  }, [companyId]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // ── Load chat messages ──
  const loadMessages = useCallback(async (phone: string) => {
    setLoadingChat(true);
    setMessages([]);

    const { data } = await supabase
      .from("whatsapp_meta_messages")
      .select("id, phone_from, phone_to, body, direction, status, created_at, is_ai_generated")
      .eq("company_id", companyId)
      .or(`phone_from.eq.${phone},phone_to.eq.${phone}`)
      .order("created_at", { ascending: true })
      .limit(200);

    setMessages((data || []) as ChatMessage[]);

    // Load lifecycle — try exact phone, then variations
    console.log("Buscando lifecycle para phone:", phone);
    let lc: LifecycleData | null = null;

    const phonesToTry = [phone];
    if (phone.startsWith("+")) phonesToTry.push(phone.slice(1));
    else {
      phonesToTry.push("+" + phone);
      if (phone.startsWith("55")) phonesToTry.push("+55" + phone.slice(2), "+" + phone);
    }

    for (const tryPhone of phonesToTry) {
      const { data } = await supabase
        .from("lead_whatsapp_lifecycle")
        .select("stage, sentiment, window_open, window_expires_at, interests, objections, messages_sent, messages_received")
        .eq("phone_number", tryPhone)
        .maybeSingle();
      if (data) {
        lc = data as LifecycleData;
        console.log("Resultado lifecycle (match:", tryPhone, "):", lc);
        break;
      }
    }
    if (!lc) console.log("Resultado lifecycle: null (nenhuma variação encontrada)");

    setLifecycle(lc);
    setLoadingChat(false);
  }, [companyId]);

  // When a phone is selected, load its messages
  const handleSelectPhone = useCallback((phone: string) => {
    setSelectedPhone(phone);
    loadMessages(phone);
  }, [loadMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Realtime subscription ──
  useEffect(() => {
    const channel = supabase
      .channel("conv-messages-rt")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "whatsapp_meta_messages",
      }, (payload) => {
        const msg = payload.new as ChatMessage;
        // Only care about our company
        if ((msg as any).company_id !== companyId) return;

        // If this message belongs to the selected conversation, append it
        if (selectedPhone && (msg.phone_from === selectedPhone || msg.phone_to === selectedPhone)) {
          setMessages((prev) => {
            // Dedupe by id
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
        // Refresh the conversation list
        loadConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [companyId, selectedPhone, loadConversations]);

  // ── Send message ──
  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "",
    };
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || !selectedPhone || sending) return;
    setSending(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${EDGE_BASE}/send-meta-message`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "send",
          company_id: companyId,
          to: selectedPhone,
          type: "text",
          text: input.trim(),
        }),
      });
      if (res.ok) {
        setInput("");
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Erro ao enviar mensagem");
      }
    } catch {
      toast.error("Erro de conexão");
    }
    setSending(false);
  };

  // ── Send template ──
  const loadTemplates = async () => {
    const { data } = await supabase
      .from("whatsapp_meta_templates")
      .select("name, status, language")
      .eq("company_id", companyId)
      .eq("status", "APPROVED");
    setTemplates((data || []) as TemplateItem[]);
    setTemplateOpen(true);
  };

  const sendTemplate = async (templateName: string) => {
    if (!selectedPhone) return;
    try {
      const headers = await getHeaders();
      await fetch(`${EDGE_BASE}/smart-dispatcher`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "send-by-slot",
          company_id: companyId,
          phone_number: selectedPhone,
          template_name: templateName,
        }),
      });
      toast.success("Template enviado");
      setTemplateOpen(false);
    } catch {
      toast.error("Erro ao enviar template");
    }
  };

  // ── Helpers ──
  const formatTs = (ts: string) => {
    const d = new Date(ts);
    if (isToday(d)) return format(d, "HH:mm");
    if (isYesterday(d)) return `Ontem ${format(d, "HH:mm")}`;
    return format(d, "dd/MM HH:mm");
  };

  const StatusIcon = ({ status }: { status?: string | null }) => {
    if (status === "read") return <CheckCheck className="h-3 w-3 text-blue-400" />;
    if (status === "delivered") return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
    if (status === "failed") return <X className="h-3 w-3 text-destructive" />;
    return <Check className="h-3 w-3 text-muted-foreground" />;
  };

  const windowExpiresAt = lifecycle?.window_expires_at ? new Date(lifecycle.window_expires_at) : null;
  const windowOpen = (lifecycle?.window_open ?? false) && windowExpiresAt !== null && windowExpiresAt > new Date();
  const hoursLeft = windowExpiresAt ? Math.max(0, Math.round((windowExpiresAt.getTime() - Date.now()) / 3600000)) : 0;

  // ── Filter conversations ──
  const filtered = conversations.filter((c) => {
    if (filter === "window" && !c.window_open) return false;
    if (filter === "waiting" && c.ai_status === "ia") return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (c.lead_name?.toLowerCase().includes(q) || c.phone_from.includes(q));
    }
    return true;
  });

  // ── Context panel content ──
  const ContextPanel = () => (
    <div className="space-y-4 p-4">
      <h3 className="font-semibold text-sm">Contexto do Lead</h3>
      {lifecycle ? (
        <>
          <div className="text-xs space-y-1 text-muted-foreground">
            <p>Stage: <span className="text-foreground">{lifecycle.stage || "—"}</span></p>
            <p>Sentimento: <span className="text-foreground">{lifecycle.sentiment || "—"}</span></p>
            <p>Enviadas: {lifecycle.messages_sent}</p>
            <p>Recebidas: {lifecycle.messages_received}</p>
          </div>
          {lifecycle.interests && lifecycle.interests.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Interesses</p>
              <div className="flex flex-wrap gap-1">
                {lifecycle.interests.map((i) => <Badge key={i} variant="secondary" className="text-xs">{i}</Badge>)}
              </div>
            </div>
          )}
          {lifecycle.objections && lifecycle.objections.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Objeções</p>
              <div className="flex flex-wrap gap-1">
                {lifecycle.objections.map((o) => <Badge key={o} variant="destructive" className="text-xs">{o}</Badge>)}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Sem dados de lifecycle</p>
      )}

      <div className="pt-2 space-y-2">
        <Button size="sm" variant="outline" className="w-full justify-start gap-2" onClick={async () => {
          if (selectedPhone) {
            try {
              const headers = await getHeaders();
              await fetch(`${EDGE_BASE}/make-call`, {
                method: "POST",
                headers,
                body: JSON.stringify({ action: "dial", to: selectedPhone }),
              });
              toast.success("Ligação iniciada");
            } catch { toast.error("Erro"); }
          }
        }}>
          <Phone className="h-3.5 w-3.5" /> Ligar
        </Button>
      </div>
    </div>
  );

  // ── Conversation List Panel ──
  const ConversationList = () => (
    <div className="flex flex-col h-full border-r border-border">
      <div className="p-3 border-b border-border space-y-2">
        <h2 className="font-semibold text-lg">Conversas</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nome ou telefone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "window", "waiting"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "ghost"}
              className="text-xs h-7"
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Todos" : f === "window" ? "Janela aberta" : "Aguardando"}
            </Button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loadingList ? (
          <div className="p-3 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 items-center">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhuma conversa ainda.</p>
            <p className="text-xs mt-1">Quando leads mandarem mensagem no WhatsApp, aparecerão aqui.</p>
          </div>
        ) : (
          <div>
            {filtered.map((c) => (
              <button
                key={c.phone_from}
                onClick={() => handleSelectPhone(c.phone_from)}
                className={`w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-accent/50 ${
                  selectedPhone === c.phone_from ? "bg-accent" : ""
                }`}
              >
                <div className="relative h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-muted-foreground" />
                  {c.window_open && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 rounded-full border-2 border-background" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm truncate">{c.lead_name || c.phone_from}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{formatTs(c.created_at)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{c.body || "..."}</p>
                  <div className="flex gap-1 mt-0.5">
                    {c.ai_status === "ia" && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4"><Bot className="h-2.5 w-2.5 mr-0.5" />IA</Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  // ── Chat Panel ──
  const ChatPanel = () => {
    if (!selectedPhone) {
      return (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-sm">Selecione uma conversa</p>
          </div>
        </div>
      );
    }

    const selected = conversations.find((c) => c.phone_from === selectedPhone);

    return (
      <div className="flex-1 flex flex-col h-full">
        {/* Chat header */}
        <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button variant="ghost" size="icon" onClick={() => setSelectedPhone(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <p className="font-semibold text-sm">{selected?.lead_name || selectedPhone}</p>
              <p className="text-xs text-muted-foreground">{selectedPhone}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {windowOpen ? (
              <Badge variant="outline" className="text-green-400 border-green-500/30 text-xs">
                <Clock className="h-3 w-3 mr-1" /> Janela aberta — expira em {hoursLeft}h
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">Janela fechada</Badge>
            )}
            {lifecycle?.stage && (
              <Badge variant="secondary" className="text-xs">{lifecycle.stage}</Badge>
            )}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon"><Info className="h-4 w-4" /></Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[320px] overflow-y-auto">
                <SheetTitle>Detalhes do Lead</SheetTitle>
                <ContextPanel />
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loadingChat ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Nenhuma mensagem</p>
          ) : (
            messages.map((msg) => {
              const isOutbound = msg.direction === "outbound";
              return (
                <div key={msg.id} className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                      isOutbound
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {msg.is_ai_generated && isOutbound && (
                      <div className="flex items-center gap-1 mb-0.5">
                        <Bot className="h-3 w-3" />
                        <span className="text-[10px] opacity-70">IA</span>
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[10px] opacity-60">{formatTs(msg.created_at)}</span>
                      {isOutbound && <StatusIcon status={msg.status} />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-border p-3">
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
              <p className="text-xs text-yellow-400 mb-2">Janela expirada — só templates</p>
              <Button size="sm" variant="outline" onClick={loadTemplates}>
                <FileText className="h-3.5 w-3.5 mr-1" /> Enviar Template
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Template Modal ──
  const TemplateModal = () => (
    <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Selecionar Template</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-2">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum template aprovado</p>
            ) : (
              templates.map((t) => (
                <button
                  key={t.name}
                  onClick={() => sendTemplate(t.name)}
                  className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                >
                  <p className="font-medium text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.language}</p>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );

  // ── Main render ──
  if (isMobile) {
    return (
      <DashboardLayout>
        <div className="h-[calc(100vh-8rem)] flex flex-col">
          {selectedPhone ? <ChatPanel /> : <ConversationList />}
        </div>
        <TemplateModal />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-6rem)] flex border border-border rounded-lg overflow-hidden">
        <div className="w-[360px] shrink-0">
          <ConversationList />
        </div>
        <ChatPanel />
      </div>
      <TemplateModal />
    </DashboardLayout>
  );
}
