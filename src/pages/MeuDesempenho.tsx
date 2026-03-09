import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Target, MessageSquare, TrendingUp, Loader2 } from "lucide-react";

export default function MeuDesempenho() {
  const { collaborator } = useCollaborator();
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ leads: 0, conversations: 0, conversions: 0 });

  useEffect(() => { loadMetrics(); }, [collaborator]);

  const loadMetrics = async () => {
    if (!collaborator) return;

    const [metricsRes, leadsRes, convsRes] = await Promise.all([
      supabase.from("collaborator_metrics")
        .select("*")
        .eq("collaborator_id", collaborator.id)
        .order("date", { ascending: false })
        .limit(30),
      supabase.from("contact_leads").select("id", { count: "exact", head: true }).eq("assigned_to", collaborator.id),
      supabase.from("agent_conversations").select("id", { count: "exact", head: true }).eq("collaborator_id", collaborator.id),
    ]);

    setMetrics(metricsRes.data || []);
    const convertedLeads = await supabase.from("contact_leads")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", collaborator.id)
      .eq("status", "convertido");

    setTotals({
      leads: leadsRes.count || 0,
      conversations: convsRes.count || 0,
      conversions: convertedLeads.count || 0,
    });
    setLoading(false);
  };

  const kpis = [
    { label: "Total Leads", value: totals.leads, icon: Target },
    { label: "Conversas", value: totals.conversations, icon: MessageSquare },
    { label: "Conversões", value: totals.conversions, icon: TrendingUp },
    { label: "Taxa Conversão", value: totals.leads > 0 ? `${Math.round((totals.conversions / totals.leads) * 100)}%` : "0%", icon: BarChart3 },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Meu Desempenho</h1>
          <p className="text-muted-foreground text-sm">Acompanhe suas métricas pessoais</p>
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
                      <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm">
                        <s.icon className="h-6 w-6 text-primary-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {metrics.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Histórico de Métricas</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {metrics.slice(0, 10).map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <span className="text-sm font-medium">{new Date(m.date).toLocaleDateString("pt-BR")}</span>
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          <span>Leads: {m.leads_count || 0}</span>
                          <span>Conversas: {m.conversations_count || 0}</span>
                          <span>Conversões: {m.conversions_count || 0}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
