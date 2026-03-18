import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Phone, PhoneCall, Clock, Users, Target, Activity,
  Flame, Sun, Snowflake, Loader2, TrendingUp,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const COLORS = ["#CC0000", "#F39C12", "#3498DB", "#6B7280"];

const formatDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
};

const qualBadge = (q: string | null) => {
  if (q === "hot") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><Flame className="h-3 w-3 mr-1" />HOT</Badge>;
  if (q === "warm") return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Sun className="h-3 w-3 mr-1" />WARM</Badge>;
  if (q === "cold") return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Snowflake className="h-3 w-3 mr-1" />COLD</Badge>;
  return <span className="text-muted-foreground text-xs">—</span>;
};

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    answered: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    ringing: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 animate-pulse",
    no_answer: "bg-red-500/20 text-red-400 border-red-500/30",
    busy: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    initiated: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  const label: Record<string, string> = {
    answered: "Atendida", completed: "Completa", ringing: "Chamando",
    no_answer: "Não Atendeu", busy: "Ocupado", initiated: "Iniciada",
  };
  return <Badge variant="outline" className={map[s] ?? "bg-muted text-muted-foreground"}>{label[s] ?? s}</Badge>;
};

export default function DashboardVoip() {
  const { collaborator } = useCollaborator();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>({});
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [callsByHour, setCallsByHour] = useState<any[]>([]);
  const [leadStatusDist, setLeadStatusDist] = useState<any[]>([]);

  useEffect(() => {
    loadDashboard();
    // Realtime subscription on calls
    const channel = supabase
      .channel("voip-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "calls" }, () => {
        loadDashboard();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "agents" }, () => {
        loadDashboard();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [collaborator]);

  const loadDashboard = async () => {
    setLoading(true);
    const companyId = collaborator?.company_id;
    if (!companyId) { setLoading(false); return; }

    // Load metrics via RPC
    const { data: metricsData } = await supabase.rpc("get_dashboard_metrics", {
      p_company_id: companyId,
      p_date: new Date().toISOString().slice(0, 10),
    } as any);
    if (metricsData) setMetrics(metricsData);

    // Recent calls
    const { data: calls } = await supabase
      .from("calls")
      .select("id, destination_number, status, duration_seconds, talk_time_seconds, ai_qualification, ai_summary, started_at, ai_handled")
      .eq("company_id", companyId)
      .order("started_at", { ascending: false })
      .limit(15);
    setRecentCalls(calls ?? []);

    // Build hourly distribution from calls
    const hourCounts: Record<string, { total: number; answered: number }> = {};
    for (let h = 8; h <= 19; h++) {
      hourCounts[`${h}h`] = { total: 0, answered: 0 };
    }
    (calls ?? []).forEach((c: any) => {
      if (c.started_at) {
        const hour = new Date(c.started_at).getHours();
        const key = `${hour}h`;
        if (hourCounts[key]) {
          hourCounts[key].total++;
          if (c.status === "answered" || c.status === "completed") hourCounts[key].answered++;
        }
      }
    });
    setCallsByHour(Object.entries(hourCounts).map(([hour, v]) => ({ hour, ...v })));

    // Lead status distribution
    const { data: leads } = await supabase
      .from("leads" as any)
      .select("status")
      .eq("company_id", companyId)
      .limit(1000);
    const dist: Record<string, number> = {};
    (leads ?? []).forEach((l: any) => {
      const s = l.status ?? "new";
      dist[s] = (dist[s] || 0) + 1;
    });
    setLeadStatusDist(Object.entries(dist).map(([name, value]) => ({ name, value })));

    setLoading(false);
  };

  const kpis = [
    { label: "Ligações Hoje", value: metrics.total_calls ?? 0, icon: Phone, color: "text-primary" },
    { label: "Atendidas %", value: `${metrics.answer_rate ?? 0}%`, icon: Target, color: "text-emerald-400" },
    { label: "Tempo Médio", value: formatDuration(metrics.avg_talk_time ?? 0), icon: Clock, color: "text-blue-400" },
    { label: "Leads Qualificados", value: metrics.qualified_leads ?? 0, icon: Flame, color: "text-red-400" },
    { label: "Agentes Online", value: metrics.agents_online ?? 0, icon: Users, color: "text-violet-400" },
    { label: "Ligações Ativas", value: metrics.active_calls ?? 0, icon: Activity, color: "text-emerald-400" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Dashboard VoIP"
          subtitle="Métricas em tempo real do sistema de ligações com IA"
          badge={<Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Realtime</Badge>}
        />

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="bg-card border-border/60"><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {kpis.map((k) => (
                <Card key={k.label} className="bg-card border-border/60">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center">
                        <k.icon className={`h-5 w-5 ${k.color}`} />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{typeof k.value === "number" ? k.value.toLocaleString("pt-BR") : k.value}</p>
                        <p className="text-[10px] text-muted-foreground">{k.label}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-border/60 bg-card">
                <CardHeader><CardTitle className="text-base">Ligações por Hora</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={callsByHour}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="total" fill="hsl(var(--primary))" name="Total" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="answered" fill="#27AE60" name="Atendidas" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card">
                <CardHeader><CardTitle className="text-base">Status dos Leads</CardTitle></CardHeader>
                <CardContent>
                  {leadStatusDist.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={leadStatusDist} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {leadStatusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Nenhum lead encontrado</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Calls Table */}
            <Card className="border-border/60 bg-card">
              <CardHeader><CardTitle className="text-base">Últimas Ligações</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Qualificação</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>IA</TableHead>
                      <TableHead>Horário</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentCalls.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma ligação registrada hoje</TableCell></TableRow>
                    ) : recentCalls.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-foreground font-mono text-sm">{c.destination_number}</TableCell>
                        <TableCell>{statusBadge(c.status)}</TableCell>
                        <TableCell>{qualBadge(c.ai_qualification)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDuration(c.duration_seconds ?? 0)}</TableCell>
                        <TableCell>{c.ai_handled ? <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-xs">IA</Badge> : "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{c.started_at ? new Date(c.started_at).toLocaleTimeString("pt-BR") : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
