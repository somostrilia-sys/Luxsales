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
  const [stats, setStats] = useState({ leads: 0, sources: 0, companies: 0, conversionRate: 0 });
  const [barData, setBarData] = useState<any[]>([]);
  const [companyLeads, setCompanyLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (collaborator) loadDashboard();
  }, [collaborator, selectedCompanyId, period]);

  const loadDashboard = async () => {
    setLoading(true);

    // Total leads
    let leadsQuery = supabase.from("contact_leads").select("id", { count: "exact", head: true });
    if (selectedCompanyId !== "all") leadsQuery = leadsQuery.eq("company_target", selectedCompanyId);
    const { count: leadsCount } = await leadsQuery;

    // Bar chart: leads by source
    let sourceQuery = supabase.from("contact_leads").select("source");
    if (selectedCompanyId !== "all") sourceQuery = sourceQuery.eq("company_target", selectedCompanyId);
    const { data: sourceData } = await sourceQuery;
    const sourceCounts: Record<string, number> = {};
    (sourceData || []).forEach((l: any) => {
      const s = l.source || "desconhecido";
      sourceCounts[s] = (sourceCounts[s] || 0) + 1;
    });
    setBarData(Object.entries(sourceCounts).map(([name, total]) => ({ name, total })));

    // Companies count
    const { data: companiesData } = await supabase.from("companies").select("id");

    setStats({
      leads: leadsCount || 0,
      sources: Object.keys(sourceCounts).length,
      companies: (companiesData || []).length,
      conversionRate: 0,
    });

    // Leads by company (CEO only) - without FK join, manual approach
    if (isCEO) {
      const { data: cl } = await supabase.from("contact_leads").select("company_target");
      const { data: allCompanies } = await supabase.from("companies").select("id, name");
      const companyMap = Object.fromEntries((allCompanies || []).map((c: any) => [c.id, c.name]));
      const cc: Record<string, { name: string; count: number }> = {};
      (cl || []).forEach((l: any) => {
        const cid = l.company_target;
        if (!cid) return;
        if (!cc[cid]) cc[cid] = { name: companyMap[cid] || "—", count: 0 };
        cc[cid].count++;
      });
      setCompanyLeads(Object.values(cc));
    }

    setLoading(false);
  };

  const kpis = [
    { label: "Total Leads", value: stats.leads, icon: Target, color: "text-primary" },
    { label: "Fontes Ativas", value: stats.sources, icon: MessageSquare, color: "text-accent" },
    { label: "Empresas", value: stats.companies, icon: Reply, color: "text-warning" },
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
        <div className="grid grid-cols-1 gap-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Leads por Fonte</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

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
