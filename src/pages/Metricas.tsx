import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Users, Target, TrendingUp, Loader2 } from "lucide-react";

export default function Metricas() {
  const { collaborator, isCEO, isDiretor, isGestor } = useCollaborator();
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<any[]>([]);
  const [filterCompany, setFilterCompany] = useState("all");
  const [totals, setTotals] = useState({ collaborators: 0, leads: 0, conversations: 0, conversions: 0 });

  useEffect(() => { loadData(); }, [collaborator, filterCompany]);

  const loadData = async () => {
    if (!collaborator) return;
    setLoading(true);

    if (isCEO) {
      const { data: comps } = await supabase.from("companies").select("id, name").order("name");
      setCompanies(comps || []);
    }

    // Build metrics query based on role
    let collabQuery = supabase.from("collaborators").select("id, name, email, company:companies!collaborators_company_id_fkey(name)").eq("is_active", true);

    if (isDiretor) {
      collabQuery = collabQuery.eq("company_id", collaborator.company_id).eq("sector_id", collaborator.sector_id!);
    } else if (isGestor) {
      collabQuery = collabQuery.eq("company_id", collaborator.company_id).eq("unit_id", collaborator.unit_id!);
    } else if (isCEO && filterCompany !== "all") {
      collabQuery = collabQuery.eq("company_id", filterCompany);
    }

    const { data: collabData } = await collabQuery;
    const collabIds = (collabData || []).map((c: any) => c.id);

    if (collabIds.length > 0) {
      const [leadsRes, convsRes, convertedRes] = await Promise.all([
        supabase.from("contact_leads").select("id", { count: "exact", head: true }).in("assigned_to", collabIds),
        supabase.from("agent_conversations").select("id", { count: "exact", head: true }).in("collaborator_id", collabIds),
        supabase.from("contact_leads").select("id", { count: "exact", head: true }).in("assigned_to", collabIds).eq("status", "convertido"),
      ]);

      setTotals({
        collaborators: collabIds.length,
        leads: leadsRes.count || 0,
        conversations: convsRes.count || 0,
        conversions: convertedRes.count || 0,
      });
    }

    setMetrics(collabData || []);
    setLoading(false);
  };

  const kpis = [
    { label: "Colaboradores", value: totals.collaborators, icon: Users },
    { label: "Leads", value: totals.leads, icon: Target },
    { label: "Conversas", value: totals.conversations, icon: BarChart3 },
    { label: "Conversões", value: totals.conversions, icon: TrendingUp },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Métricas</h1>
            <p className="text-muted-foreground text-sm">
              {isCEO ? "Visão geral de todas as empresas" : isDiretor ? "Métricas do setor" : "Métricas da unidade"}
            </p>
          </div>
          {isCEO && (
            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Empresas</SelectItem>
                {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-stagger">
              {kpis.map(s => (
                <Card key={s.label} className="kpi-card border-0 bg-gradient-to-br from-[hsl(var(--kpi-from))] to-[hsl(var(--kpi-to))] text-primary-foreground">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-primary-foreground/70">{s.label}</p>
                        <p className="text-3xl font-bold mt-1">{s.value}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm"><s.icon className="h-6 w-6 text-primary-foreground" /></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader><CardTitle>Colaboradores</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      {isCEO && <TableHead>Empresa</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.map((c: any) => (
                      <TableRow key={c.id} className="table-row-hover">
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.email}</TableCell>
                        {isCEO && <TableCell>{c.company?.name || "—"}</TableCell>}
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
