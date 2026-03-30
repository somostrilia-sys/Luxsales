import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { EDGE_BASE } from "@/lib/constants";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Phone, MessageSquare, ChevronDown, ChevronUp,
  Loader2, RefreshCw, Send, Mic, Search,
  CheckCircle2, XCircle,
} from "lucide-react";
import { format, formatDistanceToNowStrict, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CallLog {
  id: string;
  lead_phone: string | null;
  lead_name: string | null;
  status: string | null;
  duration_sec: number | null;
  transcript: unknown;
  result: string | null;
  started_at: string | null;
  created_at: string;
  goal_achieved: boolean | null;
  sentiment_overall: string | null;
  lead_temperature: string | null;
  next_action: string | null;
  company_id: string | null;
  voice_key: string | null;
}

interface WaConversation {
  id: string;
  phone: string;
  lead_name: string | null;
  status: string | null;
  window_expires_at: string | null;
  last_message: string | null;
  last_message_at: string | null;
  turn_count: number;
  lucas_summary: string | null;
  company_id: string | null;
  analysis: unknown;
}

interface WaMessage {
  id: string;
  conversation_id: string;
  role: string;
  content: string | null;
  created_at: string;
}

interface TemplateItem {
  name: string;
  status: string;
  language: string;
}

interface TimelineItem {
  id: string;
  type: "call" | "wa_message" | "dispatch";
  timestamp: string;
  label: string;
  detail: string;
  sub?: string;
  icon: "phone" | "chat" | "send";
  positive?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(sec: number | null) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtDate(dt: string | null) {
  if (!dt) return "—";
  return format(new Date(dt), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

function fmtRelative(dt: string | null) {
  if (!dt) return "";
  return formatDistanceToNowStrict(new Date(dt), { locale: ptBR, addSuffix: true });
}

function getTranscriptText(transcript: unknown): string {
  if (!transcript) return "";
  if (typeof transcript === "string") return transcript;
  if (Array.isArray(transcript)) {
    return transcript
      .map((t: Record<string, unknown>) => `${String(t.role || t.speaker || "")}: ${String(t.text || t.content || "")}`)
      .join("\n");
  }
  if (typeof transcript === "object" && transcript !== null) {
    const t = transcript as Record<string, unknown>;
    if (t.text) return String(t.text);
    if (t.summary) return String(t.summary);
  }
  return JSON.stringify(transcript, null, 2);
}

function getSummaryText(transcript: unknown): string {
  if (!transcript || typeof transcript !== "object" || Array.isArray(transcript)) return "";
  const t = transcript as Record<string, unknown>;
  if (t.summary) return String(t.summary);
  if (t.lucas_summary) return String(t.lucas_summary);
  return "";
}

const callStatusConfig: Record<string, { label: string; cls: string }> = {
  completed: { label: "Concluída", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  failed: { label: "Falhou", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  no_answer: { label: "Não Atendeu", cls: "bg-muted text-muted-foreground border-border" },
  calling: { label: "Chamando", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  simulated: { label: "Simulado", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
};

const FALLBACK_COMPANY = "d33b6a84-8f72-4441-b2eb-dd151a31ac12";

// ─── Template Picker Dialog ───────────────────────────────────────────────────

function TemplatePickerDialog({
  open,
  onOpenChange,
  templates,
  sending,
  title,
  onSend,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templates: TemplateItem[];
  sending: boolean;
  title: string;
  onSend: (name: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum template aprovado encontrado</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {templates.map((t) => (
              <div
                key={t.name}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                onClick={() => !sending && onSend(t.name)}
              >
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.language}</p>
                </div>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Aba 1: Transcrições ──────────────────────────────────────────────────────

function TabTranscricoes({ companyId, roleLevel, collaboratorCompanyId }: { companyId: string; roleLevel: number; collaboratorCompanyId?: string }) {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("week");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [targetPhone, setTargetPhone] = useState<string | null>(null);
  const [sendingTemplate, setSendingTemplate] = useState(false);

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("call_logs")
        .select(
          "id, lead_phone, lead_name, status, duration_sec, transcript, result, started_at, created_at, goal_achieved, sentiment_overall, lead_temperature, next_action, company_id, voice_key"
        )
        .order("created_at", { ascending: false })
        .limit(100);

      const now = new Date();
      if (period === "today") {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        query = query.gte("created_at", start.toISOString());
      } else if (period === "week") {
        const start = new Date(now);
        start.setDate(now.getDate() - 7);
        query = query.gte("created_at", start.toISOString());
      } else if (period === "month") {
        const start = new Date(now);
        start.setDate(now.getDate() - 30);
        query = query.gte("created_at", start.toISOString());
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (roleLevel > 0 && collaboratorCompanyId) {
        query = query.eq("company_id", collaboratorCompanyId);
      } else if (companyId && companyId !== "all") {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setCalls((data as CallLog[]) || []);
    } catch (err) {
      console.error("Error fetching calls:", err);
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, period, statusFilter, roleLevel, collaboratorCompanyId]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  const openTemplateDialog = async (phone: string) => {
    setTargetPhone(phone);
    const { data } = await supabase
      .from("whatsapp_meta_templates")
      .select("name, status, language")
      .eq("company_id", companyId)
      .eq("status", "APPROVED");
    setTemplates((data as TemplateItem[]) || []);
    setTemplateOpen(true);
  };

  const sendTemplate = async (templateName: string) => {
    if (!targetPhone) return;
    setSendingTemplate(true);
    try {
      const session = await supabase.auth.getSession();
      const res = await fetch(`${EDGE_BASE}/send-meta-template`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({
          action: "send-by-slot",
          company_id: companyId,
          phone_number: targetPhone,
          template_name: templateName,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erro ao enviar");
      toast.success("Template enviado com sucesso!");
      setTemplateOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar template");
    } finally {
      setSendingTemplate(false);
    }
  };

  const toggleExpand = (id: string) =>
    setExpanded((prev) => (prev === id ? null : id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Última semana</SelectItem>
            <SelectItem value="month">Último mês</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="completed">Concluída</SelectItem>
            <SelectItem value="no_answer">Não Atendeu</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
            <SelectItem value="simulated">Simulado</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchCalls} className="h-8">
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {calls.length} ligações
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : calls.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Phone className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Nenhum registro ainda</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {calls.map((call) => {
            const isExpanded = expanded === call.id;
            const status =
              callStatusConfig[call.status || ""] || {
                label: call.status || "—",
                cls: "bg-muted text-muted-foreground border-border",
              };
            const transcriptText = getTranscriptText(call.transcript);
            const summaryText = getSummaryText(call.transcript);
            const phone = call.lead_phone || "—";
            const name = call.lead_name || phone;

            return (
              <Card
                key={call.id}
                className={cn(
                  "transition-all",
                  isExpanded && "ring-1 ring-primary/30"
                )}
              >
                <CardContent className="p-3">
                  <div
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => toggleExpand(call.id)}
                  >
                    <div className="p-2 rounded-full bg-primary/10">
                      <Phone className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        {phone} • {fmtDate(call.started_at || call.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {fmtDuration(call.duration_sec)}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn("text-xs border", status.cls)}
                      >
                        {status.label}
                      </Badge>
                      {call.goal_achieved === true && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      )}
                      {call.goal_achieved === false && (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 space-y-3 border-t pt-3">
                      {summaryText && (
                        <div className="rounded-lg bg-muted/60 p-3">
                          <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1">
                            <Mic className="h-3.5 w-3.5" /> Resumo do Lucas
                          </p>
                          <p className="text-sm text-foreground leading-relaxed">
                            {summaryText}
                          </p>
                        </div>
                      )}

                      {transcriptText && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">
                            Transcrição
                          </p>
                          <ScrollArea className="h-48 rounded-lg border bg-background p-2">
                            <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                              {transcriptText}
                            </pre>
                          </ScrollArea>
                        </div>
                      )}

                      {!transcriptText && !summaryText && (
                        <p className="text-xs text-muted-foreground italic">
                          Transcrição não disponível
                        </p>
                      )}

                      {(call.sentiment_overall ||
                        call.lead_temperature ||
                        call.next_action) && (
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {call.sentiment_overall && (
                            <span>
                              Sentimento:{" "}
                              <strong>{call.sentiment_overall}</strong>
                            </span>
                          )}
                          {call.lead_temperature && (
                            <span>
                              Temperatura:{" "}
                              <strong>{call.lead_temperature}</strong>
                            </span>
                          )}
                          {call.next_action && (
                            <span>
                              Próxima ação: <strong>{call.next_action}</strong>
                            </span>
                          )}
                        </div>
                      )}

                      <div className="pt-1">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs"
                          onClick={() => openTemplateDialog(phone)}
                        >
                          <Send className="h-3 w-3 mr-1" /> Disparar WA com
                          Lucas
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TemplatePickerDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        templates={templates}
        sending={sendingTemplate}
        title="Selecionar Template Aprovado"
        onSend={sendTemplate}
      />
    </div>
  );
}

// ─── Aba 2: Conversas WA Encerradas ──────────────────────────────────────────

function TabConversasEncerradas({
  companyId,
  roleLevel,
  collaboratorCompanyId,
}: {
  companyId: string;
  roleLevel: number;
  collaboratorCompanyId?: string;
}) {
  const [convs, setConvs] = useState<WaConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, WaMessage[]>>({});
  const [loadingMsgs, setLoadingMsgs] = useState<string | null>(null);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [targetConv, setTargetConv] = useState<WaConversation | null>(null);
  const [sendingTemplate, setSendingTemplate] = useState(false);

  const fetchConvs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("wa_conversations")
        .select(
          "id, phone, lead_name, status, window_expires_at, last_message, last_message_at, turn_count, lucas_summary, company_id, analysis"
        )
        .order("last_message_at", { ascending: false })
        .limit(100);

      if (roleLevel > 0 && collaboratorCompanyId) {
        query = query.eq("company_id", collaboratorCompanyId);
      } else if (companyId && companyId !== "all") {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const now = new Date();
      const closed = ((data as WaConversation[]) || []).filter((c) => {
        if (c.window_expires_at) return isPast(new Date(c.window_expires_at));
        if (c.last_message_at) {
          const diff = now.getTime() - new Date(c.last_message_at).getTime();
          return diff > 24 * 60 * 60 * 1000;
        }
        return false;
      });

      setConvs(closed);
    } catch (err) {
      console.error("Error fetching conversations:", err);
      setConvs([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, roleLevel, collaboratorCompanyId]);

  useEffect(() => {
    fetchConvs();
  }, [fetchConvs]);

  const loadMessages = async (convId: string) => {
    if (messages[convId]) return;
    setLoadingMsgs(convId);
    try {
      const { data, error } = await supabase
        .from("wa_messages")
        .select("id, conversation_id, role, content, created_at")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setMessages((prev) => ({ ...prev, [convId]: (data as WaMessage[]) || [] }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMsgs(null);
    }
  };

  const toggleExpand = async (id: string) => {
    const next = expanded === id ? null : id;
    setExpanded(next);
    if (next) await loadMessages(id);
  };

  const openReactivate = async (conv: WaConversation) => {
    setTargetConv(conv);
    const { data } = await supabase
      .from("whatsapp_meta_templates")
      .select("name, status, language")
      .eq("company_id", companyId)
      .eq("status", "APPROVED");
    setTemplates((data as TemplateItem[]) || []);
    setReactivateOpen(true);
  };

  const sendReactivation = async (templateName: string) => {
    if (!targetConv) return;
    setSendingTemplate(true);
    try {
      const session = await supabase.auth.getSession();
      const res = await fetch(`${EDGE_BASE}/send-meta-template`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({
          action: "send-by-slot",
          company_id: companyId,
          phone_number: targetConv.phone,
          template_name: templateName,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erro");
      toast.success("Template de reativação enviado!");
      setReactivateOpen(false);
      fetchConvs();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao reativar");
    } finally {
      setSendingTemplate(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={fetchConvs} className="h-8">
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
        </Button>
        <span className="text-xs text-muted-foreground">
          {convs.length} conversas encerradas
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : convs.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Nenhuma conversa encerrada no momento</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {convs.map((conv) => {
            const isExpanded = expanded === conv.id;
            const convMessages = messages[conv.id] || [];

            return (
              <Card
                key={conv.id}
                className={cn(
                  "transition-all",
                  isExpanded && "ring-1 ring-primary/30"
                )}
              >
                <CardContent className="p-3">
                  <div
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => toggleExpand(conv.id)}
                  >
                    <div className="p-2 rounded-full bg-orange-500/10">
                      <MessageSquare className="h-4 w-4 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {conv.lead_name || conv.phone}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {conv.phone}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {conv.turn_count} msgs
                      </span>
                      {conv.window_expires_at && (
                        <Badge
                          variant="outline"
                          className="text-xs border bg-orange-500/10 text-orange-400 border-orange-500/30"
                        >
                          Encerrada {fmtRelative(conv.window_expires_at)}
                        </Badge>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 space-y-3 border-t pt-3">
                      {conv.lucas_summary && (
                        <div className="rounded-lg bg-muted/60 p-3">
                          <p className="text-xs font-semibold text-primary mb-1">
                            Resumo do Lucas
                          </p>
                          <p className="text-sm text-foreground">
                            {conv.lucas_summary}
                          </p>
                        </div>
                      )}

                      {conv.last_message && (
                        <p className="text-xs text-muted-foreground">
                          Última mensagem:{" "}
                          <span className="text-foreground">
                            {conv.last_message}
                          </span>
                          {conv.last_message_at && (
                            <span> — {fmtDate(conv.last_message_at)}</span>
                          )}
                        </p>
                      )}

                      {loadingMsgs === conv.id ? (
                        <Skeleton className="h-32 w-full" />
                      ) : convMessages.length > 0 ? (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2">
                            Histórico de mensagens
                          </p>
                          <ScrollArea className="h-52 rounded-lg border bg-background">
                            <div className="p-3 space-y-2">
                              {convMessages.map((msg) => (
                                <div
                                  key={msg.id}
                                  className={cn(
                                    "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                                    msg.role === "user"
                                      ? "bg-primary/10 text-foreground ml-auto text-right"
                                      : "bg-muted text-muted-foreground"
                                  )}
                                >
                                  <p>{msg.content || "—"}</p>
                                  <p className="text-[10px] opacity-60 mt-1">
                                    {fmtDate(msg.created_at)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          Nenhuma mensagem carregada
                        </p>
                      )}

                      <div className="pt-1">
                      <div className="pt-1">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs"
                          onClick={() => openReactivate(conv)}
                        >
                          <Send className="h-3 w-3 mr-1" /> Reativar com
                          Template
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TemplatePickerDialog
        open={reactivateOpen}
        onOpenChange={setReactivateOpen}
        templates={templates}
        sending={sendingTemplate}
        title={`Reativar — ${targetConv?.lead_name || targetConv?.phone || ""}`}
        onSend={sendReactivation}
      />
    </div>
  );
}

// ─── Aba 3: Linha do Tempo ────────────────────────────────────────────────────

function TabLinhaDoTempo({ companyId }: { companyId: string }) {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [searched, setSearched] = useState(false);

  const fetchTimeline = async () => {
    if (!search.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const items: TimelineItem[] = [];
      const q = search.trim();

      // 1. Search call_logs
      let callQuery = supabase
        .from("call_logs")
        .select("id, lead_phone, lead_name, status, duration_sec, transcript, result, started_at, created_at, goal_achieved, sentiment_overall, next_action")
        .order("created_at", { ascending: true })
        .limit(50);

      if (q.replace(/\D/g, "").length >= 8) {
        callQuery = callQuery.ilike("lead_phone", `%${q.replace(/\D/g, "")}%`);
      } else {
        callQuery = callQuery.ilike("lead_name", `%${q}%`);
      }

      const { data: callData } = await callQuery;
      if (callData) {
        for (const c of callData) {
          const statusCfg = callStatusConfig[c.status || ""] || { label: c.status || "—", cls: "" };
          const summary = getSummaryText(c.transcript);
          items.push({
            id: c.id,
            type: "call",
            timestamp: c.started_at || c.created_at,
            label: `📞 Ligação realizada`,
            detail: `Status: ${statusCfg.label} • Duração: ${fmtDuration(c.duration_sec)}`,
            sub: summary ? `Resumo Lucas: "${summary.slice(0, 120)}${summary.length > 120 ? "…" : ""}"` : undefined,
            icon: "phone",
            positive: c.goal_achieved === true,
          });
        }
      }

      // 2. Search wa_conversations
      let convQuery = supabase
        .from("wa_conversations")
        .select("id, phone, lead_name, status, last_message, last_message_at, turn_count, lucas_summary, window_expires_at, created_at")
        .order("created_at", { ascending: true })
        .limit(20);

      if (q.replace(/\D/g, "").length >= 8) {
        convQuery = convQuery.ilike("phone", `%${q.replace(/\D/g, "")}%`);
      } else {
        convQuery = convQuery.ilike("lead_name", `%${q}%`);
      }

      const { data: convData } = await convQuery;
      if (convData) {
        for (const c of convData) {
          items.push({
            id: `conv-${c.id}`,
            type: "wa_message",
            timestamp: c.created_at,
            label: `💬 Conversa WhatsApp iniciada`,
            detail: `Status: ${c.status || "—"} • ${c.turn_count} mensagens`,
            sub: c.lucas_summary ? `Lucas: "${c.lucas_summary.slice(0, 100)}${c.lucas_summary.length > 100 ? "…" : ""}"` : undefined,
            icon: "chat",
            positive: c.status === "converted",
          });

          if (c.last_message_at && c.last_message) {
            items.push({
              id: `msg-last-${c.id}`,
              type: "wa_message",
              timestamp: c.last_message_at,
              label: `💬 Última mensagem`,
              detail: c.last_message.slice(0, 140),
              icon: "chat",
            });
          }
        }
      }

      // Sort by timestamp
      items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setTimeline(items);
    } catch (err) {
      console.error(err);
      setTimeline([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") fetchTimeline();
  };

  const timelineIconMap: Record<string, React.ReactNode> = {
    phone: <Phone className="h-4 w-4 text-primary" />,
    chat: <MessageSquare className="h-4 w-4 text-blue-400" />,
    send: <Send className="h-4 w-4 text-emerald-400" />,
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Buscar lead por nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-9"
        />
        <Button onClick={fetchTimeline} disabled={loading} className="h-9">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>

      {!searched ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Digite o nome ou telefone do lead para ver a linha do tempo</p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : timeline.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Nenhum registro encontrado para &quot;{search}&quot;</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-4 ml-12">
            {timeline.map((item, idx) => (
              <div key={`${item.id}-${idx}`} className="relative">
                {/* Icon bubble */}
                <div className="absolute -left-[2.85rem] top-1 h-8 w-8 rounded-full bg-background border-2 border-border flex items-center justify-center">
                  {timelineIconMap[item.icon]}
                </div>

                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 flex-1">
                        <p className="text-sm font-semibold">{item.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.detail}
                        </p>
                        {item.sub && (
                          <p className="text-xs text-foreground/70 italic mt-1">
                            {item.sub}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(item.timestamp)}
                        </p>
                        {item.positive === true && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 ml-auto mt-1" />
                        )}
                        {item.positive === false && (
                          <XCircle className="h-4 w-4 text-destructive ml-auto mt-1" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Historico() {
  const { collaborator, roleLevel } = useCollaborator();
  const { company_id: selectedCompanyId } = useCompany();

  const companyId =
    selectedCompanyId && selectedCompanyId !== "all"
      ? selectedCompanyId
      : collaborator?.company_id || FALLBACK_COMPANY;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <PageHeader
          title="Histórico"
          subtitle="Transcrições de ligações, conversas encerradas e linha do tempo do lead"
        />

        <Tabs defaultValue="transcricoes">
          <TabsList className="w-full md:w-auto">
            <TabsTrigger value="transcricoes" className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> Transcrições
            </TabsTrigger>
            <TabsTrigger value="conversas" className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> WA Encerradas
            </TabsTrigger>
            <TabsTrigger value="timeline" className="flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5" /> Linha do Tempo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transcricoes" className="mt-4">
            <TabTranscricoes
              companyId={companyId}
              roleLevel={roleLevel}
              collaboratorCompanyId={collaborator?.company_id}
            />
          </TabsContent>

          <TabsContent value="conversas" className="mt-4">
            <TabConversasEncerradas
              companyId={companyId}
              roleLevel={roleLevel}
              collaboratorCompanyId={collaborator?.company_id}
            />
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <TabLinhaDoTempo companyId={companyId} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
