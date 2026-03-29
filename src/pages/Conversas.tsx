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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Search,
  Loader2,
  ArrowLeft,
  Bot,
  Info,
  Check,
  CheckCheck,
  X,
  Phone,
  MessageSquare,
  SendHorizontal,
} from "lucide-react";
import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  type?: string | null;
  status: string | null;
  created_at: string;
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  template_name?: string | null;
  metadata?: any;
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

  // Right panel
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [lifecycle, setLifecycle] = useState<LifecycleData | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [windowOpen, setWindowOpen] = useState<boolean>(false);
  const [windowExpires, setWindowExpires] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedPhoneRef = useRef<string | null>(null);

  // Template modal
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);

  useEffect(() => {
    selectedPhoneRef.current = selectedPhone;
  }, [selectedPhone]);

  // ── Load conversation list ──
  const loadConversations = useCallback(async () => {
    setLoadingList(true);
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
  useEffect(() => {
    if (!selectedPhone) {
      setMessages([]);
      return;
    }

    console.log("=== FETCH MESSAGES ===");
    console.log("selectedPhone:", selectedPhone);

    const load = async () => {
      setLoadingChat(true);
      try {
        const { data, error } = await supabase
          .from("whatsapp_meta_messages")
          .select("*")
          .or(`phone_from.eq.${selectedPhone},phone_to.eq.${selectedPhone}`)
          .order("created_at", { ascending: true })
          .limit(200);

        console.log("Query result - error:", error);
        console.log("Query result - count:", data?.length);
        console.log("Query result - first:", data?.[0]);

        if (data && data.length > 0) {
          setMessages(data as ChatMessage[]);
        } else {
          const { data: data2 } = await supabase
            .from("whatsapp_meta_messages")
            .select("*")
            .eq("phone_from", selectedPhone)
            .order("created_at", { ascending: true })
            .limit(200);

          console.log("Fallback result:", data2?.length);
          setMessages((data2 || []) as ChatMessage[]);
        }
      } catch (err) {
        console.error("Erro ao buscar mensagens:", err);
        setMessages([]);
      } finally {
        setLoadingChat(false);
      }
    };

    void load();
  }, [selectedPhone]);

  // ── Load lifecycle context ──
  useEffect(() => {
    if (!selectedPhone) {
      setLifecycle(null);
      return;
    }

    const loadLifecycle = async () => {
      console.log("Buscando lifecycle para phone:", selectedPhone);
      let lifecycleData: LifecycleData | null = null;

      const phonesToTry = [selectedPhone];
      if (selectedPhone.startsWith("+")) phonesToTry.push(selectedPhone.slice(1));
      if (!selectedPhone.startsWith("+")) phonesToTry.push(`+${selectedPhone}`);
      if (selectedPhone.startsWith("55")) phonesToTry.push(`+${selectedPhone}`);

      for (const tryPhone of Array.from(new Set(phonesToTry))) {
        const { data: lc } = await supabase
          .from("lead_whatsapp_lifecycle")
          .select("stage, sentiment, window_open, window_expires_at, interests, objections, messages_sent, messages_received")
          .eq("phone_number", tryPhone)
          .maybeSingle();

        if (lc) {
          lifecycleData = lc as LifecycleData;
          break;
        }
      }

      console.log("Resultado lifecycle:", lifecycleData);
      setLifecycle(lifecycleData);
    };

    void loadLifecycle();
  }, [selectedPhone]);

  // ── Window state (24h) ──
  const fetchWindow = useCallback(async (phone: string) => {
    const { data } = await supabase
      .from("lead_whatsapp_lifecycle")
      .select("window_open, window_expires_at")
      .eq("phone_number", phone.replace("+", ""))
      .maybeSingle();

    if (data) {
      const isOpen = data.window_open === true && new Date(data.window_expires_at) > new Date();
      setWindowOpen(isOpen);
      setWindowExpires(data.window_expires_at);
    } else {
      setWindowOpen(false);
      setWindowExpires(null);
    }
  }, []);

  useEffect(() => {
    if (!selectedPhone) {
      setWindowOpen(false);
      setWindowExpires(null);
      return;
    }

    fetchWindow(selectedPhone);
  }, [selectedPhone, fetchWindow]);

  // Auto-scroll when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Keep input focus when chat window is open
  useEffect(() => {
    if (windowOpen) {
      inputRef.current?.focus();
    }
  }, [selectedPhone, windowOpen]);

  // ── Realtime subscription ──
  useEffect(() => {
    const channel = supabase
      .channel("conv-messages-rt")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "whatsapp_meta_messages",
      }, (payload: any) => {
        const msg = payload.new as ChatMessage;

        const currentPhone = selectedPhoneRef.current;
        const belongsToCurrent = currentPhone && (msg.phone_from === currentPhone || msg.phone_to === currentPhone);

        if (belongsToCurrent) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });

          if (currentPhone) {
            fetchWindow(currentPhone);
          }
        }

        loadConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [companyId, loadConversations, fetchWindow]);

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
    if (!messageText.trim() || !selectedPhone || sending || !windowOpen) return;
    setSending(true);
    try {
      const res = await fetch("https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/send-meta-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedPhone.replace("+", ""),
          message: messageText,
          company_id: FALLBACK_COMPANY_ID,
        }),
      });
      if (res.ok) {
        setMessageText("");
        inputRef.current?.focus();
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

  const formatRelativeListTs = (ts: string) => {
    const d = new Date(ts);
    if (isToday(d)) {
      return formatDistanceToNowStrict(d, { addSuffix: true, locale: ptBR });
    }
    if (isYesterday(d)) return "Ontem";
    return format(d, "dd/MM/yy");
  };

  const formatPhone = (phone: string) => {
    const onlyDigits = phone.replace(/\D/g, "");
    if (onlyDigits.length >= 12) {
      return `+${onlyDigits.slice(0, 2)} ${onlyDigits.slice(2, 4)} ${onlyDigits.slice(4, 9)}-${onlyDigits.slice(9, 13)}`;
    }
    if (onlyDigits.length >= 11) {
      return `(${onlyDigits.slice(0, 2)}) ${onlyDigits.slice(2, 7)}-${onlyDigits.slice(7, 11)}`;
    }
    return phone;
  };

  const getAvatarTone = (seed: string) => {
    const colors = [
      { bg: "#00a884", fg: "#fff" },
      { bg: "#53bdeb", fg: "#fff" },
      { bg: "#f7a72c", fg: "#fff" },
      { bg: "#d94f6b", fg: "#fff" },
      { bg: "#7c5cfc", fg: "#fff" },
      { bg: "#00acc1", fg: "#fff" },
    ];
    const index = seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  const getDateSeparatorLabel = (ts: string) => {
    const d = new Date(ts);
    if (isToday(d)) return "Hoje";
    if (isYesterday(d)) return "Ontem";
    return format(d, "dd/MM/yyyy");
  };

  const StatusIcon = ({ status }: { status?: string | null }) => {
    if (status === "read") return <CheckCheck className="h-3 w-3 wa-read-receipt" />;
    if (status === "delivered") return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
    if (status === "failed") return <X className="h-3 w-3 text-destructive" />;
    return <Check className="h-3 w-3 text-muted-foreground" />;
  };

  // ── Filter conversations ──
  const filtered = conversations.filter((c) => {
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
  const renderConversationList = () => (
    <div className="flex h-full flex-col wa-surface" style={{ borderRight: "1px solid #e9edef" }}>
      {/* Green header */}
      <div className="wa-header-green flex h-14 items-center px-4">
        <h2 className="text-base font-semibold text-white">Conversas</h2>
      </div>
      {/* Search */}
      <div className="px-2 py-1.5" style={{ background: "#f0f2f5" }}>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4" style={{ color: "#54656f" }} />
          <input
            placeholder="Buscar ou começar uma nova conversa"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-lg border-none pl-9 pr-3 text-[13px] outline-none"
            style={{ background: "#ffffff", color: "#111b21" }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto wa-chat-scrollbar">
        {loadingList ? (
          <div className="p-3 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 items-center">
                <Skeleton className="h-[49px] w-[49px] rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center" style={{ color: "#667781" }}>
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhuma conversa ainda.</p>
            <p className="text-xs mt-1">Quando leads mandarem mensagem no WhatsApp, aparecerão aqui.</p>
          </div>
        ) : (
          <div>
            {filtered.map((c) => {
              const avatar = getAvatarTone(c.phone_from);
              return (
                <button
                  key={c.phone_from}
                  onClick={() => {
                    console.log("Clicou em:", c.phone_from);
                    setSelectedPhone(c.phone_from);
                    setMessageText("");
                  }}
                  className={cn(
                    "wa-row-hover flex w-full items-center gap-3 px-3 py-[10px] text-left transition-colors",
                    selectedPhone === c.phone_from && "wa-row-selected",
                  )}
                  style={{ borderBottom: "1px solid #e9edef" }}
                >
                  <div
                    className="relative flex h-[49px] w-[49px] shrink-0 items-center justify-center rounded-full text-base font-medium"
                    style={{ background: avatar.bg, color: avatar.fg }}
                  >
                    {c.lead_name ? c.lead_name.slice(0, 1).toUpperCase() : "👤"}
                    {c.window_open && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full wa-window-dot" style={{ border: "2px solid #fff" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[15px] wa-text-main" style={{ fontWeight: 500 }}>{c.lead_name || formatPhone(c.phone_from)}</p>
                      <span className="shrink-0 text-[12px] wa-text-muted">{formatRelativeListTs(c.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <p className="truncate text-[13px] wa-text-muted flex-1">{c.body || "..."}</p>
                      {c.ai_status === "ia" && (
                        <span className="shrink-0 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: "#e1f2fb", color: "#008069" }}>
                          <Bot className="h-2.5 w-2.5" />IA
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ── Chat Panel ──
  const renderEmptyState = () => (
    <div className="wa-chat-pattern flex h-full flex-1 items-center justify-center">
      <div className="text-center" style={{ color: "#667781" }}>
        <MessageSquare className="mx-auto mb-4 h-16 w-16 opacity-25" />
        <p className="text-lg font-light">Selecione uma conversa</p>
        <p className="text-sm mt-1 opacity-60">para começar a atender</p>
      </div>
    </div>
  );

  const renderChatPanel = () => {
    if (!selectedPhone) {
      return renderEmptyState();
    }

    const selected = conversations.find((c) => c.phone_from === selectedPhone);
    const title = selected?.lead_name || formatPhone(selectedPhone);
    const avatar = getAvatarTone(selectedPhone);

    return (
      <div className="flex h-full flex-1 flex-col">
        {/* Chat header */}
        <div className="sticky top-0 z-10 flex h-[60px] shrink-0 items-center justify-between px-4" style={{ background: "#f0f2f5", borderBottom: "1px solid #e0e0e0" }}>
          <div className="flex items-center gap-3">
            {isMobile && (
              <button onClick={() => setSelectedPhone(null)} className="mr-1">
                <ArrowLeft className="h-5 w-5" style={{ color: "#54656f" }} />
              </button>
            )}
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium"
              style={{ background: avatar.bg, color: avatar.fg }}
            >
              {title.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="text-[16px] wa-text-main" style={{ fontWeight: 500 }}>{title}</p>
              <p className="text-[12px] wa-text-muted">{formatPhone(selectedPhone)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lifecycle?.stage && (
              <span className="rounded-full px-2 py-0.5 text-[11px] font-medium capitalize" style={{ background: "#e1f2fb", color: "#008069" }}>
                {lifecycle.stage.replace("_", " ")}
              </span>
            )}
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", windowOpen ? "wa-window-open" : "wa-window-closed")}>
              {windowOpen ? "Aberta" : "Fechada"}
            </span>
            <button onClick={() => {}} style={{ color: "#54656f" }}>
              <Phone className="h-[18px] w-[18px]" />
            </button>
            <Sheet>
              <SheetTrigger asChild>
                <button style={{ color: "#54656f" }}>
                  <Info className="h-[18px] w-[18px]" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[320px] overflow-y-auto">
                <SheetTitle>Detalhes do Lead</SheetTitle>
                <ContextPanel />
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Messages */}
        <div className="wa-chat-pattern wa-chat-scrollbar flex-1 overflow-y-auto px-[4%] py-3" style={{ paddingBottom: "8px" }}>
          {loadingChat ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "#008069" }} /></div>
          ) : messages.length === 0 ? (
            <div className="flex justify-center py-10 text-gray-500">Nenhuma mensagem ainda</div>
          ) : (
            messages.map((msg, index) => {
              const isOutbound = msg.direction === "outbound";
              const previous = messages[index - 1];
              const showDateSeparator = !previous || new Date(previous.created_at).toDateString() !== new Date(msg.created_at).toDateString();

              return (
                <div key={msg.id} className="mb-1">
                  {showDateSeparator && (
                    <div className="flex justify-center py-2 mb-1">
                      <span className="wa-date-sep">{getDateSeparatorLabel(msg.created_at)}</span>
                    </div>
                  )}

                  <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[65%]", isOutbound ? "wa-bubble-outbound" : "wa-bubble-inbound")} style={{ padding: "6px 7px 8px 9px" }}>
                      {msg.is_ai_generated && isOutbound && (
                        <div className="mb-0.5 flex items-center gap-1">
                          <Bot className="h-3 w-3" style={{ color: "#667781" }} />
                          <span className="text-[10px]" style={{ color: "#667781" }}>IA</span>
                        </div>
                      )}
                      <p className="whitespace-pre-wrap" style={{ fontSize: "14.2px", color: "#111b21", lineHeight: 1.4 }}>{msg.body || `[${msg.type || "mensagem"}]`}</p>
                      <div className="flex items-center justify-end gap-1 -mb-1" style={{ marginLeft: "8px", float: "right", marginTop: "2px" }}>
                        <span style={{ fontSize: "11px", color: "#667781" }}>{format(msg.created_at, "HH:mm")}</span>
                        {isOutbound && (
                          <span className={`text-[11px] ${msg.read_at ? "text-[#53bdeb]" : "text-[#667781]"}`}>
                            {msg.read_at ? "✓✓" : msg.delivered_at ? "✓✓" : msg.sent_at ? "✓" : "🕐"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="sticky bottom-0" style={{ background: "#f0f2f5", padding: "5px 10px", borderTop: "1px solid #e0e0e0" }}>
          {windowOpen ? (
            <div>
              <div className="wa-window-open mb-1.5 flex items-center gap-1.5 rounded px-2 py-1 text-[11px]">
                <span className="h-2 w-2 rounded-full wa-window-dot"></span>
                Janela aberta — expira {windowExpires ? new Date(windowExpires).toLocaleString("pt-BR") : ""}
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Digite uma mensagem"
                  className="flex-1 outline-none"
                  style={{ background: "#ffffff", borderRadius: "8px", border: "none", padding: "9px 12px", fontSize: "15px", color: "#111b21" }}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  disabled={sending}
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !messageText.trim()}
                  className="wa-send-btn flex h-10 w-10 items-center justify-center rounded-full"
                >
                  {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizontal className="h-5 w-5" />}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="wa-window-closed mb-1.5 rounded px-2 py-1 text-[11px]">
                Janela de 24h expirada
              </div>
              <button
                className="wa-template-btn w-full rounded-lg px-4 py-2.5 text-sm font-medium"
                onClick={loadTemplates}
              >
                Enviar Template
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Template Modal ──
  const renderTemplateModal = () => (
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
        <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden rounded-lg border border-border/50">
          {selectedPhone ? renderChatPanel() : renderConversationList()}
        </div>
        {renderTemplateModal()}
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-64px)] overflow-hidden rounded-lg border border-border/50">
        <div className="w-[350px] shrink-0">
          {renderConversationList()}
        </div>
        {renderChatPanel()}
      </div>
      {renderTemplateModal()}
    </DashboardLayout>
  );
}
