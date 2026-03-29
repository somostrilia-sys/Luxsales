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
  Users, Phone, MessageCircle, UserCheck,
  RefreshCw, AlertTriangle, CheckCircle, Shield,
  BarChart3, Loader2, Info,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

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
  calls: { today: { total: 0, answered: 0 }, answer_rate: 0, opt_in_rate: 0 },
  whatsapp: { today: { total: 0 }, delivery_rate: 0, read_rate: 0, reply_rate: 0 },
  meta_quality: { status: "GREEN", messaging_limit_tier: "—", usage_pct: 0 },
  team: { total: 0, active_dispatchers: 0, total_dispatches_today: 0, total_limit_today: 0 },
  alerts: [],
  queues: { call_queues: [], dispatch_queues: [] },
};

const CHART_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#6B7280"];

const CREATE_CALL_LOGS_SQL = `
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_phone TEXT,
  lead_name TEXT,
  company_id UUID REFERENCES companies(id),
  collaborator_id UUID REFERENCES collaborators(id),
  duration_seconds INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','ringing','in_progress','completed','failed','no_answer','busy','voicemail')),
  recording_url TEXT,
  notes TEXT,
  disposition TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "call_logs_all" ON call_logs FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_call_logs_company ON call_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_created ON call_logs(created_at);
`;

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
  const company_id = selectedCompanyId !== "all" ? selectedCompanyId : baseCompanyId;
  const navigate = useNavigate();

  // Edge-function data (existing sections)
  const [data, setData] = useState<DashboardData>(defaultData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpiOpen, setKpiOpen] = useState(false);
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);

  // Real KPI cards (Supabase direct)
  const [realKpis, setRealKpis] = useState({
    totalLeads: 0,
    activeConversations: 0,
    callsToday: 0,
    activeCollaborators: 0,
  });
  const [kpisLoading, setKpisLoading] = useState(true);

  // Chart data
  const [leadsPerDay, setLeadsPerDay] = useState<{ date: string; leads: number }[]>([]);
  const [leadsBySource, setLeadsBySource] = useState<{ name: string; value: number }[]>([]);
  const [topCompanies, setTopCompanies] = useState<{ name: string; leads: number }[]>([]);
  const [chartsLoading, setChartsLoading] = useState(true);

  // ---- Edge function fetch (existing sections) ----
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

  // ---- KPI modal ----
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

  // ---- Ensure call_logs table exists ----
  const ensureCallLogs = useCallback(async () => {
    const { error } = await supabase.from("call_logs").select("id").limit(1);
    if (error && (error.code === "42P01" || error.message?.includes("does not exist"))) {
      try {
        const headers = await getAuthHeaders();
        await fetch(`${EDGE_BASE}/run-sql`, {
          method: "POST",
          headers,
          body: JSON.stringify({ sql: CREATE_CALL_LOGS_SQL }),
        });
      } catch { /* ignore */ }
    }
  }, []);

  // ---- Real KPI cards ----
  const fetchRealKPIs = useCallback(async () => {
    setKpisLoading(true);
    const filter = selectedCompanyId !== "all" ? selectedCompanyId : null;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [leadsRes, convRes, collabRes] = await Promise.all([
      (() => {
        let q = supabase.from("leads_master").select("id", { count: "exact", head: true });
        if (filter) q = q.eq("company_id", filter);
        return q;
      })(),
      (() => {
        let q = supabase.from("wa_conversations").select("id", { count: "exact", head: true }).neq("status", "closed");
        if (filter) q = q.eq("company_id", filter);
        return q;
      })(),
      (() => {
        let q = supabase.from("collaborators").select("id", { count: "exact", head: true }).eq("active", true);
        if (filter) q = q.eq("company_id", filter);
        return q;
      })(),
    ]);

    let callsToday = 0;
    try {
      let callQ = supabase
        .from("call_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString());
      if (filter) callQ = callQ.eq("company_id", filter);
      const { count } = await callQ;
      callsToday = count ?? 0;
    } catch { /* call_logs may not exist yet */ }

    setRealKpis({
      totalLeads: leadsRes.count ?? 0,
      activeConversations: convRes.count ?? 0,
      callsToday,
      activeCollaborators: collabRes.count ?? 0,
    });
    setKpisLoading(false);
  }, [selectedCompanyId]);

  // ---- Chart data ----
  const fetchChartData = useCallback(async () => {
    setChartsLoading(true);
    const filter = selectedCompanyId !== "all" ? selectedCompanyId : null;
    const since = new Date();
    since.setDate(since.getDate() - 29);
    since.setHours(0, 0, 0, 0);

    // Leads per day (last 30 days)
    let lpQ = supabase
      .from("leads_master")
      .select("created_at")
      .gte("created_at", since.toISOString());
    if (filter) lpQ = lpQ.eq("company_id", filter);
    const { data: rawLeads } = await lpQ;

    const dayMap: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      dayMap[d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })] = 0;
    }
    (rawLeads ?? []).forEach((l: { created_at: string }) => {
      const key = new Date(l.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      if (key in dayMap) dayMap[key]++;
    });
    setLeadsPerDay(Object.entries(dayMap).map(([date, leads]) => ({ date, leads })));

    // Leads by source
    let srcQ = supabase.from("leads_master").select("source");
    if (filter) srcQ = srcQ.eq("company_id", filter);
    const { data: rawSrc } = await srcQ;
    const srcMap: Record<string, number> = {};
    (rawSrc ?? []).forEach((l: { source: string | null }) => {
      const src = l.source || "Desconhecido";
      srcMap[src] = (srcMap[src] || 0) + 1;
    });
    setLeadsBySource(
      Object.entries(srcMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
    );

    // Top 5 companies (only for "all")
    if (selectedCompanyId === "all") {
      const { data: rawCompLeads } = await supabase
        .from("leads_master")
        .select("company_id");
      const cntMap: Record<string, number> = {};
      (rawCompLeads ?? []).forEach((l: { company_id: string | null }) => {
        if (l.company_id) cntMap[l.company_id] = (cntMap[l.company_id] || 0) + 1;
      });
      const top5 = Object.entries(cntMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (top5.length > 0) {
        const { data: comps } = await supabase
          .from("companies")
          .select("id, name")
          .in("id", top5.map(([id]) => id));
        const nameMap = Object.fromEntries(
          (comps ?? []).map((c: { id: string; name: string }) => [c.id, c.name])
        );
        setTopCompanies(top5.map(([id, leads]) => ({ name: nameMap[id] || id, leads })));
      } else {
        setTopCompanies([]);
      }
    } else {
      setTopCompanies([]);
    }

    setChartsLoading(false);
  }, [selectedCompanyId]);

  useEffect(() => {
    ensureCallLogs();
  }, [ensureCallLogs]);

  useEffect(() => {
    fetchRealKPIs();
    fetchChartData();
  }, [fetchRealKPIs, fetchChartData]);

  // ---- KPI cards config ----
  const kpiCards = [
    {
      label: "Total Leads",
      value: realKpis.totalLeads,
      icon: Users,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      onClick: () => navigate("/lead-distribution"),
    },
    {
      label: "Conversas WA Ativas",
      value: realKpis.activeConversations,
      icon: MessageCircle,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      onClick: () => navigate("/conversas"),
    },
    {
      label: "Ligações Hoje",
      value: realKpis.callsToday,
      icon: Phone,
      color: "text-green-400",
      bg: "bg-green-500/10",
      onClick: () => navigate("/dashboard-voip"),
    },
    {
      label: "Colaboradores Ativos",
      value: realKpis.activeCollaborators,
      icon: UserCheck,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      onClick: () => navigate("/equipe"),
    },
  ];

  const { calls, whatsapp: wa, meta_quality: mq, team, alerts, queues } = data;

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

  const teamPct =
    team.total_limit_today > 0
      ? (team.total_dispatches_today / team.total_limit_today) * 100
      : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <PageHeader title="Dashboard Geral" subtitle="Visão executiva da operação" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchDashboard(true);
              fetchRealKPIs();
              fetchChartData();
            }}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* LINHA 1 — 4 KPI Cards (dados reais Supabase) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpisLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-5 space-y-2">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-3 w-24" />
                  </CardContent>
                </Card>
              ))
            : kpiCards.map((c) => (
                <Card
                  key={c.label}
                  className="cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={c.onClick}
                >
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg ${c.bg}`}>
                        <c.icon className={`h-4 w-4 ${c.color}`} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold tracking-tight">
                      {c.value.toLocaleString("pt-BR")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
                  </CardContent>
                </Card>
              ))}
        </div>

        {/* LINHA 2 — Calls / WhatsApp / Meta Quality */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-5 space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Calls */}
            <Card
              className="cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => navigate("/dashboard-voip")}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Phone className="h-4 w-4 text-green-400" /> Ligações
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Hoje</span>
                  <span className="font-semibold">
                    {calls.today.total} chamadas, {calls.today.answered} atendidas
                  </span>
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
            <Card
              className="cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => navigate("/whatsapp-meta")}
            >
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
                  <span className="text-sm text-muted-foreground">
                    Tier: <strong className="text-foreground">{mq.messaging_limit_tier}</strong>
                  </span>
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
                    <span className="text-xs text-destructive font-medium">
                      Envios pausados — qualidade crítica
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* LINHA 3 — Gráficos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Leads por dia */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Leads por Dia (últimos 30 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              {chartsLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : leadsPerDay.every((d) => d.leads === 0) ? (
                <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                  Sem dados no período
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={leadsPerDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9 }}
                      interval={Math.floor(leadsPerDay.length / 6)}
                    />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Bar dataKey="leads" fill="hsl(var(--primary))" name="Leads" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Leads por fonte */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Leads por Fonte</CardTitle>
            </CardHeader>
            <CardContent>
              {chartsLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : leadsBySource.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                  Sem dados
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={leadsBySource}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {leadsBySource.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top 5 Empresas (só quando "all") */}
        {selectedCompanyId === "all" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Top 5 Empresas por Leads</CardTitle>
            </CardHeader>
            <CardContent>
              {chartsLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : topCompanies.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                  Sem dados
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={topCompanies} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip />
                    <Bar dataKey="leads" fill="hsl(var(--primary))" name="Leads" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}

        {/* LINHA 4 — Team & Alerts */}
        {!loading && (
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
                    <span>
                      {team.total_dispatches_today} / {team.total_limit_today}
                    </span>
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
                      <div
                        key={i}
                        className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 border border-border/50 text-sm"
                      >
                        {alertIcon(a.severity)}
                        <span>{a.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* LINHA 5 — Filas Ativas */}
        {!loading && (
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
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma fila ativa
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {queues.call_queues.map((q, i) => {
                        const pct =
                          q.total_leads > 0 ? ((q.leads_called || 0) / q.total_leads) * 100 : 0;
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{q.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {q.leads_called || 0}/{q.total_leads}
                              </span>
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
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma fila ativa
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {queues.dispatch_queues.map((q, i) => {
                        const pct =
                          q.total_leads > 0 ? ((q.dispatched || 0) / q.total_leads) * 100 : 0;
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{q.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {q.dispatched || 0}/{q.total_leads}
                              </span>
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
        )}

        {/* LINHA 6 — KPIs Button */}
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
                  <div
                    key={key}
                    className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <span className="text-sm font-medium capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="text-sm font-bold">
                      {typeof value === "number" ? value.toLocaleString("pt-BR") : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                Sem dados de KPIs disponíveis
              </p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
