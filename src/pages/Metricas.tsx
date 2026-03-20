import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Target, BarChart3, Phone, MessageSquare, DollarSign, Zap, TrendingUp } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#6B7280"];

export default function Metricas() {
  const { collaborator, roleLevel } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();
  const [period, setPeriod] = useState("30");
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ collaborators: 0, leads: 0, calls: 0, messages: 0 });
  const [barData, setBarData] = useState<any[]>([]);
  const [channelCosts, setChannelCosts] = useState<any[]>([]);
  const [billingTotal, setBillingTotal] = useState(0);
  const [whatsappHealth, setWhatsappHealth] = useState<any>(null);

  const companyId = selectedCompanyId !== "all" ? selectedCompanyId : collaborator?.company_id;

  useEffect(() => { if (collaborator) loadMetrics(); }, [collaborator, selectedCompanyId, period]);

  const loadMetrics = async () => {
    setLoading(true);

    // Get relevant collaborator IDs
    let collabQuery = supabase.from("collaborators").select("id, name").eq("active", true);
    if (roleLevel === 3 && collaborator?.id) {
      collabQuery = collabQuery.eq("id", collaborator.id);
    } else if (selectedCompanyId !== "all") {
      collabQuery = collabQuery.eq("company_id", selectedCompanyId);
    } else if (roleLevel === 1 && collaborator?.sector_id) {
      collabQuery = collabQuery.eq("sector_id", collaborator.sector_id);
    } else if (roleLevel === 2 && collaborator?.unit_id) {
      collabQuery = collabQuery.eq("unit_id", collaborator.unit_id);
    }

    const { data: collabData } = await collabQuery;
    const collabs = collabData || [];

    // Parallel data fetches
    const [leadsRes, callsRes, msgsRes, billingRes, healthRes] = await Promise.all([
      // Leads count
      supabase.from("contact_leads").select("id", { count: "exact", head: true })
        .then(r => r.count ?? 0),
      // Calls count
      companyId
        ? supabase.from("calls").select("id", { count: "exact", head: true }).eq("company_id", companyId).then(r => r.count ?? 0)
        : Promise.resolve(0),
      // WhatsApp Meta messages count
      companyId
        ? supabase.from("whatsapp_meta_messages").select("id", { count: "exact", head: true }).eq("company_id", companyId).then(r => r.count ?? 0)
        : Promise.resolve(0),
      // Billing costs by channel
      companyId
        ? supabase.from("billing_usage").select("channel, total_cost_brl").eq("company_id", companyId)
        : Promise.resolve({ data: [] }),
      // WhatsApp health
      companyId
        ? supabase.from("v_company_whatsapp_health").select("*").eq("company_id", companyId).single()
        : Promise.resolve({ data: null }),
    ]);

    setTotals({
      collaborators: collabs.length,
      leads: leadsRes as number,
      calls: callsRes as number,
      messages: msgsRes as number,
    });

    // Process billing data
    const billingData = (billingRes as any).data || [];
    const costsByChannel: Record<string, number> = {};
    let total = 0;
    billingData.forEach((b: any) => {
      const cost = Number(b.total_cost_brl) || 0;
      costsByChannel[b.channel] = (costsByChannel[b.channel] || 0) + cost;
      total += cost;
    });
    setChannelCosts(Object.entries(costsByChannel).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) })));
    setBillingTotal(total);

    setWhatsappHealth((healthRes as any).data);

    // Bar chart leads by source
    let sourceQuery = supabase.from("contact_leads").select("source").limit(1000);
    if (selectedCompanyId !== "all") sourceQuery = sourceQuery.eq("company_target", selectedCompanyId);
    const { data: sourceData } = await sourceQuery;
    const sc: Record<string, number> = {};
    (sourceData || []).forEach((l: any) => { const s = l.source || "outro"; sc[s] = (sc[s] || 0) + 1; });
    setBarData(Object.entries(sc).map(([name, total]) => ({ name, total })));

    setLoading(false);
  };

  const kpis = [
    ...(roleLevel <= 2 ? [{ label: "Colaboradores", value: totals.collaborators, icon: Users, color: "text-blue-400" }] : []),
    { label: "Leads", value: totals.leads, icon: Target, color: "text-emerald-400" },
    { label: "Ligações", value: totals.calls, icon: Phone, color: "text-violet-400" },
    { label: "Msgs WhatsApp", value: totals.messages, icon: MessageSquare, color: "text-emerald-400" },
    { label: "Custo Total", value: `R$ ${billingTotal.toFixed(2)}`, icon: DollarSign, color: "text-yellow-400" },
    { label: "Fontes", value: barData.length, icon: BarChart3, color: "text-blue-400" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader title="Métricas" subtitle="Visão cross-channel com dados reais">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Hoje</SelectItem>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
            </SelectContent>
          </Select>
        </PageHeader>

        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {kpis.map(s => (
                <Card key={s.label} className="bg-card border-border/60">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center">
                        <s.icon className={`h-4 w-4 ${s.color}`} />
                      </div>
                      <div>
                        <p className="text-lg font-bold">{typeof s.value === "number" ? s.value.toLocaleString("pt-BR") : s.value}</p>
                        <p className="text-[10px] text-muted-foreground">{s.label}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* WhatsApp Health + Billing */}
            {whatsappHealth && (
              <Card className="bg-card border-border/60">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-emerald-400" />Saúde WhatsApp Meta</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div><p className="text-xs text-muted-foreground">Quality Rating</p><p className="font-bold">{whatsappHealth.quality_rating ?? "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Messaging Tier</p><p className="font-bold">{whatsappHealth.messaging_limit_tier ?? "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Templates Aprovados</p><p className="font-bold">{whatsappHealth.approved_templates ?? 0}</p></div>
                    <div><p className="text-xs text-muted-foreground">Opt-ins Ativos</p><p className="font-bold">{whatsappHealth.active_opt_ins ?? 0}</p></div>
                    <div><p className="text-xs text-muted-foreground">Alertas</p><p className="font-bold text-red-400">{whatsappHealth.unresolved_quality_signals ?? 0}</p></div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-card border-border/60">
                <CardHeader><CardTitle className="text-sm font-semibold">Leads por Fonte</CardTitle></CardHeader>
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

              <Card className="bg-card border-border/60">
                <CardHeader><CardTitle className="text-sm font-semibold">Custos por Canal</CardTitle></CardHeader>
                <CardContent>
                  {channelCosts.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={channelCosts} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value"
                          label={({ name, value }) => `${name}: R$${value}`}>
                          {channelCosts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Nenhum custo registrado</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
