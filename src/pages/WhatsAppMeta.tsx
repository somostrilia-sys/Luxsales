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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  MessageSquare, Send, Search, Phone, Clock, Shield, FileText,
  CheckCheck, Check, X, Loader2, RefreshCw, AlertTriangle,
  BarChart3, Users, Zap, CircleCheck, CircleX, CircleDot,
} from "lucide-react";

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

const qualityBadge = (q: string | null) => {
  if (q === "GREEN") return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Verde</Badge>;
  if (q === "YELLOW") return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Amarelo</Badge>;
  if (q === "RED") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Vermelho</Badge>;
  return <Badge variant="secondary">—</Badge>;
};

const templateStatusBadge = (s: string) => {
  const map: Record<string, string> = {
    APPROVED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    PENDING: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    REJECTED: "bg-red-500/20 text-red-400 border-red-500/30",
    PAUSED: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    DISABLED: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={map[s] ?? "bg-muted text-muted-foreground"}>{s}</Badge>;
};

type Conversation = { id: string; phone: string; name: string | null; lastMessage: string; lastTime: string; unread: number };
type Message = { id: string; direction: string; content: string; status: string; ai_generated: boolean; created_at: string; pricing_category?: string };

export default function WhatsAppMeta() {
  const { collaborator } = useCollaborator();
  const [activeTab, setActiveTab] = useState("inbox");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // New tables data
  const [credentials, setCredentials] = useState<any>(null);
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [optIns, setOptIns] = useState<any[]>([]);
  const [qualitySignals, setQualitySignals] = useState<any[]>([]);
  const [billingData, setBillingData] = useState<any[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<any[]>([]);
  const [syncingTemplates, setSyncingTemplates] = useState(false);

  const companyId = collaborator?.company_id;

  useEffect(() => {
    if (companyId) {
      loadConversations();
      loadMetaData();
    }
  }, [companyId]);

  // Realtime on whatsapp_meta_messages
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-meta-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_meta_messages" }, (payload) => {
        const msg = payload.new as any;
        if (selectedConv && (msg.phone_from === selectedConv || msg.phone_to === selectedConv)) {
          setMessages(prev => [...prev, {
            id: msg.id, direction: msg.direction, content: msg.body ?? "",
            status: msg.status ?? "sent", ai_generated: false,
            created_at: msg.created_at ?? new Date().toISOString(),
            pricing_category: msg.pricing_category,
          }]);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
        loadConversations();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "whatsapp_meta_messages" }, () => {
        if (selectedConv) loadMessages(selectedConv);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedConv]);

  const loadMetaData = async () => {
    if (!companyId) return;

    const [creds, phones, tmpls, opts, quality, billing, events] = await Promise.all([
      supabase.from("whatsapp_meta_credentials").select("*").eq("company_id", companyId).single(),
      supabase.from("whatsapp_meta_phone_numbers").select("*").eq("company_id", companyId),
      supabase.from("whatsapp_meta_templates").select("*").eq("company_id", companyId).neq("status", "DELETED").order("category").order("name"),
      supabase.from("whatsapp_meta_opt_ins").select("*").eq("company_id", companyId).eq("is_active", true).order("created_at", { ascending: false }).limit(100),
      supabase.from("whatsapp_meta_quality_signals").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(50),
      supabase.from("whatsapp_meta_conversations_billing").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(50),
      supabase.from("whatsapp_meta_webhook_events").select("*").eq("company_id", companyId).order("received_at", { ascending: false }).limit(50),
    ]);

    setCredentials(creds.data);
    setPhoneNumbers(phones.data ?? []);
    setTemplates(tmpls.data ?? []);
    setOptIns(opts.data ?? []);
    setQualitySignals(quality.data ?? []);
    setBillingData(billing.data ?? []);
    setWebhookEvents(events.data ?? []);
  };

  const loadConversations = async () => {
    setLoading(true);
    // Load from whatsapp_meta_messages (official Meta API)
    const { data } = await supabase
      .from("whatsapp_meta_messages")
      .select("id, message_id, phone_from, phone_to, direction, body, status, created_at, pricing_category")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(300);

    if (data && data.length > 0) {
      const convMap = new Map<string, Conversation>();
      data.forEach((m: any) => {
        const phone = m.direction === "inbound" ? m.phone_from : m.phone_to;
        if (!phone) return;
        if (!convMap.has(phone)) {
          convMap.set(phone, { id: phone, phone, name: null, lastMessage: m.body ?? "", lastTime: m.created_at, unread: 0 });
        }
        if (m.direction === "inbound" && m.status !== "read") {
          convMap.get(phone)!.unread++;
        }
      });
      setConversations(Array.from(convMap.values()));
    } else {
      // Fallback: try old whatsapp_messages table
      const { data: oldData } = await supabase
        .from("whatsapp_messages")
        .select("id, from_number, to_number, direction, content, status, created_at")
        .order("created_at", { ascending: false }).limit(200);
      if (oldData && oldData.length > 0) {
        const convMap = new Map<string, Conversation>();
        oldData.forEach((m: any) => {
          const phone = m.direction === "inbound" ? m.from_number : m.to_number;
          if (!phone) return;
          if (!convMap.has(phone)) {
            convMap.set(phone, { id: phone, phone, name: null, lastMessage: m.content ?? "", lastTime: m.created_at, unread: 0 });
          }
        });
        setConversations(Array.from(convMap.values()));
      }
    }
    setLoading(false);
  };

  const loadMessages = async (phone: string) => {
    setLoadingMsgs(true);
    setSelectedConv(phone);
    const { data } = await supabase
      .from("whatsapp_meta_messages")
      .select("id, direction, body, status, created_at, pricing_category, sent_at, delivered_at, read_at")
      .or(`phone_from.eq.${phone},phone_to.eq.${phone}`)
      .eq("company_id", companyId)
      .order("created_at", { ascending: true })
      .limit(200);
    setMessages((data ?? []).map((m: any) => ({
      id: m.id, direction: m.direction, content: m.body ?? "",
      status: m.status ?? "sent", ai_generated: false,
      created_at: m.created_at, pricing_category: m.pricing_category,
    })));
    setLoadingMsgs(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedConv || !companyId) return;
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-meta-send", {
        body: { company_id: companyId, to: selectedConv, type: "text", text: { body: messageInput } },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Erro ao enviar");
      } else {
        toast.success("Mensagem enviada via Meta API!");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar");
    }
    setMessageInput("");
  };

  const syncTemplates = async () => {
    if (!companyId) return;
    setSyncingTemplates(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-meta-templates", {
        body: { company_id: companyId, action: "sync" },
      });
      if (error || data?.error) {
        toast.error(data?.error || "Erro ao sincronizar templates");
      } else {
        toast.success(`Templates sincronizados: ${data.synced} (${data.created} novos, ${data.updated} atualizados)`);
        loadMetaData();
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setSyncingTemplates(false);
  };

  const filteredConvs = conversations.filter(c =>
    !searchTerm || (c.name ?? "").toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm)
  );
  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  // Stats
  const approvedTemplates = templates.filter(t => t.status === "APPROVED").length;
  const activeOptIns = optIns.length;
  const unresolvedSignals = qualitySignals.filter(s => !s.resolved_at).length;
  const connectedPhones = phoneNumbers.filter(p => p.status === "connected").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="WhatsApp Meta BSP"
          subtitle="API oficial Meta — Templates, Quality Rating, Billing, LGPD"
          badge={credentials?.is_verified
            ? <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30"><Shield className="h-3 w-3 mr-1" />Verificado</Badge>
            : <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">Pendente Verificação</Badge>
          }
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { label: "Quality Rating", value: credentials?.quality_rating ?? "—", icon: BarChart3, color: credentials?.quality_rating === "GREEN" ? "text-emerald-400" : credentials?.quality_rating === "RED" ? "text-red-400" : "text-yellow-400" },
            { label: "Msg Limit", value: credentials?.messaging_limit_tier?.replace("TIER_", "") ?? "250", icon: Zap, color: "text-blue-400" },
            { label: "Telefones", value: `${connectedPhones}/${phoneNumbers.length}`, icon: Phone, color: "text-emerald-400" },
            { label: "Templates", value: `${approvedTemplates}/${templates.length}`, icon: FileText, color: "text-violet-400" },
            { label: "Opt-ins Ativos", value: activeOptIns, icon: Users, color: "text-blue-400" },
            { label: "Alertas", value: unresolvedSignals, icon: AlertTriangle, color: unresolvedSignals > 0 ? "text-red-400" : "text-emerald-400" },
          ].map(k => (
            <Card key={k.label} className="bg-card border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center"><k.icon className={`h-4 w-4 ${k.color}`} /></div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{typeof k.value === "number" ? k.value.toLocaleString("pt-BR") : k.value}</p>
                    <p className="text-[10px] text-muted-foreground">{k.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="h-auto flex-wrap gap-2 rounded-xl border border-border/60 bg-secondary/40 p-1">
            <TabsTrigger value="inbox">Inbox {totalUnread > 0 && <Badge className="ml-1 h-5 bg-emerald-500 text-white text-[10px]">{totalUnread}</Badge>}</TabsTrigger>
            <TabsTrigger value="templates">Templates ({approvedTemplates})</TabsTrigger>
            <TabsTrigger value="phones">Telefones ({phoneNumbers.length})</TabsTrigger>
            <TabsTrigger value="optins">Opt-ins ({activeOptIns})</TabsTrigger>
            <TabsTrigger value="quality">Quality Signals</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>

          {/* INBOX TAB */}
          <TabsContent value="inbox">
            <div className="grid grid-cols-[320px_1fr] h-[550px] rounded-xl border border-border/60 overflow-hidden">
              <div className="border-r border-border/60 bg-card flex flex-col">
                <div className="p-3 border-b border-border/60">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9" />
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
                          {conv.unread > 0 && <span className="h-5 w-5 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-bold">{conv.unread}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </ScrollArea>
              </div>
              <div className="bg-background flex flex-col">
                {selectedConv ? (
                  <>
                    <div className="h-14 px-4 flex items-center border-b border-border/60 bg-card">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center"><Phone className="h-4 w-4 text-emerald-400" /></div>
                        <div>
                          <p className="text-sm font-medium">{conversations.find(c => c.phone === selectedConv)?.name ?? selectedConv}</p>
                          <p className="text-[10px] text-muted-foreground">{selectedConv} • Meta Cloud API</p>
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
                              <div className={`max-w-[75%] rounded-xl px-4 py-2 text-sm ${m.direction === "outbound" ? "bg-emerald-600 text-white rounded-br-sm" : "bg-card text-foreground rounded-bl-sm"}`}>
                                <p>{m.content}</p>
                                <div className="flex items-center justify-end gap-1 mt-1">
                                  <span className="text-[10px] opacity-70">{formatTime(m.created_at)}</span>
                                  {m.direction === "outbound" && statusIcon(m.status)}
                                  {m.pricing_category && <Badge className="text-[8px] h-4 bg-blue-500/30 text-blue-300 px-1">{m.pricing_category}</Badge>}
                                </div>
                              </div>
                            </div>
                          ))}
                          <div ref={messagesEndRef} />
                        </div>
                      )}
                    </div>
                    <div className="p-3 border-t border-border/60 bg-card flex gap-2">
                      <Input placeholder="Mensagem via Meta API..." value={messageInput} onChange={e => setMessageInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} className="flex-1" />
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
          </TabsContent>

          {/* TEMPLATES TAB */}
          <TabsContent value="templates" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{templates.length} templates cadastrados</p>
              <Button variant="outline" size="sm" onClick={syncTemplates} disabled={syncingTemplates}>
                {syncingTemplates ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Sincronizar com Meta
              </Button>
            </div>
            <Card className="border-border/60 bg-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Idioma</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Qualidade</TableHead>
                      <TableHead>Enviados</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum template. Clique em "Sincronizar com Meta".</TableCell></TableRow>
                    ) : templates.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium text-foreground">{t.name}</TableCell>
                        <TableCell><Badge variant="secondary">{t.category}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{t.language}</TableCell>
                        <TableCell>{templateStatusBadge(t.status)}</TableCell>
                        <TableCell>{qualityBadge(t.quality_score)}</TableCell>
                        <TableCell className="text-muted-foreground">{t.total_sent ?? 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PHONE NUMBERS TAB */}
          <TabsContent value="phones" className="space-y-4">
            <Card className="border-border/60 bg-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Nome Verificado</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead>Limite Msgs</TableHead>
                      <TableHead>Throughput</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {phoneNumbers.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum número registrado. Configure via Onboarding.</TableCell></TableRow>
                    ) : phoneNumbers.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium text-foreground font-mono">{p.display_phone}</TableCell>
                        <TableCell className="text-foreground">{p.verified_name ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={p.status === "connected" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"}>
                            {p.status === "connected" ? <CircleCheck className="h-3 w-3 mr-1" /> : <CircleDot className="h-3 w-3 mr-1" />}
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{qualityBadge(p.quality_rating)}</TableCell>
                        <TableCell className="text-muted-foreground">{p.messaging_limit ?? 250}/dia</TableCell>
                        <TableCell className="text-muted-foreground">{p.max_msgs_per_second ?? 80}/s</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* OPT-INS TAB */}
          <TabsContent value="optins" className="space-y-4">
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle className="text-base">Consentimentos Ativos (LGPD)</CardTitle>
                <CardDescription>{activeOptIns} contatos com opt-in ativo</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Base Legal</TableHead>
                      <TableHead>Marketing</TableHead>
                      <TableHead>Data Opt-in</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {optIns.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum opt-in registrado</TableCell></TableRow>
                    ) : optIns.map(o => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-foreground">{o.phone_number}</TableCell>
                        <TableCell className="text-foreground">{o.contact_name ?? "—"}</TableCell>
                        <TableCell><Badge variant="secondary">{o.opt_in_method}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{o.lgpd_legal_basis ?? "—"}</TableCell>
                        <TableCell>{o.consent_marketing ? <CircleCheck className="h-4 w-4 text-emerald-400" /> : <CircleX className="h-4 w-4 text-muted-foreground" />}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{new Date(o.opted_in_at).toLocaleDateString("pt-BR")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* QUALITY SIGNALS TAB */}
          <TabsContent value="quality" className="space-y-4">
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-yellow-400" />Sinais de Qualidade</CardTitle>
                <CardDescription>Blocks, reports e alertas da Meta</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Severidade</TableHead>
                      <TableHead>De → Para</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {qualitySignals.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum sinal de qualidade</TableCell></TableRow>
                    ) : qualitySignals.map(q => (
                      <TableRow key={q.id}>
                        <TableCell className="text-foreground font-medium">{q.signal_type}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={q.severity === "critical" ? "bg-red-500/20 text-red-400" : q.severity === "high" ? "bg-orange-500/20 text-orange-400" : "bg-yellow-500/20 text-yellow-400"}>
                            {q.severity ?? "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{q.old_value ?? "—"} → {q.new_value ?? "—"}</TableCell>
                        <TableCell>{q.resolved_at ? <Badge className="bg-emerald-500/20 text-emerald-400">Resolvido</Badge> : <Badge className="bg-red-500/20 text-red-400">Aberto</Badge>}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{new Date(q.created_at).toLocaleString("pt-BR")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BILLING TAB */}
          <TabsContent value="billing" className="space-y-4">
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle className="text-base">Conversas & Billing</CardTitle>
                <CardDescription>Janelas de conversa e custos por categoria</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contato</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Msgs</TableHead>
                      <TableHead>Custo</TableHead>
                      <TableHead>Janela</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billingData.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma conversa cobrada</TableCell></TableRow>
                    ) : billingData.map(b => (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-foreground">{b.contact_phone}</TableCell>
                        <TableCell><Badge variant="secondary">{b.category}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{b.origin === "business_initiated" ? "Empresa" : "Usuário"}</TableCell>
                        <TableCell className="text-foreground">{b.message_count}</TableCell>
                        <TableCell className="text-foreground">R$ {(b.cost_brl ?? 0).toFixed(4)}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{new Date(b.window_start).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
