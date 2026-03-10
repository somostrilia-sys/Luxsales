import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Users, Target, BarChart3, TrendingUp } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";

export default function Metricas() {
  const { collaborator, isCEO, roleLevel } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();
  const [period, setPeriod] = useState("30");
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ collaborators: 0, leads: 0, conversations: 0, conversions: 0 });
  const [lineData, setLineData] = useState<any[]>([]);
  const [barData, setBarData] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);

  useEffect(() => { if (collaborator) loadMetrics(); }, [collaborator, selectedCompanyId, period]);

  const loadMetrics = async () => {
    setLoading(true);
    const days = parseInt(period);
    const since = subDays(new Date(), days).toISOString().split("T")[0];

    // Get relevant collaborator IDs
    let collabQuery = supabase.from("collaborators").select("id, name").eq("is_active", true);
    if (selectedCompanyId !== "all") collabQuery = collabQuery.eq("company_id", selectedCompanyId);
    else if (roleLevel === 1) collabQuery = collabQuery.eq("sector_id", collaborator!.sector_id!);
    else if (roleLevel === 2) collabQuery = collabQuery.eq("unit_id", collaborator!.unit_id!);

    const { data: collabData } = await collabQuery;
    const collabs = collabData || [];
    const collabIds = collabs.map((c: any) => c.id);
    const nameMap = Object.fromEntries(collabs.map((c: any) => [c.id, c.name]));

    if (collabIds.length === 0) { setLoading(false); return; }

    const { data: metricsData } = await supabase.from("collaborator_metrics")
      .select("messages_sent, responses_received, leads_converted, metric_date, collaborator_id")
      .gte("metric_date", since)
      .in("collaborator_id", collabIds);

    const md = metricsData || [];
    const totalMsgs = md.reduce((s, m) => s + (m.messages_sent || 0), 0);
    const totalResp = md.reduce((s, m) => s + (m.responses_received || 0), 0);
    const totalConv = md.reduce((s, m) => s + (m.leads_converted || 0), 0);

    const [leadsRes] = await Promise.all([
      supabase.from("contact_leads").select("id", { count: "exact", head: true }).in("assigned_to", collabIds),
    ]);

    setTotals({ collaborators: collabIds.length, leads: leadsRes.count || 0, conversations: totalMsgs, conversions: totalConv });

    // Line chart
    const byDay: Record<string, number> = {};
    for (let i = 0; i < days; i++) byDay[format(subDays(new Date(), i), "yyyy-MM-dd")] = 0;
    md.forEach(m => { if (byDay[m.metric_date] !== undefined) byDay[m.metric_date] += m.messages_sent || 0; });
    setLineData(Object.entries(byDay).sort().map(([date, val]) => ({ date: format(new Date(date), "dd/MM"), msgs: val })));

    // Bar chart leads by source
    let leadsQuery = supabase.from("contact_leads").select("source").in("assigned_to", collabIds);
    const { data: sourceData } = await leadsQuery;
    const sc: Record<string, number> = {};
    (sourceData || []).forEach((l: any) => { const s = l.source || "outro"; sc[s] = (sc[s] || 0) + 1; });
    setBarData(Object.entries(sc).map(([name, total]) => ({ name, total })));

    // Ranking
    const cm: Record<string, { msgs: number; resp: number; conv: number }> = {};
    md.forEach(m => {
      if (!cm[m.collaborator_id]) cm[m.collaborator_id] = { msgs: 0, resp: 0, conv: 0 };
      cm[m.collaborator_id].msgs += m.messages_sent || 0;
      cm[m.collaborator_id].resp += m.responses_received || 0;
      cm[m.collaborator_id].conv += m.leads_converted || 0;
    });
    setRanking(
      Object.entries(cm).sort((a, b) => b[1].msgs - a[1].msgs).slice(0, 10)
        .map(([id, vals]) => ({ name: nameMap[id] || "—", ...vals }))
    );

    setLoading(false);
  };

  const kpis = [
    { label: "Colaboradores", value: totals.collaborators, icon: Users },
    { label: "Leads", value: totals.leads, icon: Target },
    { label: "Msgs Enviadas", value: totals.conversations, icon: BarChart3 },
    { label: "Conversões", value: totals.conversions, icon: TrendingUp },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Métricas</h1>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Hoje</SelectItem>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {kpis.map(s => (
                <Card key={s.label} className="shadow-sm">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                        <p className="text-2xl font-bold mt-1">{s.value}</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-muted"><s.icon className="h-5 w-5 text-muted-foreground" /></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

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
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
