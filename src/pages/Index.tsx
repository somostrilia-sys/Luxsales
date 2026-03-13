// app v2.1
import { useEffect, useState } from "react";
import { Target, Bot, MessageSquare, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { supabase } from "@/lib/supabase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays, startOfDay } from "date-fns";

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
    { label: "Agentes Ativos", value: stats.agents, icon: Bot, iconClass: "stat-icon-primary", accentClass: "card-accent-top" },
    { label: "Leads Gerados", value: stats.leads, icon: Target, iconClass: "stat-icon-success", accentClass: "card-accent-top accent-green" },
    { label: "Mensagens Hoje", value: stats.messagestoday, icon: MessageSquare, iconClass: "stat-icon-warning", accentClass: "card-accent-top accent-warning" },
    { label: isCEO ? "Empresas" : "Taxa Conversão", value: isCEO ? stats.companies : "0%", icon: TrendingUp, iconClass: "stat-icon-muted", accentClass: "card-accent-top" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Visão geral do sistema</p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[120px] h-8 text-xs bg-secondary/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Hoje</SelectItem>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map(s => (
            <Card key={s.label} variant="gradient" className={s.accentClass}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{s.label}</p>
                    {loading ? (
                      <Skeleton className="h-8 w-20 mt-2" />
                    ) : (
                      <p className="text-3xl font-bold mt-2 tracking-tight">{typeof s.value === "number" ? s.value.toLocaleString("pt-BR") : s.value}</p>
                    )}
                  </div>
                  <div className={`p-3 rounded-xl ${s.iconClass}`}>
                    <s.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Usage Limits for Consultants */}
        {roleLevel === 3 && usageLimits && (
          <Card variant="gradient">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Limites de Uso Hoje</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {usageLimits.max_leads_day && usageLimits.max_leads_day !== -1 && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Leads</span>
                    <span>{usageCounts.leads}/{usageLimits.max_leads_day}</span>
                  </div>
                  <Progress value={(usageCounts.leads / usageLimits.max_leads_day) * 100} className="h-2" />
                </div>
              )}
              {usageLimits.max_extractions_day && usageLimits.max_extractions_day !== -1 && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Extrações</span>
                    <span>{usageCounts.extractions}/{usageLimits.max_extractions_day}</span>
                  </div>
                  <Progress value={(usageCounts.extractions / usageLimits.max_extractions_day) * 100} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Daily Chart */}
        <Card variant="gradient">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Leads por Dia</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="w-full h-[260px] rounded" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 12% 12%)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(240 10% 55%)" }} axisLine={{ stroke: "hsl(240 12% 12%)" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(240 10% 55%)" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(240 14% 8%)",
                      border: "1px solid hsl(240 12% 16%)",
                      borderRadius: "10px",
                      color: "hsl(240 5% 96%)",
                      boxShadow: "0 8px 32px -8px hsl(0 0% 0% / 0.5)",
                    }}
                  />
                  <Bar dataKey="leads" fill="hsl(217 91% 53%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
