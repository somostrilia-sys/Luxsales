import { useEffect, useState } from "react";
import { Target, Bot, MessageSquare, TrendingUp, TrendingDown, Users, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { supabase } from "@/lib/supabase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
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

export default function Index() {
  const { collaborator, isCEO, roleLevel } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();
  const [period, setPeriod] = useState("30");
  const [stats, setStats] = useState({ leads: 0, agents: 0, messagestoday: 0, companies: 0 });
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
      const { data: leadsStatsRes } = await supabase.rpc('get_contact_leads_stats');
      leadsCount = leadsStatsRes?.total || 0;
    }

    let agentsQ = supabase.from("agent_definitions").select("id", { count: "exact", head: true }).eq("active", true);
    if (selectedCompanyId !== "all") agentsQ = agentsQ.eq("company_id", selectedCompanyId);

    let msgsQ = supabase.from("prospection_messages").select("id", { count: "exact", head: true })
      .gte("created_at", today);
    if (isConsultor && consultantId) msgsQ = msgsQ.eq("consultant_id", consultantId);

    const [agentsRes, msgsRes, companiesRes] = await Promise.all([
      agentsQ,
      msgsQ,
      isCEO ? supabase.from("companies").select("id") : Promise.resolve({ data: [] }),
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

    setStats({
      leads: leadsCount,
      agents: agentsRes.count || 0,
      messagestoday: msgsRes.count || 0,
      companies: (companiesRes.data || []).length,
    });

    if (roleData?.usage_limits) {
      setUsageLimits(roleData.usage_limits);
      setUsageCounts({ leads: leadsCount, extractions: 0 });
    }

    setLoading(false);
  };

  const kpis = [
    { label: "Agentes Ativos", value: stats.agents, icon: Bot, color: "text-primary", bg: "bg-primary/10", trend: "+2", trendUp: true },
    { label: "Leads Gerados", value: stats.leads, icon: Target, color: "text-emerald-400", bg: "bg-emerald-500/10", trend: "+12%", trendUp: true },
    { label: "Mensagens Hoje", value: stats.messagestoday, icon: MessageSquare, color: "text-amber-400", bg: "bg-amber-500/10", trend: "+8%", trendUp: true },
    { label: isCEO ? "Empresas" : "Taxa Conversão", value: isCEO ? stats.companies : "0%", icon: TrendingUp, color: "text-muted-foreground", bg: "bg-muted/50", trend: "0%", trendUp: true },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1400px]">
        {/* Header */}
        <PageHeader title="Dashboard Overview" subtitle="Gerencie seus projetos, equipe e estatísticas">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[130px] h-9 text-xs bg-secondary/60 border-border/60 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Hoje</SelectItem>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
            </SelectContent>
          </Select>
        </PageHeader>

        {/* KPI Cards — Omni style */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map(s => (
            <Card key={s.label} className="bg-card border-border/60 hover:border-border transition-all duration-200 hover:shadow-[var(--shadow-card-hover)]">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`h-11 w-11 rounded-2xl ${s.bg} flex items-center justify-center shrink-0`}>
                    <s.icon className={`h-5 w-5 ${s.color}`} />
                  </div>
                  <div className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg ${
                    s.trendUp ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"
                  }`}>
                    {s.trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {s.trend}
                  </div>
                </div>
                {loading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <p className="text-2xl font-bold tracking-tight">{typeof s.value === "number" ? s.value.toLocaleString("pt-BR") : s.value}</p>
                )}
                <p className="text-[11px] text-muted-foreground font-medium mt-1">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main content grid — Bento */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Chart — spans 8 columns */}
          <Card className="lg:col-span-8 bg-card border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Leads por Dia</CardTitle>
                <Badge variant="outline" className="text-[10px] border-border/60 text-muted-foreground font-normal">
                  Últimos {period} dias
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="w-full h-[240px] rounded-xl" />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dailyData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 10%)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(220 10% 46%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(220 10% 46%)" }} axisLine={false} tickLine={false} />
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
                    <Bar dataKey="leads" fill="hsl(217 91% 53%)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Team Members — 4 columns */}
          <Card className="lg:col-span-4 bg-card border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Equipe</CardTitle>
                <span className="text-xs text-muted-foreground">{teamMembers.length} membros</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {teamMembers.map(m => (
                <div key={m.name} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/40 transition-colors">
                  <div className="relative">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-secondary text-foreground text-xs font-medium">
                        {m.name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${statusColors[m.status]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                    <p className="text-[11px] text-muted-foreground">{m.role}</p>
                  </div>
                  <span className="text-xs text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-lg">{m.tasks}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Usage Limits for Consultants */}
        {roleLevel === 3 && usageLimits && (
          <Card className="bg-card border-border/60">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Limites de Uso Hoje</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {usageLimits.max_leads_day && usageLimits.max_leads_day !== -1 && (
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Leads</span>
                    <span className="font-medium">{usageCounts.leads}/{usageLimits.max_leads_day}</span>
                  </div>
                  <Progress value={(usageCounts.leads / usageLimits.max_leads_day) * 100} className="h-2" />
                </div>
              )}
              {usageLimits.max_extractions_day && usageLimits.max_extractions_day !== -1 && (
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Extrações</span>
                    <span className="font-medium">{usageCounts.extractions}/{usageLimits.max_extractions_day}</span>
                  </div>
                  <Progress value={(usageCounts.extractions / usageLimits.max_extractions_day) * 100} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
