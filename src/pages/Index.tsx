import { useEffect, useState } from "react";
import { Target, Bot, MessageSquare, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
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
    const companyFilter = selectedCompanyId !== "all" ? selectedCompanyId : collaborator?.company_id;
    const today = startOfDay(new Date()).toISOString();
    const daysAgo = subDays(new Date(), parseInt(period)).toISOString();

    // Parallel queries
    const [leadsRes, agentsRes, msgsRes, companiesRes] = await Promise.all([
      supabase.from("contact_leads").select("id", { count: "exact", head: true })
        .eq(selectedCompanyId !== "all" ? "company_target" : "company_target", companyFilter || ""),
      supabase.from("agent_definitions").select("id", { count: "exact", head: true })
        .eq("active", true)
        .eq(selectedCompanyId !== "all" ? "company_id" : "company_id", companyFilter || ""),
      supabase.from("agent_messages").select("id", { count: "exact", head: true })
        .gte("created_at", today),
      supabase.from("companies").select("id"),
    ]);

    // Daily chart - leads by day
    let dailyQuery = supabase.from("contact_leads").select("created_at").gte("created_at", daysAgo);
    if (selectedCompanyId !== "all") dailyQuery = dailyQuery.eq("company_target", selectedCompanyId);
    const { data: dailyLeads } = await dailyQuery;

    const dayCounts: Record<string, number> = {};
    (dailyLeads || []).forEach((l: any) => {
      const day = format(new Date(l.created_at), "dd/MM");
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    setDailyData(Object.entries(dayCounts).map(([day, count]) => ({ day, leads: count })));

    setStats({
      leads: leadsRes.count || 0,
      agents: agentsRes.count || 0,
      messagestoday: msgsRes.count || 0,
      companies: (companiesRes.data || []).length,
    });

    // Usage limits for consultants
    if (roleLevel === 3 && collaborator?.role_id) {
      const { data: roleData } = await supabase.from("roles").select("usage_limits").eq("id", collaborator.role_id).single();
      if (roleData?.usage_limits) {
        setUsageLimits(roleData.usage_limits);
        // Count today's usage
        let todayLeads = supabase.from("contact_leads").select("id", { count: "exact", head: true }).gte("created_at", today);
        if (companyFilter) todayLeads = todayLeads.eq("company_target", companyFilter);
        const { count: lc } = await todayLeads;
        setUsageCounts({ leads: lc || 0, extractions: 0 });
      }
    }

    setLoading(false);
  };

  const kpis = [
    { label: "Agentes Ativos", value: stats.agents, icon: Bot, color: "text-primary" },
    { label: "Leads Gerados", value: stats.leads, icon: Target, color: "text-success" },
    { label: "Mensagens Hoje", value: stats.messagestoday, icon: MessageSquare, color: "text-warning" },
    { label: isCEO ? "Empresas" : "Taxa Conversão", value: isCEO ? stats.companies : "0%", icon: TrendingUp, color: "text-muted-foreground" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
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
            <Card key={s.label} className="hover:bg-[hsl(var(--card-hover))] transition-colors">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                    <p className="text-2xl font-bold mt-1">{loading ? "..." : s.value}</p>
                  </div>
                  <div className={`p-2.5 rounded-lg bg-muted ${s.color}`}>
                    <s.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Usage Limits for Consultants */}
        {roleLevel === 3 && usageLimits && (
          <Card>
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
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Leads por Dia</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} />
                <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
