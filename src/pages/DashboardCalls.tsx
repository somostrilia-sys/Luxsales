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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useCompany } from "@/contexts/CompanyContext";
import { EDGE_BASE, SUPABASE_ANON_KEY } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Phone, PhoneIncoming, MessageCircle, Clock, Smile,
  CalendarClock, RefreshCw, TrendingUp, ChevronLeft,
  ChevronRight, Flame, Thermometer, Snowflake,
  CheckCircle, XCircle, Minus, BarChart3, Users,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from "recharts";

// ── helpers ──
async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
  };
}

async function callEdge(body: Record<string, unknown>) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${EDGE_BASE}/dashboard-calls`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Erro");
  return res.json();
}

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

// ── types ──
interface OverviewData {
  today: { total: number; answered: number; whatsapp_authorized: number; avg_duration_sec: number; sentiment_positive: number };
  scheduled_callbacks: number;
  week: { total_calls: number; answer_rate: number; opt_in_rate: number };
  active_queues: { name: string; status: string; leads_called: number; total_leads: number; answered: number; opt_ins: number; converted: number }[];
}

interface PerfDaily { date: string; total: number; answered: number; opted_in: number }
interface PerfData { daily: PerfDaily[]; totals: { calls: number; total_minutes: number; positive_sentiment_pct: number } }

interface HistoryRow {
  date: string; phone: string; name: string; status: string; sentiment: string;
  duration_sec: number; whatsapp_authorized: boolean; summary: string;
}
interface HistoryData { rows: HistoryRow[]; total: number }

interface FunnelStage { label: string; key: string; count: number }
interface FunnelData {
  stages: FunnelStage[];
  temperature: { hot: number; warm: number; cold: number };
}

const defaultOverview: OverviewData = {
  today: { total: 0, answered: 0, whatsapp_authorized: 0, avg_duration_sec: 0, sentiment_positive: 0 },
  scheduled_callbacks: 0,
  week: { total_calls: 0, answer_rate: 0, opt_in_rate: 0 },
  active_queues: [],
};

// ── component ──
export default function DashboardCalls() {
  const { company_id, user_role } = useCompany();
  const navigate = useNavigate();

  // overview
  const [overview, setOverview] = useState<OverviewData>(defaultOverview);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // performance
  const [perfPeriod, setPerfPeriod] = useState("30d");
  const [perf, setPerf] = useState<PerfData | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);

  // history
  const [history, setHistory] = useState<HistoryData>({ rows: [], total: 0 });
  const [histLoading, setHistLoading] = useState(false);
  const [histPage, setHistPage] = useState(0);
  const [histStatus, setHistStatus] = useState("all");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // funnel
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [funnelLoading, setFunnelLoading] = useState(false);

  const base = { company_id, requester_role: user_role || "ceo" };

  // ── fetchers ──
  const fetchOverview = useCallback(async (silent = false) => {
    if (!company_id) return;
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const d = await callEdge({ action: "overview", ...base });
      setOverview({ ...defaultOverview, ...d });
    } catch { if (!silent) toast.error("Erro ao carregar overview"); }
    setLoading(false);
    setRefreshing(false);
  }, [company_id, user_role]);

  const fetchPerf = useCallback(async () => {
    if (!company_id) return;
    setPerfLoading(true);
    try {
      setPerf(await callEdge({ action: "performance", ...base, period: perfPeriod }));
    } catch { toast.error("Erro ao carregar performance"); }
    setPerfLoading(false);
  }, [company_id, user_role, perfPeriod]);

  const fetchHistory = useCallback(async () => {
    if (!company_id) return;
    setHistLoading(true);
    try {
      const body: Record<string, unknown> = { action: "call-history", ...base, limit: 20, offset: histPage * 20 };
      if (histStatus !== "all") body.status = histStatus;
      const result = await callEdge(body);
      setHistory({ rows: result?.rows || result?.calls || [], total: result?.total || 0 });
    } catch { toast.error("Erro ao carregar histórico"); }
    setHistLoading(false);
  }, [company_id, user_role, histPage, histStatus]);

  const fetchFunnel = useCallback(async () => {
    if (!company_id) return;
    setFunnelLoading(true);
    try {
      const result = await callEdge({ action: "lead-funnel", ...base });
      const rawFunnel = result?.funnel ?? result ?? {};
      const rawStages = rawFunnel?.stages;

      const stageLabels: Record<string, string> = {
        new: "Novos",
        queued_call: "Fila de ligação",
        calling: "Ligando",
        called: "Ligados",
        opted_in: "Opt-in",
        queued_dispatch: "Fila de disparo",
        dispatched: "Disparados",
        engaged: "Engajados",
        converted: "Convertidos",
      };

      let normalizedStages: FunnelStage[] = [];

      if (Array.isArray(rawStages)) {
        normalizedStages = rawStages.map((stage: any) => ({
          label: String(stage?.label ?? stage?.key ?? "Etapa"),
          key: String(stage?.key ?? stage?.label ?? "stage"),
          count: Number(stage?.count ?? 0),
        }));
      } else if (rawStages && typeof rawStages === "object") {
        const orderedKeys = [
          "new",
          "queued_call",
          "calling",
          "called",
          "opted_in",
          "queued_dispatch",
          "dispatched",
          "engaged",
          "converted",
        ];
        const stageRecord = rawStages as Record<string, number>;
        const knownKeys = orderedKeys.filter((key) => key in stageRecord);
        const extraKeys = Object.keys(stageRecord).filter((key) => !orderedKeys.includes(key));

        normalizedStages = [...knownKeys, ...extraKeys].map((key) => ({
          key,
          label: stageLabels[key] ?? key.replace(/_/g, " "),
          count: Number(stageRecord[key] ?? 0),
        }));
      }

      setFunnel({
        stages: normalizedStages,
        temperature: {
          hot: Number(rawFunnel?.temperature?.hot ?? 0),
          warm: Number(rawFunnel?.temperature?.warm ?? 0),
          cold: Number(rawFunnel?.temperature?.cold ?? 0),
        },
      });
    } catch {
      toast.error("Erro ao carregar funil");
      setFunnel({ stages: [], temperature: { hot: 0, warm: 0, cold: 0 } });
    }
    setFunnelLoading(false);
  }, [company_id, user_role]);

  // ── effects ──
  useEffect(() => {
    fetchOverview();
    const iv = setInterval(() => fetchOverview(true), 60000);
    return () => clearInterval(iv);
  }, [fetchOverview]);

  useEffect(() => { fetchPerf(); }, [fetchPerf]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);
  useEffect(() => { fetchFunnel(); }, [fetchFunnel]);

  // ── derived ──
  const { today, week, active_queues } = overview;

  const kpiCards = [
    { label: "Ligações Hoje", value: today.total, icon: Phone, color: "text-blue-400", bg: "bg-blue-500/10", big: true },
    { label: "Atendidas", value: today.answered, icon: PhoneIncoming, color: "text-green-400", bg: "bg-green-500/10" },
    { label: "Opt-in WhatsApp", value: today.whatsapp_authorized, icon: MessageCircle, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Duração Média", value: fmtDuration(today.avg_duration_sec), icon: Clock, color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "Sentimento+", value: today.sentiment_positive, icon: Smile, color: "text-yellow-400", bg: "bg-yellow-500/10" },
    { label: "Callbacks", value: overview.scheduled_callbacks, icon: CalendarClock, color: "text-accent", bg: "bg-accent/10" },
  ];

  const statusBadge = (s: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      completed: { label: "Atendida", cls: "bg-green-500/15 text-green-400 border-green-500/30" },
      no_answer: { label: "Sem resp.", cls: "bg-muted text-muted-foreground border-border" },
      failed: { label: "Falha", cls: "bg-destructive/15 text-destructive border-destructive/30" },
      busy: { label: "Ocupado", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
    };
    const m = map[s] || { label: s, cls: "bg-muted text-muted-foreground border-border" };
    return <Badge variant="outline" className={`text-xs ${m.cls}`}>{m.label}</Badge>;
  };

  const sentimentEmoji = (s: string) => {
    if (s === "positive") return "😊";
    if (s === "negative") return "😞";
    return "😐";
  };

  // ── loading skeleton ──
  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-56" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-5 space-y-2"><Skeleton className="h-8 w-16" /><Skeleton className="h-3 w-24" /></CardContent></Card>
            ))}
          </div>
          <Card><CardContent className="pt-5 space-y-3"><Skeleton className="h-4 w-40" /><Skeleton className="h-48 w-full" /></CardContent></Card>
        </div>
      </DashboardLayout>
    );
  }

  const maxFunnel = funnel ? Math.max(...funnel.stages.map(s => s.count), 1) : 1;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <PageHeader title="Dashboard de Ligações" subtitle="Visão geral das chamadas IA" />
          <Button variant="outline" size="sm" onClick={() => fetchOverview(true)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>

        {/* ═══ SEÇÃO 1 — Overview ═══ */}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpiCards.map((c) => (
            <Card key={c.label}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-lg ${c.bg}`}>
                    <c.icon className={`h-4 w-4 ${c.color}`} />
                  </div>
                </div>
                <p className={`font-bold tracking-tight ${c.big ? "text-3xl" : "text-2xl"}`}>
                  {typeof c.value === "number" ? c.value.toLocaleString("pt-BR") : c.value}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Week summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Semana
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-2xl font-bold">{week.total_calls.toLocaleString("pt-BR")}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Atendimento</span><span>{week.answer_rate}%</span>
                </div>
                <Progress value={week.answer_rate} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Opt-in</span><span>{week.opt_in_rate}%</span>
                </div>
                <Progress value={week.opt_in_rate} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Queues */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-accent" /> Filas de Ligação
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate("/call-campaigns")}>Gerenciar Filas</Button>
          </CardHeader>
          <CardContent>
            {active_queues.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma fila ativa</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="text-left py-2">Nome</th>
                      <th className="text-center py-2">Status</th>
                      <th className="text-center py-2">Progresso</th>
                      <th className="text-center py-2">Atendidos</th>
                      <th className="text-center py-2">Opt-ins</th>
                      <th className="text-center py-2">Convertidos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active_queues.map((q, i) => {
                      const pct = q.total_leads > 0 ? (q.leads_called / q.total_leads) * 100 : 0;
                      return (
                        <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                          <td className="py-2 font-medium">{q.name}</td>
                          <td className="text-center py-2">
                            <Badge variant="outline" className="text-xs">{q.status}</Badge>
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-2">
                              <Progress value={pct} className="flex-1 h-2" />
                              <span className="text-xs text-muted-foreground w-16 text-right">{q.leads_called}/{q.total_leads}</span>
                            </div>
                          </td>
                          <td className="text-center py-2">{q.answered}</td>
                          <td className="text-center py-2">{q.opt_ins}</td>
                          <td className="text-center py-2">{q.converted}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ SEÇÃO 2 — Performance ═══ */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-400" /> Performance
            </CardTitle>
            <div className="flex gap-1">
              {["7d", "30d", "90d"].map((p) => (
                <Button key={p} variant={perfPeriod === p ? "default" : "ghost"} size="sm" className="h-7 text-xs px-2.5"
                  onClick={() => setPerfPeriod(p)}>{p}</Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {perfLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : perf?.daily && perf.daily.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={perf.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="total" name="Total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="answered" name="Atendidas" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="opted_in" name="Opt-in" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="text-center p-3 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-xl font-bold">{perf.totals.calls.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-muted-foreground">Total chamadas</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-xl font-bold">{perf.totals.total_minutes.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-muted-foreground">Minutos</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-xl font-bold">{perf.totals.positive_sentiment_pct}%</p>
                    <p className="text-xs text-muted-foreground">Sentimento+</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados de performance</p>
            )}
          </CardContent>
        </Card>

        {/* ═══ SEÇÃO 3 — Histórico ═══ */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" /> Histórico de Chamadas
            </CardTitle>
            <Select value={histStatus} onValueChange={(v) => { setHistStatus(v); setHistPage(0); }}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="completed">Atendidas</SelectItem>
                <SelectItem value="no_answer">Sem resposta</SelectItem>
                <SelectItem value="failed">Falha</SelectItem>
                <SelectItem value="busy">Ocupado</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {histLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : history.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma chamada encontrada</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left py-2">Data/Hora</th>
                        <th className="text-left py-2">Telefone</th>
                        <th className="text-left py-2">Nome</th>
                        <th className="text-center py-2">Status</th>
                        <th className="text-center py-2">Sent.</th>
                        <th className="text-center py-2">Duração</th>
                        <th className="text-center py-2">WA</th>
                        <th className="text-left py-2">Resumo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.rows.map((r, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-muted/20 cursor-pointer" onClick={() => setExpandedRow(expandedRow === i ? null : i)}>
                          <td className="py-2 text-xs">{fmtDate(r.date)}</td>
                          <td className="py-2 font-mono text-xs">{r.phone}</td>
                          <td className="py-2">{r.name || "—"}</td>
                          <td className="py-2 text-center">{statusBadge(r.status)}</td>
                          <td className="py-2 text-center text-base">{sentimentEmoji(r.sentiment)}</td>
                          <td className="py-2 text-center text-xs">{fmtDuration(r.duration_sec)}</td>
                          <td className="py-2 text-center">
                            {r.whatsapp_authorized
                              ? <CheckCircle className="h-4 w-4 text-green-400 mx-auto" />
                              : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                          </td>
                          <td className="py-2 text-xs max-w-[200px]">
                            {expandedRow === i ? r.summary : (r.summary?.slice(0, 60) + (r.summary?.length > 60 ? "…" : ""))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-muted-foreground">{history.total} chamadas</p>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={histPage === 0} onClick={() => setHistPage(p => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs flex items-center px-2">{histPage + 1}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={(histPage + 1) * 20 >= history.total} onClick={() => setHistPage(p => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ═══ SEÇÃO 4 — Funil ═══ */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Funil de Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            {funnelLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : funnel ? (
              <div className="space-y-5">
                {/* Horizontal bar funnel */}
                <div className="space-y-2">
                  {funnel.stages.map((s, i) => {
                    const pct = maxFunnel > 0 ? (s.count / maxFunnel) * 100 : 0;
                    const convRate = i > 0 && funnel.stages[i - 1].count > 0
                      ? ((s.count / funnel.stages[i - 1].count) * 100).toFixed(1)
                      : null;
                    return (
                      <div key={s.key}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="font-medium">{s.label}</span>
                          <span className="text-muted-foreground">
                            {s.count.toLocaleString("pt-BR")}
                            {convRate && <span className="ml-2 text-primary">({convRate}%)</span>}
                          </span>
                        </div>
                        <div className="h-6 rounded-md bg-muted/40 overflow-hidden">
                          <div
                            className="h-full rounded-md bg-gradient-to-r from-primary/80 to-primary/40 transition-all"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Temperature cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <Flame className="h-5 w-5 text-red-400 mx-auto mb-1" />
                    <p className="text-xl font-bold">{funnel.temperature.hot}</p>
                    <p className="text-xs text-muted-foreground">Hot</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <Thermometer className="h-5 w-5 text-yellow-400 mx-auto mb-1" />
                    <p className="text-xl font-bold">{funnel.temperature.warm}</p>
                    <p className="text-xs text-muted-foreground">Warm</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Snowflake className="h-5 w-5 text-blue-400 mx-auto mb-1" />
                    <p className="text-xl font-bold">{funnel.temperature.cold}</p>
                    <p className="text-xs text-muted-foreground">Cold</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">Sem dados de funil</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
