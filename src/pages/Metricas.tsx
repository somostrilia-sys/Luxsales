import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, Target, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Metricas() {
  const { collaborator, roleLevel } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();
  const [period, setPeriod] = useState("30");
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ collaborators: 0, leads: 0 });
  const [barData, setBarData] = useState<any[]>([]);

  useEffect(() => { if (collaborator) loadMetrics(); }, [collaborator, selectedCompanyId, period]);

  const loadMetrics = async () => {
    setLoading(true);

    // Get relevant collaborator IDs
    let collabQuery = supabase.from("collaborators").select("id, name").eq("active", true);
    if (selectedCompanyId !== "all") collabQuery = collabQuery.eq("company_id", selectedCompanyId);
    else if (roleLevel === 1 && collaborator?.sector_id) collabQuery = collabQuery.eq("sector_id", collaborator.sector_id);
    else if (roleLevel === 2 && collaborator?.unit_id) collabQuery = collabQuery.eq("unit_id", collaborator.unit_id);

    const { data: collabData } = await collabQuery;
    const collabs = collabData || [];
    const collabIds = collabs.map((c: any) => c.id);

    // Leads count
    let leadsQuery = supabase.from("contact_leads").select("id", { count: "exact", head: true });
    if (selectedCompanyId !== "all") leadsQuery = leadsQuery.eq("company_target", selectedCompanyId);
    const { count: leadsCount } = await leadsQuery;

    setTotals({ collaborators: collabIds.length, leads: leadsCount || 0 });

    // Bar chart leads by source
    let sourceQuery = supabase.from("contact_leads").select("source");
    if (selectedCompanyId !== "all") sourceQuery = sourceQuery.eq("company_target", selectedCompanyId);
    const { data: sourceData } = await sourceQuery;
    const sc: Record<string, number> = {};
    (sourceData || []).forEach((l: any) => { const s = l.source || "outro"; sc[s] = (sc[s] || 0) + 1; });
    setBarData(Object.entries(sc).map(([name, total]) => ({ name, total })));

    setLoading(false);
  };

  const kpis = [
    { label: "Colaboradores", value: totals.collaborators, icon: Users },
    { label: "Leads", value: totals.leads, icon: Target },
    { label: "Fontes", value: barData.length, icon: BarChart3 },
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
