import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  MessageSquare, Send, Search, Phone, Clock,
  CheckCheck, Check, X, AlertTriangle,
  FileText, Image, Mic, File, DollarSign,
  BarChart3, Shield, Loader2, Plus, Eye,
} from "lucide-react";

type Conversation = {
  id: string;
  phone: string;
  name: string | null;
  lastMessage: string;
  lastTime: string;
  unread: number;
  status: "active" | "waiting" | "closed";
};

type Message = {
  id: string;
  direction: "inbound" | "outbound";
  type: string;
  content: string;
  status: string;
  ai_generated: boolean;
  template_name: string | null;
  created_at: string;
  meta_cost: number | null;
};

type Template = {
  name: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
  cost_per_message: number;
  components: string;
};

const categoryColors: Record<string, string> = {
  MARKETING: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  UTILITY: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  AUTHENTICATION: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const categoryCosts: Record<string, string> = {
  MARKETING: "R$ 0,35",
  UTILITY: "R$ 0,04",
  AUTHENTICATION: "R$ 0,02",
};

const statusIcon = (status: string) => {
  if (status === "read") return <CheckCheck className="h-3.5 w-3.5 text-blue-400" />;
  if (status === "delivered") return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />;
  if (status === "sent") return <Check className="h-3.5 w-3.5 text-muted-foreground" />;
  if (status === "failed") return <X className="h-3.5 w-3.5 text-red-400" />;
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
};

const typeIcon = (type: string) => {
  if (type === "image") return <Image className="h-4 w-4" />;
  if (type === "audio") return <Mic className="h-4 w-4" />;
  if (type === "document") return <File className="h-4 w-4" />;
  if (type === "template") return <FileText className="h-4 w-4" />;
  return <MessageSquare className="h-4 w-4" />;
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

const templates: Template[] = [
  { name: "lembrete_boleto", category: "UTILITY", language: "pt_BR", status: "APPROVED", cost_per_message: 0.04, components: "Olá {{1}}, seu boleto vence em {{2}}. Valor: R$ {{3}}" },
  { name: "cotacao_protecao", category: "UTILITY", language: "pt_BR", status: "APPROVED", cost_per_message: 0.04, components: "Olá {{1}}, cotamos seu {{2}}. Valor mensal: R$ {{3}}" },
  { name: "promo_protecao", category: "MARKETING", language: "pt_BR", status: "APPROVED", cost_per_message: 0.35, components: "Promoção especial para {{1}}! Proteção veicular com até 30% de desconto." },
  { name: "confirmacao_agendamento", category: "UTILITY", language: "pt_BR", status: "PENDING", cost_per_message: 0.04, components: "Confirmação: {{1}}, seu agendamento está marcado para {{2}} às {{3}}." },
];

export default function WhatsAppMeta() {
  const { collaborator, roleLevel } = useCollaborator();
  const [activeTab, setActiveTab] = useState("inbox");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // Stats
  const [stats, setStats] = useState({
    totalMessages: 0, sent: 0, delivered: 0, read: 0, failed: 0,
    totalCost: 0, marketingCost: 0, utilityCost: 0,
    templatesSent: 0, aiGenerated: 0,
  });

  useEffect(() => {
    loadConversations();
    loadStats();
  }, []);

  const loadConversations = async () => {
    setLoading(true);
    // Load from whatsapp_conversations or whatsapp_messages
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(50);

    if (data && data.length > 0) {
      setConversations(data.map((c: any) => ({
        id: c.id,
        phone: c.phone ?? c.lead_phone ?? "",
        name: c.lead_name ?? c.contact_name ?? null,
        lastMessage: c.last_message ?? "",
        lastTime: c.last_message_at ?? c.updated_at ?? "",
        unread: c.unread_count ?? 0,
        status: c.status ?? "active",
      })));
    } else {
      // Demo data
      setConversations([
        { id: "1", phone: "5511999887766", name: "João Silva", lastMessage: "Olá, gostaria de mais informações", lastTime: new Date().toISOString(), unread: 2, status: "active" },
        { id: "2", phone: "5511988776655", name: "Maria Santos", lastMessage: "Obrigada pelo atendimento!", lastTime: new Date(Date.now() - 3600000).toISOString(), unread: 0, status: "active" },
        { id: "3", phone: "5511977665544", name: "Carlos Oliveira", lastMessage: "Qual o valor mensal?", lastTime: new Date(Date.now() - 7200000).toISOString(), unread: 1, status: "waiting" },
      ]);
    }
    setLoading(false);
  };

  const loadStats = async () => {
    // Load message stats
    const { count: totalCount } = await supabase.from("whatsapp_messages").select("*", { count: "exact", head: true });
    setStats((s) => ({ ...s, totalMessages: totalCount ?? 0 }));
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedConv) return;
    toast.success("Mensagem enviada!");
    setMessageInput("");
  };

  const filteredConversations = conversations.filter((c) =>
    !searchTerm ||
    (c.name ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="WhatsApp Meta"
          subtitle="Inbox, templates e métricas — API Oficial Meta Cloud"
          badge={<Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">API Oficial</Badge>}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="h-auto flex-wrap justify-start gap-2 rounded-xl border border-border/60 bg-secondary/40 p-1">
            <TabsTrigger value="inbox">Inbox</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="metricas">Métricas & Custos</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>

          {/* INBOX */}
          <TabsContent value="inbox" className="space-y-0">
            <div className="grid grid-cols-[320px_1fr] h-[600px] rounded-xl border border-border/60 overflow-hidden">
              {/* Lista de Conversas */}
              <div className="border-r border-border/60 bg-card flex flex-col">
                <div className="p-3 border-b border-border/60">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar conversa..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  {filteredConversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConv(conv.id)}
                      className={`w-full text-left px-4 py-3 border-b border-border/30 hover:bg-secondary/30 transition-colors ${
                        selectedConv === conv.id ? "bg-secondary/50" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{conv.name ?? conv.phone}</p>
                          <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[10px] text-muted-foreground">{formatTime(conv.lastTime)}</span>
                          {conv.unread > 0 && (
                            <span className="h-5 w-5 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-bold">
                              {conv.unread}
                            </span>
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
                    <div className="h-14 px-4 flex items-center justify-between border-b border-border/60 bg-card">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <Phone className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{conversations.find((c) => c.id === selectedConv)?.name ?? "Contato"}</p>
                          <p className="text-[10px] text-muted-foreground">{conversations.find((c) => c.id === selectedConv)?.phone}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto bg-secondary/10">
                      <div className="text-center text-muted-foreground text-sm py-8">
                        As mensagens aparecerão aqui em tempo real via Supabase Realtime
                      </div>
                    </div>
                    <div className="p-3 border-t border-border/60 bg-card flex gap-2">
                      <Input
                        placeholder="Digite uma mensagem..."
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        className="flex-1"
                      />
                      <Button size="icon" onClick={sendMessage} className="bg-emerald-600 hover:bg-emerald-700">
                        <Send className="h-4 w-4" />
                      </Button>
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

          {/* TEMPLATES */}
          <TabsContent value="templates" className="space-y-6">
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Templates de Mensagem</CardTitle>
                    <CardDescription>Templates aprovados pela Meta para envio em massa</CardDescription>
                  </div>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Novo Template</Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Idioma</TableHead>
                      <TableHead>Custo/msg</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Preview</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((t) => (
                      <TableRow key={t.name}>
                        <TableCell className="font-medium text-foreground">{t.name}</TableCell>
                        <TableCell><Badge variant="outline" className={categoryColors[t.category]}>{t.category}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{t.language}</TableCell>
                        <TableCell className="font-medium">{categoryCosts[t.category]}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            t.status === "APPROVED" ? "bg-emerald-500/20 text-emerald-400" :
                            t.status === "PENDING" ? "bg-yellow-500/20 text-yellow-400" :
                            "bg-red-500/20 text-red-400"
                          }>{t.status === "APPROVED" ? "Aprovado" : t.status === "PENDING" ? "Pendente" : "Rejeitado"}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Tabela de Preços Meta */}
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Tabela de Preços — Meta Cloud API (Brasil)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Custo/Conversa</TableHead>
                      <TableHead>Uso</TableHead>
                      <TableHead>Janela</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow><TableCell className="font-medium">Marketing</TableCell><TableCell className="text-foreground font-bold">R$ 0,35</TableCell><TableCell className="text-muted-foreground">Promoções, campanhas</TableCell><TableCell className="text-muted-foreground">24h</TableCell></TableRow>
                    <TableRow><TableCell className="font-medium">Utility</TableCell><TableCell className="text-foreground font-bold">R$ 0,04</TableCell><TableCell className="text-muted-foreground">Boletos, status, agendamento</TableCell><TableCell className="text-muted-foreground">24h</TableCell></TableRow>
                    <TableRow><TableCell className="font-medium">Authentication</TableCell><TableCell className="text-foreground font-bold">R$ 0,02</TableCell><TableCell className="text-muted-foreground">Códigos de verificação</TableCell><TableCell className="text-muted-foreground">24h</TableCell></TableRow>
                    <TableRow><TableCell className="font-medium">Service</TableCell><TableCell className="text-emerald-400 font-bold">GRÁTIS</TableCell><TableCell className="text-muted-foreground">Respostas dentro da janela</TableCell><TableCell className="text-muted-foreground">24h do cliente</TableCell></TableRow>
                    <TableRow><TableCell className="font-medium">CTWA (Click-to-WhatsApp)</TableCell><TableCell className="text-emerald-400 font-bold">GRÁTIS 72h</TableCell><TableCell className="text-muted-foreground">Anúncios clicáveis</TableCell><TableCell className="text-muted-foreground">72h</TableCell></TableRow>
                    <TableRow><TableCell className="font-medium">Free Tier</TableCell><TableCell className="text-emerald-400 font-bold">1.000/mês</TableCell><TableCell className="text-muted-foreground">Conversas de serviço gratuitas</TableCell><TableCell className="text-muted-foreground">Mensal</TableCell></TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MÉTRICAS & CUSTOS */}
          <TabsContent value="metricas" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Mensagens Enviadas", value: stats.totalMessages || "0", icon: Send, color: "text-primary" },
                { label: "Entregues", value: stats.delivered || "0", icon: CheckCheck, color: "text-emerald-400" },
                { label: "Lidas", value: stats.read || "0", icon: Eye, color: "text-blue-400" },
                { label: "Custo Total", value: `R$ ${(stats.totalCost || 0).toFixed(2)}`, icon: DollarSign, color: "text-yellow-400" },
              ].map((s) => (
                <Card key={s.label} className="bg-card border-border/60">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center">
                        <s.icon className={`h-5 w-5 ${s.color}`} />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{s.value}</p>
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-border/60 bg-card">
                <CardHeader><CardTitle className="text-base">Custo por Categoria</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { cat: "Marketing", cost: stats.marketingCost || 0, perc: 60, color: "bg-violet-500" },
                    { cat: "Utility", cost: stats.utilityCost || 0, perc: 30, color: "bg-blue-500" },
                    { cat: "Authentication", cost: 0, perc: 10, color: "bg-emerald-500" },
                  ].map((item) => (
                    <div key={item.cat} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{item.cat}</span>
                        <span className="font-medium">R$ {item.cost.toFixed(2)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary">
                        <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.perc}%` }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card">
                <CardHeader><CardTitle className="text-base">Desempenho de Templates</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {templates.filter(t => t.status === "APPROVED").map((t) => (
                    <div key={t.name} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20">
                      <div>
                        <p className="text-sm font-medium">{t.name}</p>
                        <Badge variant="outline" className={`text-[10px] ${categoryColors[t.category]}`}>{t.category}</Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">0 envios</p>
                        <p className="text-[10px] text-muted-foreground">{categoryCosts[t.category]}/msg</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* COMPLIANCE */}
          <TabsContent value="compliance" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-border/60 bg-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-400" />
                    Status de Compliance — WhatsApp
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { item: "Conta Business verificada", ok: true },
                    { item: "Número registrado na Meta", ok: true },
                    { item: "Política de privacidade configurada", ok: true },
                    { item: "Opt-out habilitado nos templates", ok: true },
                    { item: "Rate limit respeitado (200/h)", ok: true },
                    { item: "Webhook signature validation", ok: true },
                    { item: "Mensagens dentro da janela 24h", ok: true },
                    { item: "Templates aprovados pela Meta", ok: true },
                  ].map((check) => (
                    <div key={check.item} className="flex items-center gap-3">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center ${check.ok ? "bg-emerald-500/20" : "bg-red-500/20"}`}>
                        {check.ok ? <Check className="h-3 w-3 text-emerald-400" /> : <X className="h-3 w-3 text-red-400" />}
                      </div>
                      <span className="text-sm text-foreground">{check.item}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-400" />
                    Limites e Rate Limits
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Mensagens/hora</span>
                      <span className="font-medium">0 / 200</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: "0%" }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Conversas grátis/mês</span>
                      <span className="font-medium">0 / 1.000</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: "0%" }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Quality Rating</span>
                      <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400">Alto</Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Messaging Tier</span>
                      <Badge variant="outline">Tier 1 (1K/dia)</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
