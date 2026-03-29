import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCompany } from "@/contexts/CompanyContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { EDGE_BASE, SUPABASE_ANON_KEY } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Users, Flame, Phone, Send, MessageCircle, Trophy,
  RefreshCw, AlertTriangle, CheckCircle, Shield,
  BarChart3, Loader2, Info,
} from "lucide-react";

interface HeadlineData {
  total_leads: number;
  leads_hot: number;
  calls_today: number;
  dispatches_today: number;
  active_conversations: number;
  conversions: number;
}

interface CallsData {
  today: { total: number; answered: number };
  answer_rate: number;
  opt_in_rate: number;
}

interface WhatsAppData {
  today: { total: number };
  delivery_rate: number;
  read_rate: number;
  reply_rate: number;
}

interface MetaQuality {
  status: string;
  messaging_limit_tier: string;
  usage_pct: number;
}

interface TeamData {
  total: number;
  active_dispatchers: number;
  total_dispatches_today: number;
  total_limit_today: number;
}

interface AlertItem {
  type: string;
  message: string;
  severity: "info" | "warning" | "error";
}

interface QueueItem {
  name: string;
  leads_called?: number;
  dispatched?: number;
  total_leads: number;
}

interface DashboardData {
  headline: HeadlineData;
  calls: CallsData;
  whatsapp: WhatsAppData;
  meta_quality: MetaQuality;
  team: TeamData;
  alerts: AlertItem[];
  queues: {
    call_queues: QueueItem[];
    dispatch_queues: QueueItem[];
  };
}

interface KPIData {
  [key: string]: unknown;
}

const defaultData: DashboardData = {
  headline: { total_leads: 0, leads_hot: 0, calls_today: 0, dispatches_today: 0, active_conversations: 0, conversions: 0 },
  calls: { today: { total: 0, answered: 0 }, answer_rate: 0, opt_in_rate: 0 },
  whatsapp: { today: { total: 0 }, delivery_rate: 0, read_rate: 0, reply_rate: 0 },
  meta_quality: { status: "GREEN", messaging_limit_tier: "—", usage_pct: 0 },
  team: { total: 0, active_dispatchers: 0, total_dispatches_today: 0, total_limit_today: 0 },
  alerts: [],
  queues: { call_queues: [], dispatch_queues: [] },
};

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
  };
}

