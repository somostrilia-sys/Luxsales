import { useState, useEffect, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { supabase } from "@/lib/supabase";
import { EDGE_BASE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";
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
  Phone,
  MessageSquare,
  SendHorizontal,
  Hand,
  RefreshCw,
  Clock,
  History,
  MessageCircle,
  Bell,
} from "lucide-react";
import {
  format,
  formatDistanceToNowStrict,
  isToday,
  isYesterday,
  differenceInMinutes,
} from "date-fns";
import { ptBR } from "date-fns/locale";

const FALLBACK_COMPANY_ID = "70967469-9a9b-4e29-a744-410e41eb47a5"; // Objetivo

interface ConversationItem {
  id: string;
  phone: string;
  lead_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  status: string | null;
  human_mode: boolean;
  ia_mode: boolean;
  window_open: boolean;
  window_expires_at: string | null;
  is_typing: boolean;
  typing_updated_at: string | null;
  lucas_summary: string | null;
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  role: string;
  content: string | null;
  created_at: string;
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

const normalizePhone = (phone: string): string => {
  let digits = phone.replace(/\D/g, "");
  if (!digits.startsWith("55")) digits = "55" + digits;
  return digits;
};

const checkWindowOpen = (expiresAt: string | null): boolean => {
  if (!expiresAt) return false;
  return new Date(expiresAt) > new Date();
};

const getWindowCountdown = (expiresAt: string | null): string | null => {
  if (!expiresAt) return null;
  const d = new Date(expiresAt);
  const now = new Date();
  const minsLeft = differenceInMinutes(d, now);
  if (minsLeft <= 0) return null;
  if (minsLeft < 120) {
    const h = Math.floor(minsLeft / 60);
    const m = minsLeft % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  }
  return null;
};
export default function Conversas() {
  const { collaborator, isCEO, isGestor } = useCollaborator();
  const isMobile = useIsMobile();
  const { selectedCompanyId } = useCompanyFilter();
  const companyId =
    selectedCompanyId && selectedCompanyId !== "all"
      ? selectedCompanyId
      : collaborator?.company_id || FALLBACK_COMPANY_ID;

  const [activeTab, setActiveTab] = useState<"ativas" | "historico">("ativas");
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [lifecycle, setLifecycle] = useState<LifecycleData | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [togglingIa, setTogglingIa] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageTsRef = useRef<string | null>(null);

  const [templateOpen, setTemplateOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [templateTargetPhone, setTemplateTargetPhone] = useState<string | null>(null);

  // Notificações de novas mensagens
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [totalUnread, setTotalUnread] = useState(0);
  const knownConvIdsRef = useRef<Set<string>>(new Set());
  const notifAudioRef = useRef<HTMLAudioElement | null>(null);
  const originalTitleRef = useRef<string>(document.title);
  const titleBlinkRef = useRef<NodeJS.Timeout | null>(null);

  // Som de notificação (beep sintético via Web Audio API)
  const playNotifSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch (_) {}
  }, []);

  // Piscar título da aba
  const startTitleBlink = useCallback((count: number) => {
    if (titleBlinkRef.current) clearInterval(titleBlinkRef.current);
    let show = true;
    titleBlinkRef.current = setInterval(() => {
      document.title = show ? `(${count}) Nova mensagem — LuxSales` : originalTitleRef.current;
      show = !show;
    }, 1000);
  }, []);

  const stopTitleBlink = useCallback(() => {
    if (titleBlinkRef.current) {
      clearInterval(titleBlinkRef.current);
      titleBlinkRef.current = null;
    }
    document.title = originalTitleRef.current;
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      lastMessageTsRef.current = messages[messages.length - 1].created_at;
    }
  }, [messages]);

  const selectedConv = conversations.find((c) => c.id === selectedConvId) ?? null;
  const windowIsOpen = selectedConv ? checkWindowOpen(selectedConv.window_expires_at) : false;

  const loadConversations = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingList(true);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        // CEO vê todas as conversas — sem filtro de empresa ou colaborador
        const isCeoAllView = isCEO;

        let query = supabase
          .from("wa_conversations")
          .select(
            "id, phone, status, turn_count, created_at, last_message, last_message_at, lead_name, human_mode, ia_mode, window_expires_at, lucas_summary, is_typing, typing_updated_at, collaborator_id, assigned_to"
          )
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(150)
          .abortSignal(controller.signal);

        // CEO: sem filtro — vê tudo
        // Gestor: filtra por empresa
        // Consultor: filtra por collaborator_id + empresa
        if (!isCeoAllView) {
          if (isGestor) {
            if (companyId && companyId !== "all") query = query.eq("company_id", companyId);
          } else if (collaborator?.id) {
            query = query.eq("collaborator_id", collaborator.id);
            if (companyId && companyId !== "all") query = query.eq("company_id", companyId);
          } else if (companyId && companyId !== "all") {
            query = query.eq("company_id", companyId);
          }
        }

        const { data, error: convError } = await query;
        let finalData = data;

        if (
          convError &&
          (convError.message?.includes("collaborator_id") ||
            convError.message?.includes("assigned_to"))
        ) {
          if (!isCeoAllView && collaborator?.id) {
            const { data: poolPhones } = await supabase
              .from("consultant_lead_pool")
              .select("phone_number")
              .eq("collaborator_id", collaborator.id)
              .limit(200)
              .abortSignal(controller.signal);
            const phones = (poolPhones || []).map((p: any) => p.phone_number);
            if (phones.length > 0) {
              const { data: fb } = await supabase
                .from("wa_conversations")
                .select(
                  "id, phone, status, turn_count, created_at, last_message, last_message_at, lead_name, human_mode, ia_mode, window_expires_at, lucas_summary, is_typing, typing_updated_at"
                )
                .in("phone", phones)
                .order("last_message_at", { ascending: false, nullsFirst: false })
                .order("created_at", { ascending: false })
                .limit(100)
                .abortSignal(controller.signal);
              finalData = fb;
            } else {
              finalData = [];
            }
          } else {
            const { data: all } = await supabase
              .from("wa_conversations")
              .select(
                "id, phone, status, turn_count, created_at, last_message, last_message_at, lead_name, human_mode, ia_mode, window_expires_at, lucas_summary, is_typing, typing_updated_at"
              )
              .order("last_message_at", { ascending: false, nullsFirst: false })
              .order("created_at", { ascending: false })
              .limit(50)
              .abortSignal(controller.signal);
            finalData = all;
          }
        }

        if (!finalData) {
          if (!silent) setLoadingList(false);
          return;
        }

        const seen = new Map<string, ConversationItem>();
        for (const row of finalData) {
          const norm = normalizePhone(row.phone || "");
          if (!seen.has(norm)) {
            let expiresAt: string | null = (row as any).window_expires_at ?? null;
            if (!expiresAt && (row as any).last_message_at) {
              const lma = new Date((row as any).last_message_at);
              lma.setHours(lma.getHours() + 24);
              expiresAt = lma.toISOString();
            }
            seen.set(norm, {
              id: row.id,
              phone: row.phone,
              lead_name: (row as any).lead_name ?? null,
              last_message: (row as any).last_message ?? null,
              last_message_at: (row as any).last_message_at ?? row.created_at,
              status: row.status,
              human_mode: (row as any).human_mode ?? false,
              ia_mode: (row as any).ia_mode ?? true,
              window_open: checkWindowOpen(expiresAt),
              window_expires_at: expiresAt,
              is_typing: (row as any).is_typing ?? false,
              typing_updated_at: (row as any).typing_updated_at ?? null,
              lucas_summary: (row as any).lucas_summary ?? null,
            });
          }
        }

        const phones = Array.from(seen.values()).map((c) => normalizePhone(c.phone));
        if (phones.length > 0) {
          const { data: lifecycles } = await supabase
            .from("lead_whatsapp_lifecycle")
            .select("phone_number, window_open, window_expires_at")
            .eq("company_id", companyId)
            .in("phone_number", phones)
            .limit(100)
            .abortSignal(controller.signal);

          if (lifecycles) {
            for (const lc of lifecycles) {
              const norm = normalizePhone((lc as any).phone_number || "");
              const item = seen.get(norm);
              if (item) {
                const lcExp = (lc as any).window_expires_at ?? null;
                const lcOpen = (lc as any).window_open === true && checkWindowOpen(lcExp);
                item.window_open = lcOpen;
                if (lcExp) item.window_expires_at = lcExp;
              }
            }
          }
        }

        setConversations(Array.from(seen.values()));
      } catch (e: any) {
        if (e.name !== "AbortError" && !silent)
          toast.error("Erro ao carregar conversas");
      } finally {
        clearTimeout(timer);
        if (!silent) setLoadingList(false);
      }
    },
    [companyId, collaborator, selectedCompanyId, isGestor, isCEO]
  );

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    const interval = setInterval(() => loadConversations(true), 5000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedConvId || !selectedPhone) { setMessages([]); return; }
    const load = async () => {
      setLoadingChat(true);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const { data } = await supabase
          .from("wa_messages")
          .select("id, role, content, created_at")
          .eq("conversation_id", selectedConvId)
          .order("created_at", { ascending: true })
          .limit(500)
          .abortSignal(controller.signal);
        setMessages((data || []) as ChatMessage[]);
      } catch (err) {
        console.error("Erro ao buscar mensagens:", err);
        setMessages([]);
      } finally {
        clearTimeout(timer);
        setLoadingChat(false);
      }
    };
    void load();
  }, [selectedConvId, selectedPhone]);

  useEffect(() => {
    if (!selectedPhone) { setLifecycle(null); return; }
    const loadLifecycle = async () => {
      const norm = normalizePhone(selectedPhone);
      for (const tryPhone of Array.from(new Set([norm, "+" + norm, selectedPhone]))) {
        const { data: lc } = await supabase
          .from("lead_whatsapp_lifecycle")
          .select("stage, sentiment, window_open, window_expires_at, interests, objections, messages_sent, messages_received")
          .eq("phone_number", tryPhone)
          .maybeSingle();
        if (lc) { setLifecycle(lc as LifecycleData); return; }
      }
      setLifecycle(null);
    };
    void loadLifecycle();
  }, [selectedPhone]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (windowIsOpen && selectedConv?.ia_mode === false) inputRef.current?.focus();
  }, [selectedPhone, windowIsOpen, selectedConv?.ia_mode]);

  useEffect(() => {
    const ch = supabase
      .channel("wa-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wa_messages" }, (payload: any) => {
        const msg = payload.new as ChatMessage;
        if (msg.conversation_id === selectedConvId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        } else if (msg.role === "user") {
          // Nova mensagem em conversa não selecionada → notificar
          setUnreadCounts((prev) => {
            const next = { ...prev, [msg.conversation_id]: (prev[msg.conversation_id] ?? 0) + 1 };
            const total = Object.values(next).reduce((a, b) => a + b, 0);
            setTotalUnread(total);
            if (total > 0) startTitleBlink(total);
            return next;
          });
          playNotifSound();
          const conv = conversations.find((c) => c.id === msg.conversation_id);
          const name = conv?.lead_name || conv?.phone || "Lead";
          toast(`💬 Nova mensagem de ${name}`, {
            description: typeof msg.content === "string" ? msg.content.slice(0, 60) : "",
            duration: 5000,
            action: {
              label: "Ver",
              onClick: () => {
                setSelectedConvId(msg.conversation_id);
                setSelectedPhone(conv?.phone ?? null);
                setUnreadCounts((prev) => {
                  const next = { ...prev };
                  delete next[msg.conversation_id];
                  const total = Object.values(next).reduce((a, b) => a + b, 0);
                  setTotalUnread(total);
                  if (total === 0) stopTitleBlink();
                  return next;
                });
              },
            },
          });
        }
        loadConversations(true);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wa_conversations" }, (payload: any) => {
        const conv = payload.new;
        if (!knownConvIdsRef.current.has(conv.id)) {
          knownConvIdsRef.current.add(conv.id);
          if (knownConvIdsRef.current.size > 1) {
            // Nova conversa real (não o carregamento inicial)
            playNotifSound();
            toast(`🆕 Nova conversa: ${conv.lead_name || conv.phone}`, {
              description: "Lead iniciou contato",
              duration: 6000,
            });
          }
        }
        loadConversations(true);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wa_conversations" }, () => loadConversations(true))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedConvId, loadConversations, conversations, playNotifSound, startTitleBlink, stopTitleBlink]);

  // Ao selecionar conversa → limpar unread dela
  useEffect(() => {
    if (!selectedConvId) return;
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[selectedConvId];
      const total = Object.values(next).reduce((a, b) => a + b, 0);
      setTotalUnread(total);
      if (total === 0) stopTitleBlink();
      return next;
    });
  }, [selectedConvId, stopTitleBlink]);

  // Inicializar knownConvIds quando conversas carregam
  useEffect(() => {
    conversations.forEach((c) => knownConvIdsRef.current.add(c.id));
  }, [conversations]);

  // Cleanup título ao desmontar
  useEffect(() => {
    return () => stopTitleBlink();
  }, [stopTitleBlink]);

  // Polling de fallback: recarrega lista a cada 10s independente do realtime
  useEffect(() => {
    const interval = setInterval(() => { loadConversations(true); }, 10000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedConvId) return;
    const interval = setInterval(async () => {
      const since = lastMessageTsRef.current;
      if (!since) return;
      const { data } = await supabase
        .from("wa_messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", selectedConvId)
        .gt("created_at", since)
        .order("created_at", { ascending: true })
        .limit(50);
      if (data && data.length > 0) {
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          const newMsgs = (data as ChatMessage[]).filter((m) => !ids.has(m.id));
          return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
        });
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedConvId]);

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: "Bearer " + session?.access_token,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "",
    };
  }, []);

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedPhone || sending) return;
    if (!windowIsOpen) {
      toast.error("Janela encerrada — envie um template aprovado");
      return;
    }
    if (selectedConv?.ia_mode !== false) {
      toast.error("Assuma a conversa antes de enviar mensagens");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(
        "https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/send-meta-message",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: normalizePhone(selectedPhone), message: messageText, company_id: companyId }),
        }
      );
      if (res.ok) {
        const sentMsg: ChatMessage = {
          id: crypto.randomUUID(),
          conversation_id: selectedConvId || "",
          role: "assistant",
          content: messageText,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, sentMsg]);
        setMessageText("");
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Erro ao enviar mensagem");
      }
    } catch {
      toast.error("Erro de conexão");
    }
    setSending(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const toggleIaMode = async (newIaMode: boolean) => {
    if (!selectedConvId) return;
    setTogglingIa(true);
    const { error } = await supabase
      .from("wa_conversations")
      .update({ ia_mode: newIaMode, updated_at: new Date().toISOString() })
      .eq("id", selectedConvId);
    if (error) {
      toast.error("Erro ao alterar modo de atendimento");
    } else {
      setConversations((prev) =>
        prev.map((c) => (c.id === selectedConvId ? { ...c, ia_mode: newIaMode } : c))
      );
      toast.success(newIaMode ? "🤖 Lucas assumiu a conversa novamente" : "✋ Você assumiu a conversa — Lucas pausado");
    }
    setTogglingIa(false);
  };

  const openTemplateModal = async (targetPhone?: string) => {
    setTemplateTargetPhone(targetPhone ?? selectedPhone);
    const { data } = await supabase
      .from("whatsapp_meta_templates")
      .select("name, status, language")
      .eq("company_id", companyId)
      .eq("status", "APPROVED");
    setTemplates((data || []) as TemplateItem[]);
    setTemplateOpen(true);
  };

  const sendTemplate = async (templateName: string) => {
    const phone = templateTargetPhone || selectedPhone;
    if (!phone) return;
    try {
      const headers = await getHeaders();
      const res = await fetch(EDGE_BASE + "/smart-dispatcher", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "send-by-slot", company_id: companyId, phone_number: phone, template_name: templateName }),
      });
      if (res.ok) {
        toast.success("Template enviado!");
        setTemplateOpen(false);
        setTemplateTargetPhone(null);
        setTimeout(() => loadConversations(true), 1500);
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Erro ao enviar template");
      }
    } catch {
      toast.error("Erro ao enviar template");
    }
  };

  const formatRelativeListTs = (ts: string) => {
    const d = new Date(ts);
    if (isToday(d)) return formatDistanceToNowStrict(d, { addSuffix: true, locale: ptBR });
    if (isYesterday(d)) return "Ontem";
    return format(d, "dd/MM/yy");
  };

  const formatPhone = (phone: string) => {
    const onlyDigits = phone.replace(/\D/g, "");
    if (onlyDigits.length >= 12) {
      return "+" + onlyDigits.slice(0, 2) + " " + onlyDigits.slice(2, 4) + " " + onlyDigits.slice(4, 9) + "-" + onlyDigits.slice(9, 13);
    }
    if (onlyDigits.length >= 11) {
      return "(" + onlyDigits.slice(0, 2) + ") " + onlyDigits.slice(2, 7) + "-" + onlyDigits.slice(7, 11);
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

  const filteredAtivas = conversations
    .filter((c) => c.window_open || checkWindowOpen(c.window_expires_at))
    .filter((c) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return c.lead_name?.toLowerCase().includes(q) || c.phone.includes(q);
    });

  const filteredHistorico = conversations
    .filter((c) => !c.window_open && !checkWindowOpen(c.window_expires_at))
    .filter((c) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return c.lead_name?.toLowerCase().includes(q) || c.phone.includes(q);
    });

  const displayList = activeTab === "ativas" ? filteredAtivas : filteredHistorico;

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
                {lifecycle.interests.map((i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{i}</Badge>
                ))}
              </div>
            </div>
          )}
          {lifecycle.objections && lifecycle.objections.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Objeções</p>
              <div className="flex flex-wrap gap-1">
                {lifecycle.objections.map((o) => (
                  <Badge key={o} variant="destructive" className="text-xs">{o}</Badge>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Sem dados de lifecycle</p>
      )}

      {selectedConv?.lucas_summary && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-1">Resumo do Lucas</p>
          <p className="text-xs text-foreground leading-relaxed">{selectedConv.lucas_summary}</p>
        </div>
      )}

      <div className="pt-2 space-y-2">
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={async () => {
            if (selectedPhone) {
              try {
                const headers = await getHeaders();
                await fetch(EDGE_BASE + "/make-call", {
                  method: "POST",
                  headers,
                  body: JSON.stringify({ action: "dial", to: selectedPhone }),
                });
                toast.success("Ligação iniciada");
              } catch {
                toast.error("Erro");
              }
            }
          }}
        >
          <Phone className="h-3.5 w-3.5" /> Ligar
        </Button>
      </div>
    </div>
  );

  const renderConversationList = () => (
    <div className="flex h-full flex-col wa-surface" style={{ borderRight: "1px solid #e9edef" }}>
      <div className="wa-header-green flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-white">Conversas</h2>
          {totalUnread > 0 && (
            <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold animate-pulse"
              style={{ background: "#25d366", color: "#fff" }}>
              <Bell className="h-3 w-3" />
              {totalUnread}
            </span>
          )}
        </div>
      </div>

      <div className="px-2 py-1.5" style={{ background: "#f0f2f5" }}>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4" style={{ color: "#54656f" }} />
          <input
            placeholder="Buscar conversa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-lg border-none pl-9 pr-3 text-[13px] outline-none"
            style={{ background: "#ffffff", color: "#111b21" }}
          />
        </div>
      </div>

      {/* TAREFA 4.2 — Abas */}
      <div className="flex" style={{ background: "#f0f2f5", borderBottom: "1px solid #e9edef" }}>
        <button
          onClick={() => setActiveTab("ativas")}
          className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[13px] font-medium transition-colors"
          style={{
            borderBottom: activeTab === "ativas" ? "2px solid #005c4b" : "2px solid transparent",
            color: activeTab === "ativas" ? "#005c4b" : "#667781",
          }}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Ativas
          {filteredAtivas.length > 0 && (
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "#005c4b", color: "#fff" }}>
              {filteredAtivas.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("historico")}
          className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[13px] font-medium transition-colors"
          style={{
            borderBottom: activeTab === "historico" ? "2px solid #005c4b" : "2px solid transparent",
            color: activeTab === "historico" ? "#005c4b" : "#667781",
          }}
        >
          <History className="h-3.5 w-3.5" />
          Histórico
          {filteredHistorico.length > 0 && (
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "#667781", color: "#fff" }}>
              {filteredHistorico.length}
            </span>
          )}
        </button>
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
        ) : displayList.length === 0 ? (
          <div className="p-8 text-center" style={{ color: "#667781" }}>
            {activeTab === "ativas" ? (
              <>
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Nenhuma conversa ativa.</p>
                <p className="text-xs mt-1">Leads respondendo aparecem aqui.</p>
              </>
            ) : (
              <>
                <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Nenhum histórico.</p>
                <p className="text-xs mt-1">Conversas encerradas (janela expirada).</p>
              </>
            )}
          </div>
        ) : (
          <div>
            {displayList.map((c) => {
              const avatar = getAvatarTone(c.phone);
              const isHistorico = activeTab === "historico";
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedConvId(c.id);
                    setSelectedPhone(c.phone);
                    setMessageText("");
                  }}
                  className={cn(
                    "wa-row-hover flex w-full items-center gap-3 px-3 py-[10px] text-left transition-colors",
                    selectedConvId === c.id && "wa-row-selected"
                  )}
                  style={{ borderBottom: "1px solid #e9edef" }}
                >
                  <div
                    className="relative flex h-[49px] w-[49px] shrink-0 items-center justify-center rounded-full text-base font-medium"
                    style={{ background: avatar.bg, color: avatar.fg }}
                  >
                    {c.lead_name ? c.lead_name.slice(0, 1).toUpperCase() : "👤"}
                    {!isHistorico && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full wa-window-dot" style={{ border: "2px solid #fff" }} />
                    )}
                    {isHistorico && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full" style={{ background: "#ef4444", border: "2px solid #fff" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[15px] wa-text-main" style={{ fontWeight: 500 }}>
                        {c.lead_name || formatPhone(c.phone)}
                      </p>
                      <span className="shrink-0 text-[12px] wa-text-muted">
                        {c.last_message_at ? formatRelativeListTs(c.last_message_at) : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <p className="truncate text-[13px] wa-text-muted flex-1">
                        {isHistorico
                          ? "Janela encerrada — reativar com template"
                          : c.last_message || "..."}
                      </p>
                      {!isHistorico && unreadCounts[c.id] ? (
                        <span className="shrink-0 flex items-center justify-center rounded-full min-w-[20px] h-5 px-1 text-[11px] font-bold" style={{ background: "#25d366", color: "#fff" }}>
                          {unreadCounts[c.id]}
                        </span>
                      ) : c.ia_mode === false && !isHistorico ? (
                        <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: "#fef3c7", color: "#92400e" }}>
                          Humano
                        </span>
                      ) : null}
                    </div>
                    {isHistorico && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openTemplateModal(c.phone);
                        }}
                        className="mt-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors"
                        style={{ background: "#005c4b", color: "#fff" }}
                      >
                        Reativar
                      </button>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

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
    if (!selectedPhone) return renderEmptyState();

    const conv = selectedConv;
    const title = conv?.lead_name || formatPhone(selectedPhone);
    const avatar = getAvatarTone(selectedPhone);
    const isTyping =
      conv?.is_typing === true &&
      conv?.typing_updated_at != null &&
      new Date().getTime() - new Date(conv.typing_updated_at).getTime() < 10000;

    const isHistoricoConv = !windowIsOpen;
    const iaActive = conv?.ia_mode !== false;
    const countdown = getWindowCountdown(conv?.window_expires_at ?? null);

    return (
      <div className="flex h-full flex-1 flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 flex h-[60px] shrink-0 items-center justify-between px-4"
          style={{ background: "#f0f2f5", borderBottom: "1px solid #e0e0e0" }}>
          <div className="flex items-center gap-3">
            {isMobile && (
              <button onClick={() => { setSelectedPhone(null); setSelectedConvId(null); }} className="mr-1">
                <ArrowLeft className="h-5 w-5" style={{ color: "#54656f" }} />
              </button>
            )}
            <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium"
              style={{ background: avatar.bg, color: avatar.fg }}>
              {title.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="text-[16px]" style={{ fontWeight: 500, color: "#111b21" }}>{title}</p>
              {isTyping
                ? <p className="text-[12px]" style={{ color: "#008069" }}>digitando...</p>
                : <p className="text-[12px]" style={{ color: "#111b21" }}>{formatPhone(selectedPhone)}</p>
              }
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lifecycle?.stage && (
              <span className="rounded-full px-2 py-0.5 text-[11px] font-medium capitalize"
                style={{ background: "#e1f2fb", color: "#008069" }}>
                {lifecycle.stage.replace("_", " ")}
              </span>
            )}
            {/* TAREFA 4.1 — Badge janela Meta */}
            {windowIsOpen ? (
              <div className="group relative">
                <span className="rounded-full px-2 py-0.5 text-[11px] font-medium wa-window-open flex items-center gap-1 cursor-help">
                  <span className="h-1.5 w-1.5 rounded-full wa-window-dot" />
                  Janela aberta até {conv?.window_expires_at ? format(new Date(conv.window_expires_at), "dd/MM HH:mm", { locale: ptBR }) : "—"}
                </span>
                <div className="absolute right-0 top-7 z-20 hidden group-hover:block w-60 rounded-lg p-2 text-xs shadow-lg"
                  style={{ background: "#111b21", color: "#e9edef" }}>
                  <p className="font-medium mb-1">Expira: {conv?.window_expires_at ? format(new Date(conv.window_expires_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "—"}</p>
                  <p className="opacity-70">Se o lead chamar de volta, a janela se abre novamente por mais 24h</p>
                </div>
              </div>
            ) : (
              <span className="rounded-full px-2 py-0.5 text-[11px] font-medium wa-window-closed">
                Janela expirada
              </span>
            )}
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

        {/* TAREFA 4.3 — Banner Lucas / Assumir conversa */}
        {windowIsOpen && (
          <div className="shrink-0">
            {iaActive ? (
              <div className="flex items-center justify-between px-4 py-2 text-[13px]"
                style={{ background: "#fef9c3", borderBottom: "1px solid #fde047" }}>
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4" style={{ color: "#92400e" }} />
                  <span style={{ color: "#92400e", fontWeight: 500 }}>
                    Lucas está respondendo automaticamente
                  </span>
                </div>
                <button
                  onClick={() => toggleIaMode(false)}
                  disabled={togglingIa}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-[12px] font-semibold transition-colors"
                  style={{ background: "#92400e", color: "#fff" }}
                >
                  {togglingIa ? <Loader2 className="h-3 w-3 animate-spin" /> : <Hand className="h-3 w-3" />}
                  Assumir conversa
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between px-4 py-2 text-[13px]"
                style={{ background: "#dcfce7", borderBottom: "1px solid #86efac" }}>
                <div className="flex items-center gap-2">
                  <Hand className="h-4 w-4" style={{ color: "#166534" }} />
                  <span style={{ color: "#166534", fontWeight: 500 }}>
                    Você está atendendo esta conversa
                  </span>
                </div>
                <button
                  onClick={() => toggleIaMode(true)}
                  disabled={togglingIa}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-[12px] font-semibold transition-colors"
                  style={{ background: "#166534", color: "#fff" }}
                >
                  {togglingIa ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
                  Devolver ao Lucas
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAREFA 4.5 — Countdown se janela expira em < 2h */}
        {windowIsOpen && countdown && (
          <div className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 text-[12px]"
            style={{ background: "#fff7ed", borderBottom: "1px solid #fed7aa" }}>
            <Clock className="h-3 w-3" style={{ color: "#c2410c" }} />
            <span style={{ color: "#c2410c" }}>
              Atenção: janela expira em <strong>{countdown}</strong> — responda logo!
            </span>
          </div>
        )}

        {/* TAREFA 4.4 — Banner histórico */}
        {isHistoricoConv && messages.length > 0 && (
          <div className="shrink-0 flex items-center justify-between px-4 py-2 text-[13px]"
            style={{ background: "#fef2f2", borderBottom: "1px solid #fecaca" }}>
            <div className="flex items-center gap-2">
              <History className="h-4 w-4" style={{ color: "#dc2626" }} />
              <span style={{ color: "#dc2626" }}>
                Conversa encerrada — janela de 24h expirada
              </span>
            </div>
            <button
              onClick={() => openTemplateModal()}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-[12px] font-semibold"
              style={{ background: "#dc2626", color: "#fff" }}
            >
              <RefreshCw className="h-3 w-3" />
              Reativar lead
            </button>
          </div>
        )}

        {/* TAREFA 4.4 — Resumo Lucas no histórico */}
        {isHistoricoConv && selectedConv?.lucas_summary && (
          <div className="shrink-0 mx-4 my-2 rounded-lg p-3 text-[12px]"
            style={{ background: "#f0fdf4", border: "1px solid #86efac" }}>
            <p className="font-semibold mb-1" style={{ color: "#166534" }}>
              <Bot className="inline h-3 w-3 mr-1" />
              Resumo do Lucas
            </p>
            <p style={{ color: "#15803d" }}>{selectedConv.lucas_summary}</p>
          </div>
        )}

        {/* Messages */}
        <div className="wa-chat-pattern wa-chat-scrollbar flex-1 overflow-y-auto px-[4%] py-3">
          {loadingChat ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#008069" }} />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex justify-center py-10 text-muted-foreground">Nenhuma mensagem</div>
          ) : (
            messages.map((msg, index) => {
              const isUser = msg.role === "user";
              const previous = messages[index - 1];
              const showDateSeparator =
                !previous ||
                new Date(previous.created_at).toDateString() !== new Date(msg.created_at).toDateString();

              return (
                <div key={msg.id} className="mb-1">
                  {showDateSeparator && (
                    <div className="flex justify-center py-2 mb-1">
                      <span className="wa-date-sep">{getDateSeparatorLabel(msg.created_at)}</span>
                    </div>
                  )}
                  <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                    <div
                      className={cn("max-w-[65%]", isUser ? "wa-bubble-outbound" : "wa-bubble-inbound")}
                      style={{ padding: "6px 7px 8px 9px" }}
                    >
                      {!isUser && (
                        <div className="mb-0.5 flex items-center gap-1">
                          <Bot className="h-3 w-3" style={{ color: "#667781" }} />
                          <span className="text-[10px]" style={{ color: "#667781" }}>Lucas</span>
                        </div>
                      )}
                      <p className="whitespace-pre-wrap" style={{ fontSize: "14.2px", color: "#e9edef", lineHeight: 1.4 }}>
                        {msg.content || "[mensagem]"}
                      </p>
                      <div className="flex items-center justify-end gap-1 -mb-1" style={{ marginLeft: "8px", float: "right", marginTop: "2px" }}>
                        <span style={{ fontSize: "11px", color: "#667781" }}>
                          {format(new Date(msg.created_at), "HH:mm")}
                        </span>
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
          {windowIsOpen ? (
            <div>
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={iaActive ? "Lucas está respondendo... assuma para digitar" : "Digite uma mensagem"}
                  className="flex-1 outline-none"
                  style={{
                    background: iaActive ? "#f3f4f6" : "#ffffff",
                    borderRadius: "8px",
                    border: "none",
                    padding: "9px 12px",
                    fontSize: "15px",
                    color: iaActive ? "#9ca3af" : "#111b21",
                    cursor: iaActive ? "not-allowed" : "text",
                  }}
                  value={messageText}
                  onChange={(e) => !iaActive && setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !iaActive) { e.preventDefault(); void sendMessage(); }
                  }}
                  disabled={sending || iaActive}
                  readOnly={iaActive}
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !messageText.trim() || iaActive}
                  className="wa-send-btn flex h-10 w-10 items-center justify-center rounded-full"
                >
                  {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizontal className="h-5 w-5" />}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="wa-window-closed mb-1.5 rounded px-2 py-1 text-[11px] flex items-center gap-1.5">
                <span>Janela de 24h encerrada — envie um template aprovado para reativar</span>
              </div>
              <button
                className="wa-template-btn w-full rounded-lg px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2"
                onClick={() => openTemplateModal()}
              >
                <RefreshCw className="h-4 w-4" />
                Reativar com template
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTemplateModal = () => (
    <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Selecionar Template Aprovado</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-2">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum template aprovado encontrado
              </p>
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
