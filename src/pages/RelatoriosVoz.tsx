import { useEffect, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  BarChart3, Phone, Clock, TrendingUp,
  Download, Loader2, Activity, Target, Zap,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#6B7280"];

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min ${s}s`;
};

const statusLabel: Record<string, string> = {
  completed: "Atendida",
  failed: "Falhou",
  no_answer: "Sem Resposta",
  busy: "Ocupado",
  voicemail: "Caixa Postal",
  pending: "Pendente",
  ringing: "Chamando",
  in_progress: "Em Andamento",
};

interface CallLog {
  id: string;
  lead_phone: string | null;
  lead_name: string | null;
  status: string;
  duration_seconds: number;
  created_at: string;
  collaborator_id: string | null;
}

interface DailyPoint {
  date: string;
  calls: number;
  answered: number;
}

interface HourlyPoint {
  hour: string;
  calls: number;
  answered: number;
}

interface StatusDist {
  name: string;
  value: number;
}

interface AgentRow {
  name: string;
  calls: number;
  answered: number;
  totalDuration: number;
  answerRate: number;
}

export default function RelatoriosVoz() {
  const { collaborator } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();
  const [period, setPeriod] = useState("7");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("geral");

  const [metrics, setMetrics] = useState({
    totalCalls: 0,
    answeredCalls: 0,
    totalDuration: 0,
    avgDuration: 0,
    answerRate: 0,
  });

  const [dailyTrend, setDailyTrend] = useState<DailyPoint[]>([]);
  const [callsByHour, setCallsByHour] = useState<HourlyPoint[]>([]);
  const [statusDist, setStatusDist] = useState<StatusDist[]>([]);
  const [agentRows, setAgentRows] = useState<AgentRow[]>([]);
  const [recentCalls, setRecentCalls] = useState<CallLog[]>([]);

  const loadReport = useCallback(async () => {
    setLoading(true);

    const companyId =
      selectedCompanyId !== "all"
        ? selectedCompanyId
        : collaborator?.company_id ?? null;

    const days = Number(period);
    const since = new Date();
    if (days === 1) {
      since.setHours(0, 0, 0, 0);
    } else {
      since.setDate(since.getDate() - (days - 1));
      since.setHours(0, 0, 0, 0);
    }

    // Fetch call_logs
    let callQ = supabase
      .from("call_logs")
      .select("id, lead_phone, lead_name, status, duration_seconds, created_at, collaborator_id")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false });
    if (companyId) callQ = callQ.eq("company_id", companyId);

    let callData: CallLog[] = [];
    try {
      const { data, error } = await callQ;
      if (error && (error.code === "42P01" || error.message?.includes("does not exist"))) {
        // table doesn't exist yet
        callData = [];
      } else {
        callData = (data ?? []) as CallLog[];
      }
    } catch {
      callData = [];
    }

    const total = callData.length;
    const answered = callData.filter((c) => c.status === "completed").length;
    const totalDuration = callData.reduce((s, c) => s + (c.duration_seconds ?? 0), 0);

    setMetrics({
      totalCalls: total,
      answeredCalls: answered,
      totalDuration,
      avgDuration: answered > 0 ? Math.round(totalDuration / answered) : 0,
      answerRate: total > 0 ? Math.round((answered / total) * 100) : 0,
    });

    // Recent calls (top 20)
    setRecentCalls(callData.slice(0, 20));

    // Daily trend
    const dayMap: Record<string, DailyPoint> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      dayMap[key] = { date: key, calls: 0, answered: 0 };
    }
    callData.forEach((c) => {
      const key = new Date(c.created_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });
      if (dayMap[key]) {
        dayMap[key].calls++;
        if (c.status === "completed") dayMap[key].answered++;
      }
    });
    setDailyTrend(Object.values(dayMap));

    // Hourly distribution
    const hourMap: Record<number, HourlyPoint> = {};
    for (let h = 0; h < 24; h++) {
      hourMap[h] = { hour: `${h}h`, calls: 0, answered: 0 };
    }
    callData.forEach((c) => {
      const h = new Date(c.created_at).getHours();
      hourMap[h].calls++;
      if (c.status === "completed") hourMap[h].answered++;
    });
    // Only show hours with data
    const hourlyWithData = Object.values(hourMap).filter((h) => h.calls > 0);
    setCallsByHour(hourlyWithData.length > 0 ? hourlyWithData : Object.values(hourMap).slice(8, 20));

    // Status distribution
    const stMap: Record<string, number> = {};
    callData.forEach((c) => {
      const s = c.status || "unknown";
      stMap[s] = (stMap[s] || 0) + 1;
    });
    setStatusDist(
      Object.entries(stMap)
        .map(([name, value]) => ({ name: statusLabel[name] ?? name, value }))
        .sort((a, b) => b.value - a.value)
    );

    // Agent performance
    const agentMap: Record<string, { name: string; calls: number; answered: number; totalDuration: number }> = {};
    const collabIds = [...new Set(callData.map((c) => c.collaborator_id).filter(Boolean))] as string[];

    if (collabIds.length > 0) {
      const { data: collabs } = await supabase
        .from("collaborators")
        .select("id, name")
        .in("id", collabIds);
      const nameMap = Object.fromEntries(
        (collabs ?? []).map((c: { id: string; name: string }) => [c.id, c.name])
      );
      callData.forEach((c) => {
        const cid = c.collaborator_id || "__unknown__";
        if (!agentMap[cid]) {
          agentMap[cid] = {
            name: c.collaborator_id ? (nameMap[c.collaborator_id] || "Agente") : "Sem agente",
            calls: 0,
            answered: 0,
            totalDuration: 0,
          };
        }
        agentMap[cid].calls++;
        if (c.status === "completed") {
          agentMap[cid].answered++;
          agentMap[cid].totalDuration += c.duration_seconds ?? 0;
        }
      });
    }

    setAgentRows(
      Object.values(agentMap)
        .map((a) => ({
          ...a,
          answerRate: a.calls > 0 ? Math.round((a.answered / a.calls) * 100) : 0,
        }))
        .sort((a, b) => b.calls - a.calls)
    );

    setLoading(false);
  }, [period, selectedCompanyId, collaborator?.company_id]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const exportCSV = () => {
    if (recentCalls.length === 0) {
      toast.info("Nenhuma ligação para exportar");
      return;
    }
    const header = "ID,Telefone,Nome,Status,Duração(s),Data\n";
    const rows = recentCalls
      .map(
        (c) =>
          `${c.id},${c.lead_phone ?? ""},${c.lead_name ?? ""},${c.status},${c.duration_seconds},${c.created_at}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ligacoes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado em CSV!");
  };

  const kpis = [
    {
      label: "Total Ligações",
      value: metrics.totalCalls.toLocaleString("pt-BR"),
      icon: Phone,
      color: "text-primary",
    },
    {
      label: "Taxa Atendimento",
      value: `${metrics.answerRate}%`,
      icon: Target,
      color: "text-emerald-400",
    },
    {
      label: "Duração Média",
      value: formatDuration(metrics.avgDuration),
      icon: Clock,
      color: "text-blue-400",
    },
    {
      label: "Tempo Total",
      value: formatDuration(metrics.totalDuration),
      icon: Activity,
      color: "text-violet-400",
    },
    {
      label: "Atendidas",
      value: metrics.answeredCalls.toLocaleString("pt-BR"),
      icon: Zap,
      color: "text-emerald-400",
    },
    {
      label: "Não Atendidas",
      value: (metrics.totalCalls - metrics.answeredCalls).toLocaleString("pt-BR"),
      icon: TrendingUp,
      color: "text-red-400",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Relatórios de Voz & Ligações"
          subtitle="Métricas detalhadas de chamadas e performance"
        >
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Hoje</SelectItem>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1.5" />
              Exportar
            </Button>
          </div>
        </PageHeader>

        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {kpis.map((s) => (
                <Card key={s.label} className="bg-card border-border/60">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                        <s.icon className={`h-5 w-5 ${s.color}`} />
                      </div>
                      <div>
                        <p className="text-xl font-bold text-foreground">{s.value}</p>
                        <p className="text-[10px] text-muted-foreground">{s.label}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="h-auto flex-wrap gap-2 rounded-xl border border-border/60 bg-secondary/40 p-1">
                <TabsTrigger value="geral">Visão Geral</TabsTrigger>
                <TabsTrigger value="recentes">Ligações Recentes</TabsTrigger>
                <TabsTrigger value="agentes">Performance por Agente</TabsTrigger>
              </TabsList>

              {/* VISÃO GERAL */}
              <TabsContent value="geral" className="space-y-6">
                {metrics.totalCalls === 0 ? (
                  <Card className="border-border/60 bg-card">
                    <CardContent className="flex items-center justify-center py-16 text-muted-foreground">
                      <BarChart3 className="h-5 w-5 mr-2" />
                      Nenhuma ligação registrada no período
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid md:grid-cols-2 gap-6">
                    <Card className="border-border/60 bg-card">
                      <CardHeader>
                        <CardTitle className="text-base">Ligações por Dia</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={dailyTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Bar
                              dataKey="calls"
                              fill="hsl(var(--primary))"
                              name="Total"
                              radius={[4, 4, 0, 0]}
                            />
                            <Bar
                              dataKey="answered"
                              fill="#10B981"
                              name="Atendidas"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-card">
                      <CardHeader>
                        <CardTitle className="text-base">Distribuição por Status</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {statusDist.length === 0 ? (
                          <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
                            Sem dados
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={statusDist}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={90}
                                dataKey="value"
                                label={({ name, percent }) =>
                                  `${name} ${(percent * 100).toFixed(0)}%`
                                }
                                labelLine={false}
                              >
                                {statusDist.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {metrics.totalCalls > 0 && (
                  <Card className="border-border/60 bg-card">
                    <CardHeader>
                      <CardTitle className="text-base">Ligações por Hora do Dia</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={callsByHour}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar
                            dataKey="calls"
                            fill="hsl(var(--primary))"
                            name="Total"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="answered"
                            fill="#10B981"
                            name="Atendidas"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {metrics.totalCalls > 0 && (
                  <Card className="border-border/60 bg-card">
                    <CardHeader>
                      <CardTitle className="text-base">Tendência Diária</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={dailyTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="calls"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            name="Total"
                            dot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="answered"
                            stroke="#10B981"
                            strokeWidth={2}
                            name="Atendidas"
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* LIGAÇÕES RECENTES */}
              <TabsContent value="recentes" className="space-y-6">
                <Card className="border-border/60 bg-card">
                  <CardHeader>
                    <CardTitle className="text-base">Ligações Recentes</CardTitle>
                    <CardDescription>Últimas 20 chamadas no período selecionado</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {recentCalls.length === 0 ? (
                      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                        <Phone className="h-5 w-5 mr-2" />
                        Nenhuma ligação registrada
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Telefone</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Duração</TableHead>
                            <TableHead>Data/Hora</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentCalls.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell className="font-mono text-sm">
                                {c.lead_phone || "—"}
                              </TableCell>
                              <TableCell>{c.lead_name || "—"}</TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    c.status === "completed"
                                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                      : c.status === "failed"
                                      ? "bg-red-500/20 text-red-400 border-red-500/30"
                                      : "bg-muted/50 text-muted-foreground"
                                  }
                                >
                                  {statusLabel[c.status] ?? c.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {formatDuration(c.duration_seconds ?? 0)}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-xs">
                                {new Date(c.created_at).toLocaleString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* PERFORMANCE AGENTES */}
              <TabsContent value="agentes" className="space-y-6">
                <Card className="border-border/60 bg-card">
                  <CardHeader>
                    <CardTitle className="text-base">Performance por Agente</CardTitle>
                    <CardDescription>Dados de chamadas agrupados por colaborador</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {agentRows.length === 0 ? (
                      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                        <Phone className="h-5 w-5 mr-2" />
                        Nenhuma ligação registrada no período
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Agente</TableHead>
                            <TableHead>Ligações</TableHead>
                            <TableHead>Atendidas</TableHead>
                            <TableHead>Taxa Atend.</TableHead>
                            <TableHead>Tempo Total</TableHead>
                            <TableHead>Duração Média</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {agentRows.map((a, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{a.name}</TableCell>
                              <TableCell>{a.calls.toLocaleString("pt-BR")}</TableCell>
                              <TableCell>{a.answered.toLocaleString("pt-BR")}</TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    a.answerRate >= 50
                                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                      : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                                  }
                                >
                                  {a.answerRate}%
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {formatDuration(a.totalDuration)}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {formatDuration(a.answered > 0 ? Math.round(a.totalDuration / a.answered) : 0)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
