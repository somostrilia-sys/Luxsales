import { useState, useEffect, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { toast } from "sonner";
import {
  Send, Loader2, ArrowLeft, Search, Phone, MessageCircle,
  Smartphone, Clock, User, ChevronRight, RefreshCw
} from "lucide-react";

import { EDGE_BASE } from "@/lib/constants";

// ── Types ──

interface Conversation {
  id: string;
  consultant_id: string | null;
  lead_phone: string;
  lead_id: string | null;
  chip_id: string | null;
  chip_instance_token: string | null;
  last_message: string | null;
  last_message_at: string | null;
  status: string | null;
  unread_count: number | null;
  created_at: string | null;
}

interface Message {
  id: string;
  conversation_id: string | null;
  sender: string;
  content: string | null;
  delivery_status: string | null;
  channel_type: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string | null;
  direction?: string | null;
  chip_id?: string | null;
}

interface ChipInfo {
  id: string;
  chip_index: number;
  phone: string | null;
  status: string;
  instance_token: string | null;
}

// ── Backend API base ──
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

// ── Helpers ──

function formatPhone(phone: string) {
  if (!phone) return "";
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 13) return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  if (clean.length === 11) return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  return phone;
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ── Main Component ──

export default function AtendimentoLeads() {
  const { collaborator, roleLevel } = useCollaborator();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [search, setSearch] = useState("");
  const [chipInfo, setChipInfo] = useState<ChipInfo | null>(null);
  const [polling, setPolling] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Load conversations ──
  const loadConversations = useCallback(async () => {
    if (!collaborator) return;
    setLoadingConvs(true);

    let query = supabase
      .from("conversations")
      .select("*")
      .order("last_message_at", { ascending: false });

    // Non-admin users see only their own conversations
    if (roleLevel > 1) {
      query = query.eq("consultant_id", collaborator.id);
    }

    const { data, error } = await query;
    if (error) {
      toast.error("Erro ao carregar conversas");
      console.error(error);
    }
    setConversations((data as Conversation[]) || []);
    setLoadingConvs(false);
  }, [collaborator, roleLevel]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ── Poll UAZAPI and refresh ──────────────────────────────────────────────
  const pollAndRefresh = useCallback(async () => {
    if (polling) return;
    setPolling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        await fetch(`${EDGE_BASE}/poll-whatsapp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(25000),
        }).catch(() => null);
      }
      await loadConversations();
    } catch {
      // silently ignore
    } finally {
      setPolling(false);
    }
  }, [polling, loadConversations]);

  // Auto-refresh every 2 minutes while page is open
  useEffect(() => {
    const interval = setInterval(() => {
      pollAndRefresh();
    }, 120000);
    return () => clearInterval(interval);
  }, [pollAndRefresh]);

  // ── Supabase Realtime subscription for new messages ──
  useEffect(() => {
    if (!collaborator) return;

    const channel = supabase
      .channel("conversations-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          ...(roleLevel > 1 ? { filter: `consultant_id=eq.${collaborator.id}` } : {}),
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setConversations((prev) => [payload.new as Conversation, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Conversation;
            setConversations((prev) => {
              const filtered = prev.filter((c) => c.id !== updated.id);
              return [updated, ...filtered];
            });
            // Update selected conversation if it's the one being updated
            setSelectedConv((prev) =>
              prev?.id === updated.id ? updated : prev
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [collaborator, roleLevel]);

  // ── Realtime for messages in selected conversation ──
  useEffect(() => {
    if (!selectedConv) return;

    const channel = supabase
      .channel(`messages-${selectedConv.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConv.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConv?.id]);

  // ── Load messages for selected conversation ──
  const openConversation = async (conv: Conversation) => {
    setSelectedConv(conv);
    setMessages([]);
    setLoadingMsgs(true);

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar mensagens");
    }
    setMessages((data as Message[]) || []);
    setLoadingMsgs(false);

    // Mark as read — reset unread count
    if (conv.unread_count && conv.unread_count > 0) {
      await supabase
        .from("conversations")
        .update({ unread_count: 0 })
        .eq("id", conv.id);
    }

    // Load chip info
    if (conv.chip_id) {
      const { data: chip } = await supabase
        .from("disposable_chips")
        .select("id, chip_index, phone, status, instance_token")
        .eq("id", conv.chip_id)
        .maybeSingle();
      setChipInfo(chip as ChipInfo | null);
    } else if (conv.chip_instance_token) {
      // Fallback: buscar chip pelo instance_token (quando chip_id é null)
      const { data: chip } = await supabase
        .from("disposable_chips")
        .select("id, chip_index, phone, status, instance_token")
        .eq("instance_token", conv.chip_instance_token)
        .maybeSingle();
      setChipInfo(chip as ChipInfo | null);
    } else {
      setChipInfo(null);
    }

    setTimeout(() => {
      scrollToBottom();
      inputRef.current?.focus();
    }, 100);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  // ── Send message ──
  const sendMessage = async () => {
    if (!input.trim() || !selectedConv || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);

    // Optimistic UI — add message immediately
    const tempId = crypto.randomUUID();
    const tempMsg: Message = {
      id: tempId,
      conversation_id: selectedConv.id,
      sender: "consultant",
      content,
      delivery_status: "sending",
      channel_type: "whatsapp",
      media_url: null,
      media_type: null,
      created_at: new Date().toISOString(),
      direction: "outbound",
    };
    setMessages((prev) => [...prev, tempMsg]);
    scrollToBottom();

    try {
      // Save message to DB
      const { data: savedMsg, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: selectedConv.id,
          sender: "consultant",
          content,
          delivery_status: "sent",
          channel_type: "whatsapp",
        })
        .select()
        .single();

      if (error) throw error;

      // Send via edge function (anti-ban: edge function resolves the correct chip)
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessão expirada");

      await fetch(`${EDGE_BASE}/send-whatsapp-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          conversation_id: selectedConv.id,
          phone: selectedConv.lead_phone,
          message: content,
        }),
      });

      // Replace temp message
      if (savedMsg) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? (savedMsg as Message) : m))
        );
      }

      // Update conversation last message
      await supabase
        .from("conversations")
        .update({
          last_message: content,
          last_message_at: new Date().toISOString(),
          status: "active",
        })
        .eq("id", selectedConv.id);
    } catch (e: any) {
      toast.error("Erro ao enviar: " + (e.message || "falha de conexão"));
      // Mark temp message as failed
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, delivery_status: "failed" } : m))
      );
    }

    setSending(false);
    scrollToBottom();
  };

  // ── Filtered conversations ──
  const filteredConvs = conversations.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.lead_phone?.toLowerCase().includes(s) ||
      c.last_message?.toLowerCase().includes(s)
    );
  });

  // ── Determine if message is from consultant ──
  const isOutbound = (msg: Message) => {
    if (msg.direction === "outbound") return true;
    if (msg.sender === "consultant" || msg.sender === "bot" || msg.sender === "system") return true;
    return false;
  };

  // ── Status badge ──
  const statusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Ativo</Badge>;
      case "handed_off":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">Em atendimento</Badge>;
      case "closed":
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-[10px]">Fechado</Badge>;
      default:
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">Novo</Badge>;
    }
  };

  // ── Chat view (selected conversation) ──
  if (selectedConv) {
    return (
      <DashboardLayout>
        <div className="flex flex-col h-[calc(100vh-6rem)]">
          {/* Header */}
          <div className="flex items-center gap-3 pb-3 border-b border-border shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setSelectedConv(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Phone className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm truncate">
                  {formatPhone(selectedConv.lead_phone)}
                </h2>
                {statusBadge(selectedConv.status)}
              </div>
              {chipInfo && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Smartphone className="h-3 w-3" />
                  Chip #{chipInfo.chip_index}
                  {chipInfo.phone && ` (${chipInfo.phone})`}
                  <span className={`ml-1 w-1.5 h-1.5 rounded-full inline-block ${
                    chipInfo.status === "connected" ? "bg-emerald-500" : "bg-red-500"
                  }`} />
                </p>
              )}
            </div>
          </div>

          {/* Messages area */}
          <ScrollArea className="flex-1 py-3">
            <div className="space-y-3 max-w-3xl mx-auto px-2">
              {loadingMsgs ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Nenhuma mensagem nesta conversa
                </div>
              ) : (
                messages.map((msg) => {
                  const outbound = isOutbound(msg);
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${outbound ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                          outbound
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted text-foreground rounded-bl-md"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <div className={`flex items-center gap-1 mt-1 ${outbound ? "justify-end" : "justify-start"}`}>
                          <span className="text-[10px] opacity-60">
                            {msg.created_at
                              ? new Date(msg.created_at).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </span>
                          {outbound && msg.delivery_status && (
                            <span className="text-[10px] opacity-60">
                              {msg.delivery_status === "sending" ? "..." :
                               msg.delivery_status === "sent" ? "✓" :
                               msg.delivery_status === "delivered" ? "✓✓" :
                               msg.delivery_status === "read" ? "✓✓" :
                               msg.delivery_status === "failed" ? "✗" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input area */}
          <div className="pt-3 border-t border-border shrink-0">
            <div className="flex gap-2 max-w-3xl mx-auto">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  chipInfo?.status === "connected"
                    ? "Digite sua resposta..."
                    : "Chip desconectado — reconecte para enviar"
                }
                disabled={chipInfo?.status !== "connected" && !!chipInfo}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                className="bg-background"
              />
              <Button
                onClick={sendMessage}
                disabled={sending || !input.trim() || (!!chipInfo && chipInfo.status !== "connected")}
                className="btn-modern px-4"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ── Conversation list view ──
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <PageHeader
          title="Atendimento de Leads"
          subtitle="Responda leads diretamente pelo painel — as mensagens saem pelo chip que iniciou o contato"
        />

        {/* Search + Atualizar */}
        <div className="flex gap-2 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por telefone ou mensagem..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={pollAndRefresh}
            disabled={polling}
            title="Buscar novas respostas de leads"
          >
            {polling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-1.5 hidden sm:inline">Atualizar</span>
          </Button>
        </div>

        {/* Conversations list */}
        {loadingConvs ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredConvs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto opacity-40" />
              <p className="text-muted-foreground">
                {search ? "Nenhuma conversa encontrada" : "Nenhuma conversa de lead ainda"}
              </p>
              <p className="text-xs text-muted-foreground">
                Quando um lead responder a um disparo, a conversa aparecerá aqui
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1">
            {filteredConvs.map((conv) => (
              <button
                key={conv.id}
                onClick={() => openConversation(conv)}
                className={`w-full text-left border rounded-lg p-3 transition-colors flex items-center gap-3 ${
                  conv.unread_count && conv.unread_count > 0
                    ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10"
                    : "border-border hover:bg-muted/30"
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  {conv.unread_count && conv.unread_count > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">{conv.unread_count}</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">
                      {formatPhone(conv.lead_phone)}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeAgo(conv.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.last_message || "Sem mensagens"}
                    </p>
                    {statusBadge(conv.status)}
                  </div>
                </div>

                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