export default function DashboardGeral() {
  const { company_id: baseCompanyId, user_role } = useCompany();
  const { selectedCompanyId } = useCompanyFilter();
  const company_id = (selectedCompanyId && selectedCompanyId !== "all") ? selectedCompanyId : baseCompanyId;
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData>(defaultData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpiOpen, setKpiOpen] = useState(false);
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!company_id) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${EDGE_BASE}/dashboard-geral`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "overview", company_id, requester_role: user_role || "ceo" }),
      });
      if (res.ok) {
        const json = await res.json();
        setData({ ...defaultData, ...json });
      } else if (!silent) {
        toast.error("Erro ao carregar dashboard");
      }
    } catch {
      if (!silent) toast.error("Falha de conexão");
    }
    setLoading(false);
    setRefreshing(false);
  }, [company_id, user_role]);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(() => fetchDashboard(true), 60000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const fetchKPIs = async () => {
    setKpiOpen(true);
    setKpiLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${EDGE_BASE}/dashboard-geral`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "kpis", company_id, requester_role: user_role || "ceo" }),
      });
      if (res.ok) setKpiData(await res.json());
      else toast.error("Erro ao carregar KPIs");
    } catch {
      toast.error("Falha de conexão");
    }
    setKpiLoading(false);
  };

  const { headline: h, calls, whatsapp: wa, meta_quality: mq, team, alerts, queues } = data;

  const headlineCards = [
    { label: "Total de Leads", value: h.total_leads, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Leads Quentes", value: h.leads_hot, icon: Flame, color: "text-red-400", bg: "bg-red-500/10" },
    { label: "Ligações Hoje", value: h.calls_today, icon: Phone, color: "text-green-400", bg: "bg-green-500/10" },
    { label: "Disparos Hoje", value: h.dispatches_today, icon: Send, color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "Conversas Ativas", value: h.active_conversations, icon: MessageCircle, color: "text-yellow-400", bg: "bg-yellow-500/10" },
    { label: "Conversões", value: h.conversions, icon: Trophy, color: "text-amber-400", bg: "bg-amber-500/10" },
  ];

  const qualityColorMap: Record<string, string> = {
    GREEN: "bg-green-500",
    YELLOW: "bg-yellow-500",
    RED: "bg-red-500",
  };

  const alertIcon = (severity: string) => {
    if (severity === "error") return <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />;
    if (severity === "warning") return <AlertTriangle className="h-4 w-4 text-warning shrink-0" />;
    return <Info className="h-4 w-4 text-accent shrink-0" />;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-9 w-24" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-5 space-y-2"><Skeleton className="h-8 w-16" /><Skeleton className="h-3 w-24" /></CardContent></Card>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-5 space-y-3"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-full" /></CardContent></Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const teamPct = team.total_limit_today > 0 ? (team.total_dispatches_today / team.total_limit_today) * 100 : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <PageHeader title="Dashboard Geral" subtitle="Visão executiva da operação" />
          <Button variant="outline" size="sm" onClick={() => fetchDashboard(true)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* LINHA 1 — Headline Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {headlineCards.map((c) => (
            <Card key={c.label} className="cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => {
                if (c.label.includes("Lead")) navigate("/lead-distribution");
                if (c.label.includes("Ligaç")) navigate("/dashboard-voip");
                if (c.label.includes("Dispar")) navigate("/templates");
                if (c.label.includes("Convers")) navigate("/conversas");
              }}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-lg ${c.bg}`}>
                    <c.icon className={`h-4 w-4 ${c.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold tracking-tight">{c.value.toLocaleString("pt-BR")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* LINHA 2 — Calls / WhatsApp / Meta Quality */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Calls */}
          <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigate("/dashboard-voip")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Phone className="h-4 w-4 text-green-400" /> Ligações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Hoje</span>
                <span className="font-semibold">{calls.today.total} chamadas, {calls.today.answered} atendidas</span>
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Taxa de atendimento</span>
                  <span>{calls.answer_rate}%</span>
                </div>
                <Progress value={calls.answer_rate} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Taxa de opt-in</span>
                  <span>{calls.opt_in_rate}%</span>
                </div>
                <Progress value={calls.opt_in_rate} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* WhatsApp */}
          <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigate("/whatsapp-meta")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-emerald-400" /> WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Hoje</span>
                <span className="font-semibold">{wa.today.total} disparos</span>
              </div>
              {[
                { label: "Entregues", value: wa.delivery_rate },
                { label: "Lidos", value: wa.read_rate },
                { label: "Respondidos", value: wa.reply_rate },
              ].map((m) => (
                <div key={m.label}>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{m.label}</span>
                    <span>{m.value}%</span>
                  </div>
                  <Progress value={m.value} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Meta Quality */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-accent" /> Qualidade Meta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge className={`${qualityColorMap[mq.status] || "bg-muted"} text-white font-bold`}>
                  {mq.status}
                </Badge>
                <span className="text-sm text-muted-foreground">Tier: <strong className="text-foreground">{mq.messaging_limit_tier}</strong></span>
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Uso do limite</span>
                  <span>{mq.usage_pct}%</span>
                </div>
                <Progress value={mq.usage_pct} className="h-2" />
              </div>
              {mq.status === "RED" && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <span className="text-xs text-destructive font-medium">Envios pausados — qualidade crítica</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* LINHA 3 — Team & Alerts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Team */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Equipe
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-2xl font-bold">{team.total}</p>
                  <p className="text-xs text-muted-foreground">membros ativos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{team.active_dispatchers}</p>
                  <p className="text-xs text-muted-foreground">disparando hoje</p>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Disparos usados</span>
                  <span>{team.total_dispatches_today} / {team.total_limit_today}</span>
                </div>
                <Progress value={teamPct} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" /> Alertas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  Tudo operando normalmente ✓
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {alerts.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 border border-border/50 text-sm">
                      {alertIcon(a.severity)}
                      <span>{a.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* LINHA 4 — Filas Ativas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-accent" /> Filas Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="calls">
              <TabsList className="mb-3">
                <TabsTrigger value="calls">Ligações</TabsTrigger>
                <TabsTrigger value="dispatches">Disparos</TabsTrigger>
              </TabsList>
              <TabsContent value="calls">
                {queues.call_queues.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma fila ativa</p>
                ) : (
                  <div className="space-y-3">
                    {queues.call_queues.map((q, i) => {
                      const pct = q.total_leads > 0 ? ((q.leads_called || 0) / q.total_leads) * 100 : 0;
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{q.name}</span>
                            <span className="text-xs text-muted-foreground">{q.leads_called || 0}/{q.total_leads}</span>
                          </div>
                          <Progress value={pct} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="dispatches">
                {queues.dispatch_queues.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma fila ativa</p>
                ) : (
                  <div className="space-y-3">
                    {queues.dispatch_queues.map((q, i) => {
                      const pct = q.total_leads > 0 ? ((q.dispatched || 0) / q.total_leads) * 100 : 0;
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{q.name}</span>
                            <span className="text-xs text-muted-foreground">{q.dispatched || 0}/{q.total_leads}</span>
                          </div>
                          <Progress value={pct} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* LINHA 5 — KPIs Button */}
        <div className="flex justify-center">
          <Button variant="outline" onClick={fetchKPIs}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Ver KPIs Semanais
          </Button>
        </div>

        {/* KPI Modal */}
        <Dialog open={kpiOpen} onOpenChange={setKpiOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>KPIs Semanais / Mensais</DialogTitle>
            </DialogHeader>
            {kpiLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : kpiData ? (
              <div className="space-y-4">
                {Object.entries(kpiData).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border border-border/50">
                    <span className="text-sm font-medium capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="text-sm font-bold">{typeof value === "number" ? value.toLocaleString("pt-BR") : String(value)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">Sem dados de KPIs disponíveis</p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
