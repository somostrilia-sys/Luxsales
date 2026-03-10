import { useEffect, useState } from "react";
import { Target, MessageSquare, Reply, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { supabase } from "@/lib/supabase";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";

export default function Index() {
  const { collaborator, isCEO, roleLevel } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();
  const [period, setPeriod] = useState("30");
  const [stats, setStats] = useState({ leads: 0, msgsSent: 0, responses: 0, conversionRate: 0 });
  const [lineData, setLineData] = useState<any[]>([]);
  const [barData, setBarData] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [companyLeads, setCompanyLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (collaborator) loadDashboard();
  }, [collaborator, selectedCompanyId, period]);

  const loadDashboard = async () => {
    setLoading(true);
    const days = parseInt(period);
    const since = subDays(new Date(), days).toISOString();

    // KPIs from collaborator_metrics
    let metricsQuery = supabase
      .from("collaborator_metrics")
      .select("messages_sent, responses_received, leads_converted, metric_date, collaborator_id")
      .gte("metric_date", since.split("T")[0]);

    if (selectedCompanyId !== "all") {
      // filter by collaborators in that company
      const { data: collabs } = await supabase
        .from("collaborators")
        .select("id")
        .eq("company_id", selectedCompanyId);
      const ids = (collabs || []).map((c: any) => c.id);
      if (ids.length > 0) metricsQuery = metricsQuery.in("collaborator_id", ids);
    } else if (roleLevel === 1 && collaborator?.sector_id) {
      const { data: collabs } = await supabase
        .from("collaborators").select("id").eq("sector_id", collaborator.sector_id);
      const ids = (collabs || []).map((c: any) => c.id);
      if (ids.length > 0) metricsQuery = metricsQuery.in("collaborator_id", ids);
    } else if (roleLevel === 2 && collaborator?.unit_id) {
      const { data: collabs } = await supabase
        .from("collaborators").select("id").eq("unit_id", collaborator.unit_id);
      const ids = (collabs || []).map((c: any) => c.id);
      if (ids.length > 0) metricsQuery = metricsQuery.in("collaborator_id", ids);
    } else if (roleLevel === 3) {
      metricsQuery = metricsQuery.eq("collaborator_id", collaborator!.id);
    }

    const { data: metricsData } = await metricsQuery;
    const md = metricsData || [];

    const totalMsgs = md.reduce((s, m) => s + (m.messages_sent || 0), 0);
    const totalResp = md.reduce((s, m) => s + (m.responses_received || 0), 0);
    const totalConv = md.reduce((s, m) => s + (m.leads_converted || 0), 0);

    // Total leads
    let leadsQuery = supabase.from("contact_leads").select("id", { count: "exact", head: true });
    if (selectedCompanyId !== "all") leadsQuery = leadsQuery.eq("company_target", selectedCompanyId);
    const { count: leadsCount } = await leadsQuery;

    setStats({
      leads: leadsCount || 0,
      msgsSent: totalMsgs,
      responses: totalResp,
      conversionRate: totalMsgs > 0 ? Math.round((totalConv / totalMsgs) * 100) : 0,
    });

    // Line chart: msgs per day
    const byDay: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      byDay[format(subDays(new Date(), i), "yyyy-MM-dd")] = 0;
    }
    md.forEach(m => { if (byDay[m.metric_date] !== undefined) byDay[m.metric_date] += m.messages_sent || 0; });
    setLineData(
      Object.entries(byDay).sort().map(([date, val]) => ({ date: format(new Date(date), "dd/MM"), msgs: val }))
    );

    // Bar chart: leads by source
    const { data: sourceData } = await supabase
      .from("contact_leads")
      .select("source");
    const sourceCounts: Record<string, number> = {};
    (sourceData || []).forEach((l: any) => {
      const s = l.source || "desconhecido";
      sourceCounts[s] = (sourceCounts[s] || 0) + 1;
    });
    setBarData(Object.entries(sourceCounts).map(([name, total]) => ({ name, total })));

    // Ranking top 10
    const collabMetrics: Record<string, { msgs: number; resp: number; conv: number }> = {};
    md.forEach(m => {
      if (!collabMetrics[m.collaborator_id]) collabMetrics[m.collaborator_id] = { msgs: 0, resp: 0, conv: 0 };
      collabMetrics[m.collaborator_id].msgs += m.messages_sent || 0;
      collabMetrics[m.collaborator_id].resp += m.responses_received || 0;
      collabMetrics[m.collaborator_id].conv += m.leads_converted || 0;
    });
    const topIds = Object.entries(collabMetrics).sort((a, b) => b[1].msgs - a[1].msgs).slice(0, 10);
    if (topIds.length > 0) {
      const { data: names } = await supabase.from("collaborators").select("id, name").in("id", topIds.map(t => t[0]));
      const nameMap = Object.fromEntries((names || []).map((n: any) => [n.id, n.name]));
      setRanking(topIds.map(([id, vals]) => ({ name: nameMap[id] || "—", ...vals })));
    }

    // Leads by company
    if (isCEO) {
      const { data: cl } = await supabase.from("contact_leads").select("company_target, company:companies!contact_leads_company_target_fkey(name)");
      const cc: Record<string, { name: string; count: number }> = {};
      (cl || []).forEach((l: any) => {
        const cid = l.company_target;
        if (!cc[cid]) cc[cid] = { name: (l.company as any)?.name || "—", count: 0 };
        cc[cid].count++;
      });
      setCompanyLeads(Object.values(cc));
    }

    setLoading(false);
  };

  const kpis = [
    { label: "Total Leads", value: stats.leads, icon: Target, color: "text-primary" },
    { label: "Msgs Enviadas", value: stats.msgsSent, icon: MessageSquare, color: "text-accent" },
    { label: "Respostas", value: stats.responses, icon: Reply, color: "text-warning" },
    { label: "Taxa Conversão", value: `${stats.conversionRate}%`, icon: TrendingUp, color: "text-success" },
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
            <Card key={s.label} className="shadow-sm">
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

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Mensagens por Dia</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="msgs" stroke="hsl(224, 76%, 48%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Leads por Fonte</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Ranking */}
        {ranking.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top 10 Consultores</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-right">Msgs</TableHead>
                    <TableHead className="text-right">Respostas</TableHead>
                    <TableHead className="text-right">Fechamentos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map((r, i) => (
                    <TableRow key={i} className="table-row-hover">
                      <TableCell className="font-medium">{i + 1}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right">{r.msgs}</TableCell>
                      <TableCell className="text-right">{r.resp}</TableCell>
                      <TableCell className="text-right">{r.conv}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Leads by company */}
        {isCEO && companyLeads.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {companyLeads.map((cl, i) => (
              <Card key={i} className="shadow-sm">
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-muted-foreground font-medium">{cl.name}</p>
                  <p className="text-2xl font-bold mt-1">{cl.count} leads</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
