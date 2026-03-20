import { useEffect, useState } from "react";
import { Target, Bot, MessageSquare, TrendingUp, TrendingDown, Users, ArrowRight, Zap, Clock, Phone, Send, Activity, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { supabase } from "@/lib/supabase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { format, subDays, startOfDay } from "date-fns";

const teamMembers = [
  { name: "Alexander D.", role: "Consultor", status: "online", tasks: 12 },
  { name: "Marina S.", role: "SDR", status: "online", tasks: 8 },
  { name: "Carlos R.", role: "Gestor", status: "away", tasks: 5 },
  { name: "Julia M.", role: "Consultor", status: "offline", tasks: 3 },
];

const statusColors: Record<string, string> = {
  online: "bg-emerald-500",
  away: "bg-amber-500",
  offline: "bg-muted-foreground/40",
};

const recentActivity = [
  { time: "09:45", action: "Lead qualificado", detail: "João Silva — São Paulo", type: "success" },
  { time: "09:32", action: "Mensagem enviada", detail: "Campanha Black Friday", type: "info" },
  { time: "09:15", action: "Novo agente ativado", detail: "Bot Vendas Premium", type: "primary" },
  { time: "08:58", action: "Extração concluída", detail: "142 leads — Google Maps", type: "warning" },
  { time: "08:30", action: "Lead respondeu", detail: "Maria Oliveira — RJ", type: "success" },
];

const activityColors: Record<string, string> = {
  success: "bg-emerald-500",
  info: "bg-blue-500",
  primary: "bg-primary",
  warning: "bg-amber-500",
};

const miniChartData = [
  { v: 20 }, { v: 45 }, { v: 30 }, { v: 60 }, { v: 40 }, { v: 80 }, { v: 55 }, { v: 90 }, { v: 70 }, { v: 95 },
];

export default function Index() {
  const { collaborator, isCEO, roleLevel } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();
  const [period, setPeriod] = useState("30");
  const [stats, setStats] = useState({ leads: 0, agents: 0, messagestoday: 0, companies: 0, whatsappMeta: 0, calls: 0, billingTotal: 0 });
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [usageLimits, setUsageLimits] = useState<any>(null);
  const [usageCounts, setUsageCounts] = useState({ leads: 0, extractions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (collaborator) loadDashboard();
  }, [collaborator, selectedCompanyId, period]);

  const loadDashboard = async () => {
    setLoading(true);
    const today = startOfDay(new Date()).toISOString();
    const daysAgo = subDays(new Date(), parseInt(period)).toISOString();
    const isConsultor = roleLevel >= 2;
    const consultantId = collaborator?.id;

    let leadsCount = 0;
    if (isConsultor && consultantId) {
      const { count } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("consultant_id", consultantId);
      leadsCount = count || 0;
    } else {
      const { data: leadsStatsRes } = await supabase.rpc("get_contact_leads_stats");
      leadsCount = Number((leadsStatsRes as { total?: number } | null)?.total ?? 0);
    }

    let agentsQ = supabase.from("agent_definitions").select("id", { count: "exact", head: true }).eq("active", true);
    if (selectedCompanyId !== "all") agentsQ = agentsQ.eq("company_id", selectedCompanyId);

    let msgsQ = supabase.from("prospection_messages").select("id", { count: "exact", head: true })
      .gte("created_at", today);
    if (isConsultor && consultantId) msgsQ = msgsQ.eq("consultant_id", consultantId);

    // Additional queries for new modules
    const companyId = collaborator?.company_id;
    const waMetaQ = companyId
      ? supabase.from("whatsapp_meta_messages").select("id", { count: "exact", head: true }).eq("company_id", companyId).gte("created_at", today)
      : Promise.resolve({ count: 0 });
    const callsQ = companyId
      ? supabase.from("calls").select("id", { count: "exact", head: true }).eq("company_id", companyId).gte("created_at", today)
      : Promise.resolve({ count: 0 });
    const billingQ = companyId
      ? supabase.from("billing_usage").select("total_cost_brl").eq("company_id", companyId)
      : Promise.resolve({ data: [] });

    const [agentsRes, msgsRes, companiesRes, waMetaRes, callsRes, billingRes] = await Promise.all([
      agentsQ,
      msgsQ,
      isCEO ? supabase.from("companies").select("id") : Promise.resolve({ data: [] }),
      waMetaQ,
      callsQ,
      billingQ,
    ]);

    let dailyQuery = isConsultor && consultantId
      ? supabase.from("leads").select("created_at").eq("consultant_id", consultantId).gte("created_at", daysAgo).limit(1000)
      : supabase.from("contact_leads").select("created_at").gte("created_at", daysAgo).limit(1000);

    if (!isConsultor && selectedCompanyId !== "all") {
      dailyQuery = dailyQuery.eq("company_target", selectedCompanyId);
    }

    const usageLimitsPromise = (roleLevel === 3 && collaborator?.role_id)
      ? supabase.from("roles").select("usage_limits").eq("id", collaborator.role_id).single()
      : Promise.resolve({ data: null });

    const [{ data: dailyLeads }, { data: roleData }] = await Promise.all([
      dailyQuery,
      usageLimitsPromise,
    ]);

    const dayCounts: Record<string, number> = {};
    (dailyLeads || []).forEach((l: any) => {
      const day = format(new Date(l.created_at), "dd/MM");
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    setDailyData(Object.entries(dayCounts).map(([day, count]) => ({ day, leads: count })));

    const billingTotal = ((billingRes as any).data || []).reduce((s: number, b: any) => s + Number(b.total_cost_brl || 0), 0);

    setStats({
      leads: leadsCount,
      agents: agentsRes.count || 0,
      messagestoday: msgsRes.count || 0,
      companies: (companiesRes.data || []).length,
      whatsappMeta: (waMetaRes as any).count || 0,
      calls: (callsRes as any).count || 0,
      billingTotal,
    });

    if (roleData?.usage_limits) {
      setUsageLimits(roleData.usage_limits);
      setUsageCounts({ leads: leadsCount, extractions: 0 });
    }

    setLoading(false);
  };

  const conversionRate = stats.leads > 0 ? Math.round((stats.messagestoday / Math.max(stats.leads, 1)) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-[1400px]">
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Bem-vindo de volta,</p>
            <h1 className="text-3xl font-extrabold tracking-tight">{collaborator?.name?.split(" ")[0] || "Usuário"}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/5 gap-1.5 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sistema online
            </Badge>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[120px] h-9 text-xs bg-secondary/60 border-border/60 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Hoje</SelectItem>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── ROW 1: Bento KPIs (assimétricos) ── */}
        <div className="grid grid-cols-12 gap-4">
          {/* Agentes — tall card */}
          <Card className="col-span-6 lg:col-span-3 row-span-2 bg-gradient-to-br from-primary/15 via-card to-card border-primary/20 hover:border-primary/40 transition-all duration-300">
            <CardContent className="p-6 h-full flex flex-col justify-between">
              <div>
                <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center mb-4">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                {loading ? <Skeleton className="h-12 w-20" /> : (
                  <p className="text-5xl font-extrabold tracking-tighter text-primary">{stats.agents}</p>
                )}
                <p className="text-sm text-muted-foreground mt-2">Agentes Ativos</p>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <div className="flex -space-x-2">
                  {["AG", "SD", "VD"].map(a => (
                    <div key={a} className="h-7 w-7 rounded-full bg-primary/20 border-2 border-card flex items-center justify-center text-[9px] font-bold text-primary">{a}</div>
                  ))}
                </div>
                <span className="text-[11px] text-muted-foreground">+{Math.max(stats.agents - 3, 0)} outros</span>
              </div>
            </CardContent>
          </Card>

          {/* Leads */}
          <Card className="col-span-6 lg:col-span-3 bg-card border-border/60 hover:border-emerald-500/30 transition-all duration-300">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">
                  <TrendingUp className="w-3 h-3" /> +12%
                </div>
              </div>
              {loading ? <Skeleton className="h-8 w-24 mt-2" /> : (
                <p className="text-3xl font-extrabold tracking-tight mt-2">{stats.leads.toLocaleString("pt-BR")}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Leads Gerados</p>
            </CardContent>
          </Card>

          {/* Mensagens */}
          <Card className="col-span-6 lg:col-span-3 bg-card border-border/60 hover:border-amber-500/30 transition-all duration-300">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Send className="h-5 w-5 text-amber-400" />
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg">
                  <TrendingUp className="w-3 h-3" /> +8%
                </div>
              </div>
              {loading ? <Skeleton className="h-8 w-16 mt-2" /> : (
                <p className="text-3xl font-extrabold tracking-tight mt-2">{stats.messagestoday.toLocaleString("pt-BR")}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Mensagens Hoje</p>
            </CardContent>
          </Card>

          {/* Empresas / Conversão */}
          <Card className="col-span-6 lg:col-span-3 bg-card border-border/60 hover:border-border transition-all duration-300">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center">
                  {isCEO ? <Users className="h-5 w-5 text-muted-foreground" /> : <BarChart3 className="h-5 w-5 text-muted-foreground" />}
                </div>
              </div>
              {loading ? <Skeleton className="h-8 w-12 mt-2" /> : (
                <p className="text-3xl font-extrabold tracking-tight mt-2">{isCEO ? stats.companies : `${conversionRate}%`}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">{isCEO ? "Empresas" : "Taxa Conversão"}</p>
            </CardContent>
          </Card>

          {/* Mini performance sparkline — below leads */}
          <Card className="col-span-12 lg:col-span-3 bg-card border-border/60 overflow-hidden">
            <CardContent className="p-4 pb-0">
              <p className="text-[11px] text-muted-foreground font-medium mb-1">Performance Semanal</p>
              <ResponsiveContainer width="100%" height={60}>
                <AreaChart data={miniChartData}>
                  <defs>
                    <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(217 91% 53%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(217 91% 53%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke="hsl(217 91% 53%)" fill="url(#sparkFill)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Conversion ring — below mensagens */}
          <Card className="col-span-12 lg:col-span-3 bg-card border-border/60">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="relative h-14 w-14 shrink-0">
                <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(220 14% 12%)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(160 84% 39%)" strokeWidth="3"
                    strokeDasharray={`${Math.min(conversionRate, 100)} 100`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{conversionRate}%</span>
              </div>
              <div>
                <p className="text-sm font-semibold">Meta Diária</p>
                <p className="text-[11px] text-muted-foreground">Taxa de resposta dos leads</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── ROW 2: Chart + Activity + Team ── */}
        <div className="grid grid-cols-12 gap-4">
          {/* Chart — 5 cols */}
          <Card className="col-span-12 lg:col-span-5 bg-card border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Leads por Dia</CardTitle>
                <Badge variant="outline" className="text-[10px] border-border/60 text-muted-foreground font-normal">
                  {period}d
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="w-full h-[200px] rounded-xl" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 10%)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(220 10% 46%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(220 10% 46%)" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(220 16% 8%)",
                        border: "1px solid hsl(220 14% 14%)",
                        borderRadius: "12px",
                        color: "hsl(0 0% 95%)",
                        boxShadow: "0 8px 24px -8px hsl(0 0% 0% / 0.5)",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="leads" fill="hsl(217 91% 53%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Activity Feed — 4 cols */}
          <Card className="col-span-12 lg:col-span-4 bg-card border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Atividade Recente
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-[11px] text-muted-foreground h-7 px-2">
                  Ver tudo <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {recentActivity.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 py-2.5 border-b border-border/30 last:border-0">
                    <div className="mt-1.5">
                      <span className={`block h-2 w-2 rounded-full ${activityColors[a.type]}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">{a.action}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{a.detail}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0">{a.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Team — 3 cols */}
          <Card className="col-span-12 lg:col-span-3 bg-card border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Equipe</CardTitle>
                <Badge className="bg-secondary text-secondary-foreground text-[10px] font-normal">{teamMembers.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {teamMembers.map(m => (
                <div key={m.name} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-secondary/40 transition-colors">
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-secondary text-foreground text-[10px] font-medium">
                        {m.name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-card ${statusColors[m.status]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium truncate">{m.name}</p>
                    <p className="text-[10px] text-muted-foreground">{m.role}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded">{m.tasks}</span>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="w-full text-[11px] text-primary mt-2 h-8">
                <Users className="w-3 h-3 mr-1.5" /> Gerenciar equipe
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── ROW 3: Quick actions + Usage ── */}
        <div className="grid grid-cols-12 gap-4">
          {/* Quick Actions */}
          <Card className="col-span-12 lg:col-span-8 bg-gradient-to-r from-primary/5 via-card to-card border-border/60">
            <CardContent className="p-5">
              <p className="text-sm font-semibold mb-4">Ações Rápidas</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: Target, label: "Extrair Leads", color: "text-emerald-400 bg-emerald-500/10" },
                  { icon: Send, label: "Disparar Msgs", color: "text-primary bg-primary/10" },
                  { icon: Phone, label: "Ligar IA", color: "text-amber-400 bg-amber-500/10" },
                  { icon: Bot, label: "Novo Agente", color: "text-purple-400 bg-purple-500/10" },
                ].map(q => (
                  <button key={q.label} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-secondary/30 hover:bg-secondary/60 border border-border/40 hover:border-border transition-all duration-200 group">
                    <div className={`h-10 w-10 rounded-xl ${q.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <q.icon className="h-5 w-5" />
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground">{q.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Usage Limits */}
          <Card className="col-span-12 lg:col-span-4 bg-card border-border/60">
            <CardContent className="p-5">
              <p className="text-sm font-semibold mb-4">Uso do Sistema</p>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Leads processados</span>
                    <span className="font-medium">{stats.leads > 0 ? `${Math.min(stats.leads, 5000).toLocaleString("pt-BR")}/5.000` : "0/5.000"}</span>
                  </div>
                  <Progress value={Math.min((stats.leads / 5000) * 100, 100)} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Mensagens enviadas</span>
                    <span className="font-medium">{stats.messagestoday}/500</span>
                  </div>
                  <Progress value={Math.min((stats.messagestoday / 500) * 100, 100)} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Agentes ativos</span>
                    <span className="font-medium">{stats.agents}/50</span>
                  </div>
                  <Progress value={Math.min((stats.agents / 50) * 100, 100)} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
